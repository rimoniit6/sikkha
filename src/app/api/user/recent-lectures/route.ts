import { db } from '@/lib/db'
import { apiError } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getClassLevelForUserId } from '@/lib/class-filter'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return apiError('প্রমাণীকরণ প্রয়োজন', 401)
    }

    const userId = auth.user.id
    const limit = 10
    const classLevel = await getClassLevelForUserId(userId)

    const rawItems = await db.recentlyViewed.findMany({
      where: { userId, contentType: 'lecture' },
      orderBy: { viewedAt: 'desc' },
      take: 50,
      select: { contentId: true, title: true, viewedAt: true },
    })

    const seen = new Set<string>()
    const recentItems: typeof rawItems = []
    for (const item of rawItems) {
      if (!seen.has(item.contentId)) {
        seen.add(item.contentId)
        recentItems.push(item)
      }
      if (recentItems.length >= limit * 2) break // overfetch for class filtering
    }

    if (recentItems.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const lectureIds = recentItems.map(item => item.contentId)

    const lectures = await db.lecture.findMany({
      where: {
        id: { in: lectureIds },
        isActive: true,
        ...(classLevel ? { chapter: { subject: { class: { slug: classLevel } } } } : {}),
      },
      select: {
        id: true,
        title: true,
        chapter: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    })

    const lectureMap = new Map(lectures.map(l => [l.id, l]))

    const progressRecords = await db.progress.findMany({
      where: { userId, contentType: 'lecture', contentId: { in: lectures.map(l => l.id) } },
      select: { contentId: true, progress: true },
    })

    const progressMap = new Map(progressRecords.map(p => [p.contentId, p.progress]))

    const result = recentItems
      .filter(item => lectureMap.has(item.contentId))
      .slice(0, limit)
      .map(item => {
        const lecture = lectureMap.get(item.contentId)
        return {
          id: item.contentId,
          title: item.title || lecture?.title || 'অজানা লেকচার',
          subject: lecture?.chapter?.subject?.name || '',
          chapter: lecture?.chapter?.name || '',
          progress: progressMap.get(item.contentId) ?? 0,
          viewedAt: item.viewedAt,
        }
      })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, 'Recent lectures error:')
  }
}
