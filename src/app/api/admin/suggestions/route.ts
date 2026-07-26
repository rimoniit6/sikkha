import { apiResponse,parseIdsParam,validateBody,withAdmin,withCsrf } from '@/lib/api-utils'
import { auditFromRequest, AuditActions, getClientIP } from '@/lib/audit'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { deriveIsPremium } from '@/lib/premium'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { transitionWorkflow } from '@/lib/workflow'

const createSuggestionSchema = z.object({
  title: z.string().min(1, 'শিরোনাম আবশ্যক'),
  slug: z.string().optional(),
  content: z.string().min(1, 'বিষয়বস্তু আবশ্যক'),
  classId: z.string().nullable().optional(),
  subjectId: z.string().nullable().optional(),
  chapterId: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  isPremium: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  order: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const classId = searchParams.get('classId')
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const isPremium = searchParams.get('isPremium')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId
    if (chapterId) where.chapterId = chapterId
    if (isPremium !== null && isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    const [suggestions, total] = await Promise.all([
      db.suggestion.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.suggestion.count({ where }),
    ])

    // Enrich with class/subject/chapter names
    const classIds = [...new Set(suggestions.map((s) => s.classId).filter(Boolean) as string[])]
    const subjectIds = [...new Set(suggestions.map((s) => s.subjectId).filter(Boolean) as string[])]
    const chapterIds = [...new Set(suggestions.map((s) => s.chapterId).filter(Boolean) as string[])]

    const [classes, subjects, chapters] = await Promise.all([
      classIds.length > 0
        ? db.classCategory.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, slug: true } })
        : [],
      subjectIds.length > 0
        ? db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, slug: true, classId: true } })
        : [],
      chapterIds.length > 0
        ? db.chapter.findMany({ where: { id: { in: chapterIds } }, select: { id: true, name: true, slug: true, subjectId: true } })
        : [],
    ])

    const classMap = new Map(classes.map((c) => [c.id, c]))
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))
    const chapterMap = new Map(chapters.map((ch) => [ch.id, ch]))

    const enriched = suggestions.map((s) => ({
      ...s,
      class: s.classId ? classMap.get(s.classId) || null : null,
      subject: s.subjectId ? subjectMap.get(s.subjectId) || null : null,
      chapter: s.chapterId ? chapterMap.get(s.chapterId) || null : null,
    }))

    return apiResponse({
      suggestions: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Suggestions error')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validation = validateBody(createSuggestionSchema, body)
    if ('error' in validation) return validation.error
    const { title, slug, content, classId, subjectId, chapterId, thumbnail, pdfUrl, isPremium, price, order, isActive } = validation.data

    const suggestionSlug = slug || title.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-|-$/g, '')

    const data = await db.$transaction(async (tx) => {
      const created = await tx.suggestion.create({
        data: {
          title,
          slug: suggestionSlug,
          content,
          classId: classId || null,
          subjectId: subjectId || null,
          chapterId: chapterId || null,
          thumbnail: thumbnail || null,
          pdfUrl: pdfUrl || null,
          isPremium: deriveIsPremium(price),
          price: price ?? 0,
          order: order ?? 0,
          isActive: isActive ?? true,
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.SUGGESTION_CREATE, 'suggestion', created.id, body as Record<string, unknown>, { title: created.title } as Record<string, unknown>, tx as never)
      return created
    })

    await invalidateContentCache('suggestion')
    return apiResponse(data, null, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Suggestion error')
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
      return apiResponse(null, 'সাজেশন ID আবশ্যক', 400)
    }

    const existing = await db.suggestion.findUnique({ where: { id } })
    if (!existing) {
      return apiResponse(null, 'সাজেশন খুঁজে পাওয়া যায়নি', 404)
    }

    const data: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'slug', 'content', 'classId', 'subjectId', 'chapterId',
      'thumbnail', 'pdfUrl', 'isPremium', 'price', 'order', 'viewCount',
      'isActive',
    ]

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field]
      }
    }

    // Derive isPremium from price if price is being changed
    if (updateData.price !== undefined) {
      data.isPremium = deriveIsPremium(updateData.price)
    }

    // Determine which fields actually changed
    const changedFields = Object.keys(data).filter(
      key => JSON.stringify(data[key]) !== JSON.stringify(existing[key as keyof typeof existing])
    )

    // Transition workflow + update content atomically
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const workflow = await db.contentWorkflow.findFirst({ where: { entityType: 'suggestion', entityId: id } })

    const result = await transitionWorkflow(db as never, {
      entityType: 'suggestion',
      entityId: id,
      action: 'update_content',
      userId: auth.user.id,
      userRole: auth.user.role,
      expectedVersion: workflow?.version ?? 0,
      ipAddress,
      userAgent,
      changedFields,
      contentUpdate: { data },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    await invalidateContentCache('suggestion')
    return apiResponse(result.contentRecord)
  } catch (error) {
    return handleApiError(error, 'Admin Update Suggestion error')
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
          await tx.suggestion.update({
            where: { id: delId },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
        }
        await auditFromRequest(request, auth.user.id, AuditActions.SUGGESTION_DELETE, 'suggestion', ids.join(','), undefined, { count: ids.length } as Record<string, unknown>, tx as never)
      })
      await invalidateContentCache('suggestion')
      return apiResponse({ deleted: ids.length }, `${ids.length}টি সফলভাবে মুছে ফেলা হয়েছে`)
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
      return apiResponse(null, 'সাজেশন ID আবশ্যক', 400)
    }

    const existing = await db.suggestion.findUnique({ where: { id } })
    if (!existing) {
      return apiResponse(null, 'সাজেশন খুঁজে পাওয়া যায়নি', 404)
    }

    const guard = await guardDeleteDependencies('suggestions', id)
    if (!guard.ok) return guard.response

    await db.$transaction(async (tx) => {
      await tx.suggestion.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: auth.user.id },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.SUGGESTION_DELETE, 'suggestion', id, existing as Record<string, unknown>, undefined, tx as never)
    })

    await invalidateContentCache('suggestion')
    return apiResponse({ id }, 'সাজেশন সফলভাবে মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Admin Delete Suggestion error')
  }
}
