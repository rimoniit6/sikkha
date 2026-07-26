import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, withAuth } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/student/notifications
 *
 * Returns notifications for the authenticated student.
 * Supports pagination and unread count.
 */
export async function GET(request: Request) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const userId = auth.user.id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: Record<string, unknown> = { userId }
    if (unreadOnly) where.isRead = false

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          priority: true,
          isRead: true,
          link: true,
          createdAt: true,
        },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId, isRead: false } }),
    ])

    return apiResponse({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'Student Get Notifications')
  }
}

/**
 * PATCH /api/student/notifications
 *
 * Mark notification(s) as read.
 */
export async function PATCH(request: Request) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const userId = auth.user.id
    const body = await request.json()
    const { ids, markAll } = body as { ids?: string[]; markAll?: boolean }

    if (markAll) {
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })
      return apiResponse({ marked: true })
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiError('নোটিফিকেশন ID আবশ্যক', 400)
    }

    // Only update notifications belonging to this user
    await db.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { isRead: true },
    })

    return apiResponse({ marked: ids.length })
  } catch (error) {
    return handleApiError(error, 'Student Mark Notifications')
  }
}
