import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { softDelete } from '@/lib/soft-delete'

const createChapterSchema = z.object({
  name: z.string().min(1, 'অধ্যায়ের নাম আবশ্যক'),
  slug: z.string().optional(),
  subjectId: z.string().min(1, 'বিষয় আবশ্যক'),
  order: z.number().min(0).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')
    const isActive = searchParams.get('isActive')
    const q = searchParams.get('q')

    const where: Record<string, unknown> = {}
    if (subjectId) where.subjectId = subjectId
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    const data = await db.chapter.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, slug: true, classId: true } },
        _count: { select: { lectures: true, mcqs: true, cqs: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return apiResponse(data)
  } catch (error) {
    return handleApiError(error, 'Admin Get Chapters')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validation = validateBody(createChapterSchema, body)
    if ('error' in validation) return validation.error
    const { name, slug, subjectId, order, description, isActive } = validation.data

    const chapterSlug = slug || name.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-|-$/g, '')

    const existingSlug = await db.chapter.findFirst({
      where: { slug: chapterSlug, subjectId },
    })
    if (existingSlug) return apiError('এই বিষয়ে এই স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে।', 409)

    const data = await db.$transaction(async (tx) => {
      const created = await (tx as any).chapter.create({
        data: {
          name,
          slug: chapterSlug,
          subjectId,
          order: order ?? 0,
          description: description || null,
          isActive: isActive ?? true,
        },
        include: {
          subject: { select: { id: true, name: true, slug: true, classId: true } },
          _count: { select: { lectures: true, mcqs: true, cqs: true } },
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_CREATE, 'chapter', created.id, body, undefined, tx as never)
      return created
    })

    await invalidateContentCache('chapter')
    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Chapter')
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

    if (!id) return apiError('অধ্যায় ID আবশ্যক', 400)

    const existing = await db.chapter.findUnique({ where: { id } })
    if (!existing) return apiError('অধ্যায় খুঁজে পাওয়া যায়নি', 404)

    const newSlug = updateData.slug !== undefined ? updateData.slug : existing.slug
    const newSubjectId = updateData.subjectId !== undefined ? updateData.subjectId : existing.subjectId
    if ((updateData.slug !== undefined && updateData.slug !== existing.slug) ||
        (updateData.subjectId !== undefined && updateData.subjectId !== existing.subjectId)) {
      const slugExists = await db.chapter.findFirst({
        where: { slug: newSlug, subjectId: newSubjectId, NOT: { id } },
      })
      if (slugExists) return apiError('এই বিষয়ে এই স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে।', 409)
    }

    const data: Record<string, unknown> = {}
    const allowedFields: string[] = ['name', 'slug', 'subjectId', 'order', 'description', 'isActive']
    const nullableFields: string[] = ['description']

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = (nullableFields.includes(field) && updateData[field] === '') ? null : updateData[field]
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await (tx as any).chapter.update({
        where: { id },
        data,
        include: {
          subject: { select: { id: true, name: true, slug: true, classId: true } },
          _count: { select: { lectures: true, mcqs: true, cqs: true } },
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_UPDATE, 'chapter', existing.id, { ...existing }, data, tx as never)
      return result
    })

    await invalidateContentCache('chapter')
    return apiResponse(updated)
  } catch (error) {
    return handleApiError(error, 'Admin Update Chapter')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')

    if (!id) {
      const body = await request.json().catch(() => ({}))
      id = body.id
    }

    if (!id) return apiError('অধ্যায় ID আবশ্যক', 400)

    const existing = await db.chapter.findUnique({ where: { id } })
    if (!existing) return apiError('অধ্যায় খুঁজে পাওয়া যায়নি', 404)

    const guard = await guardDeleteDependencies('chapters', id)
    if (!guard.ok) return guard.response

    await db.$transaction(async (tx) => {
      await softDelete(tx, 'chapter', id, auth.user.id)
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, 'chapter', id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('chapter')
    return apiResponse({ id, message: 'অধ্যায় সফলভাবে মুছে ফেলা হয়েছে' })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Chapter')
  }
}
