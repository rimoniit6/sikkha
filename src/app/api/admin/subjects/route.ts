import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { softDelete } from '@/lib/soft-delete'
import { findSlugConflict } from '@/lib/slug-unique'

const createSubjectSchema = z.object({
  name: z.string().min(1, 'বিষয়ের নাম আবশ্যক'),
  slug: z.string().optional(),
  classId: z.string().min(1, 'শ্রেণি আবশ্যক'),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  order: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const isActive = searchParams.get('isActive')
    const q = searchParams.get('q')

    const where: Record<string, unknown> = {}
    if (classId) {
      if (!classId.startsWith('cm') || classId.length < 20) {
        const classBySlug = await db.classCategory.findFirst({ where: { slug: classId } })
        if (classBySlug) where.classId = classBySlug.id
        else where.classId = classId
      } else {
        where.classId = classId
      }
    }
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    const data = await db.subject.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, slug: true } },
        _count: { select: { chapters: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return apiResponse(data)
  } catch (error) {
    return handleApiError(error, 'Admin Get Subjects')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validation = validateBody(createSubjectSchema, body)
    if ('error' in validation) return validation.error
    const { name, slug, classId, icon, color, description, order, isActive } = validation.data

    const subjectSlug = slug || name.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-|-$/g, '')

    const conflict = await findSlugConflict('subject', { slug: subjectSlug, classId })
    if (conflict) return apiError('এই শ্রেণিতে এই স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে।', 409)

    const data = await db.$transaction(async (tx) => {
      const created = await (tx as any).subject.create({
        data: {
          name,
          slug: subjectSlug,
          classId,
          icon: icon || null,
          color: color || null,
          description: description || null,
          order: order ?? 0,
          isActive: isActive ?? true,
        },
        include: {
          class: { select: { id: true, name: true, slug: true } },
          _count: { select: { chapters: true } },
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_CREATE, 'subject', created.id, body, undefined, tx as never)
      return created
    })

    await invalidateContentCache('subject')
    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Subject')
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

    if (!id) return apiError('বিষয় ID আবশ্যক', 400)

    const existing = await db.subject.findUnique({ where: { id } })
    if (!existing) return apiError('বিষয় খুঁজে পাওয়া যায়নি', 404)

    const newSlug = updateData.slug !== undefined ? updateData.slug : existing.slug
    const newClassId = updateData.classId !== undefined ? updateData.classId : existing.classId
    if ((updateData.slug !== undefined && updateData.slug !== existing.slug) ||
        (updateData.classId !== undefined && updateData.classId !== existing.classId)) {
      const conflict = await findSlugConflict('subject', { slug: newSlug, classId: newClassId }, id)
      if (conflict) return apiError('এই শ্রেণিতে এই স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে।', 409)
    }

    const data: Record<string, unknown> = {}
    const allowedFields: string[] = ['name', 'slug', 'classId', 'icon', 'color', 'description', 'order', 'isActive']
    const nullableFields: string[] = ['icon', 'color', 'description']

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        data[field] = (nullableFields.includes(field) && updateData[field] === '') ? null : updateData[field]
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await (tx as any).subject.update({
        where: { id },
        data,
        include: {
          class: { select: { id: true, name: true, slug: true } },
          _count: { select: { chapters: true } },
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_UPDATE, 'subject', existing.id, { ...existing }, data, tx as never)
      return result
    })

    await invalidateContentCache('subject')
    return apiResponse(updated)
  } catch (error) {
    return handleApiError(error, 'Admin Update Subject')
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

    if (!id) return apiError('বিষয় ID আবশ্যক', 400)

    const existing = await db.subject.findUnique({ where: { id } })
    if (!existing) return apiError('বিষয় খুঁজে পাওয়া যায়নি', 404)

    const guard = await guardDeleteDependencies('subjects', id)
    if (!guard.ok) return guard.response

    await db.$transaction(async (tx) => {
      await softDelete(tx, 'subject', id, auth.user.id)
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, 'subject', id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('subject')
    return apiResponse({ id, message: 'বিষয় সফলভাবে মুছে ফেলা হয়েছে' })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Subject')
  }
}
