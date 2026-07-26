import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, parseIdsParam, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { auditFromRequest, AuditActions } from '@/lib/audit'

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (contentType) where.contentType = contentType
    if (userId) where.userId = userId
    if (search) where.content = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
      db.note.count({ where }),
    ])

    return apiResponse({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Notes')
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
      const result = await db.$transaction(async (tx) => {
        const deleted = await tx.note.deleteMany({ where: { id: { in: ids } } })
        await auditFromRequest(request, auth.user.id, AuditActions.NOTE_DELETE, 'note', ids[0], undefined, undefined, tx as never)
        return deleted
      })
      return apiResponse({ deleted: result.count }, `${result.count}টি সফলভাবে মুছে ফেলা হয়েছে`)
    }

    let id = searchParams.get('id')

    if (!id) {
      const body = await request.json().catch(() => ({}))
      id = body.id
    }

    if (!id) return apiError('নোট ID আবশ্যক', 400)

    const existing = await db.note.findUnique({ where: { id } })
    if (!existing) return apiError('নোট খুঁজে পাওয়া যায়নি', 404)

    await db.$transaction(async (tx) => {
      await tx.note.delete({ where: { id } })
      await auditFromRequest(request, auth.user.id, AuditActions.NOTE_DELETE, 'note', id, existing as Record<string, unknown>, undefined, tx as never)
    })

    return apiResponse({ id, message: 'নোট সফলভাবে মুছে ফেলা হয়েছে' })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Note')
  }
}
