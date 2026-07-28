import { db } from '@/lib/db'
import { apiResponse, paginatedApiResponse, apiError, withAdmin, parseIdsParam, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions, EntityTypes, getClientIP } from '@/lib/audit'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { transitionWorkflow } from '@/lib/workflow'
import { sanitizeForStorage } from '@/lib/sanitize'
import { validateAllHtmlBlocks } from '@/lib/html-validation'

const createLectureSchema = z.object({
  title: z.string().min(1, 'শিরোনাম আবশ্যক'),
  slug: z.string().optional(),
  chapterId: z.string().min(1, 'অধ্যায় আইডি আবশ্যক'),
  content: z.string().min(1, 'বিষয়বস্তু আবশ্যক'),
  videoUrl: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  duration: z.number().min(0).optional(),
  order: z.number().min(0).optional(),
  isPremium: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const chapterId = searchParams.get('chapterId')
    const subjectId = searchParams.get('subjectId')
    const isPremium = searchParams.get('isPremium')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (chapterId) where.chapterId = chapterId
    if (isPremium !== null && isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    if (subjectId) {
      where.chapter = { subjectId }
    }

    const [data, total] = await Promise.all([
      db.lecture.findMany({
        where,
        include: {
          chapter: {
            select: {
              id: true, name: true, slug: true, subjectId: true,
              subject: {
                select: {
                  id: true, name: true, classId: true,
                  class: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
          _count: { select: { resources: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lecture.count({ where }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Lectures')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validated = validateBody(createLectureSchema, body)
    if ('error' in validated) return validated.error
    const { data: fields } = validated      // Validate HTML block sizes before saving
    try {
      const blocks = JSON.parse(fields.content)
      if (Array.isArray(blocks)) {
        const blockErr = validateAllHtmlBlocks(blocks)
        if (blockErr) return apiError(blockErr, 422)
      }
    } catch {
      // Not block JSON content — let sanitizeForStorage handle it
    }

    const lectureSlug = fields.slug || fields.title.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-|-$/g, '')

    const data = await db.$transaction(async (tx) => {
      const created = await tx.lecture.create({
        data: {
          title: fields.title, slug: lectureSlug, chapterId: fields.chapterId, content: sanitizeForStorage(fields.content),
          videoUrl: fields.videoUrl || null, audioUrl: fields.audioUrl || null, pdfUrl: fields.pdfUrl || null,
          thumbnail: fields.thumbnail || null, duration: fields.duration ?? 0, order: fields.order ?? 0,
          isPremium: deriveIsPremium(fields.price), price: fields.price ?? 0, isActive: fields.isActive ?? true,
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_CREATE, EntityTypes.LECTURE, created.id, body, undefined, tx as never)
      return created
    })

    await invalidateContentCache('lecture')
    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Lecture')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return apiError('লেকচার ID আবশ্যক', 400)
    }

    const existing = await db.lecture.findUnique({ where: { id } })
    if (!existing) {
      return apiError('লেকচার খুঁজে পাওয়া যায়নি', 404)
    }

    const updateFields: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'slug', 'chapterId', 'content', 'videoUrl', 'audioUrl',
      'pdfUrl', 'thumbnail', 'duration', 'order', 'isPremium', 'price', 'viewCount', 'isActive',
    ]

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        // Sanitize HTML content before storage
        if (field === 'content') {
          // Validate HTML block sizes before sanitizing
          try {
            const blocks = JSON.parse(updateData[field])
            if (Array.isArray(blocks)) {
              const blockErr = validateAllHtmlBlocks(blocks)
              if (blockErr) return apiError(blockErr, 422)
            }
          } catch {
            // Not block JSON content — let sanitizeForStorage handle it
          }
          updateFields[field] = sanitizeForStorage(updateData[field])
        } else {
          updateFields[field] = updateData[field]
        }
      }
    }

    // Derive isPremium from price if price is being changed
    if (updateData.price !== undefined) {
      updateFields.isPremium = deriveIsPremium(updateData.price)
    }

    // Determine which fields actually changed
    const changedFields = Object.keys(updateFields).filter(
      key => JSON.stringify(updateFields[key]) !== JSON.stringify(existing[key as keyof typeof existing])
    )

    // Transition workflow + update content atomically
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const workflow = await db.contentWorkflow.findFirst({ where: { entityType: 'lecture', entityId: id } })

    const result = await transitionWorkflow(db as never, {
      entityType: 'lecture',
      entityId: id,
      action: 'update_content',
      userId: auth.user.id,
      userRole: auth.user.role,
      expectedVersion: workflow?.version ?? 0,
      ipAddress,
      userAgent,
      changedFields,
      contentUpdate: { data: updateFields },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    await invalidateContentCache('lecture')
    return apiResponse(result.contentRecord)
  } catch (error) {
    return handleApiError(error, 'Admin Update Lecture')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { searchParams } = new URL(request.url)

    const ids = parseIdsParam(searchParams)
    if (ids) {
      await db.$transaction(async (tx) => {
        for (const delId of ids) {
          await tx.lecture.update({
            where: { id: delId },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
        }
        await Promise.all(ids.map(id => auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, EntityTypes.LECTURE, id, undefined, undefined, tx as never)))
      })
      await invalidateContentCache('lecture')
      return apiResponse({ deleted: ids.length }, `${ids.length}টি লেকচার মুছে ফেলা হয়েছে`)
    }

    const idFromQuery = searchParams.get('id')

    let id = idFromQuery

    if (!id) {
      try {
        const body = await request.json()
        id = body.id
      } catch {
        // No body provided
      }
    }

    if (!id) {
      return apiError('লেকচার ID আবশ্যক', 400)
    }

    const existing = await db.lecture.findUnique({ where: { id } })
    if (!existing) {
      return apiError('লেকচার খুঁজে পাওয়া যায়নি', 404)
    }

    const guard = await guardDeleteDependencies('lectures', id)
    if (!guard.ok) return guard.response

    await db.$transaction(async (tx) => {
      await tx.lecture.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: auth.user.id },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, EntityTypes.LECTURE, id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('lecture')
    return apiResponse({ id }, 'লেকচার সফলভাবে মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Admin Delete Lecture')
  }
}
