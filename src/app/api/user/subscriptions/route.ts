import { db } from '@/lib/db'
import { apiResponse, withAuth, applyRateLimit } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { getServerClassLabelMap } from '@/lib/hierarchy-labels'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const rateLimit = await applyRateLimit(apiLimiter, request)
  if ('error' in rateLimit) return rateLimit.error

  try {
    const userId = auth.user.id

    const subscriptions = await db.userSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        packageId: true,
        classLevel: true,
        startDate: true,
        endDate: true,
        isActive: true,
        paymentId: true,
        package: {
          select: { id: true, title: true, durationLabel: true, thumbnail: true },
        },
      },
      orderBy: { endDate: 'desc' },
    })

    const classLabelMap = await getServerClassLabelMap()

    const enriched = subscriptions.map(sub => {
      const now = new Date()
      const isExpired = sub.endDate < now
      const daysRemaining = Math.max(0, Math.ceil((sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

      return {
        id: sub.id,
        packageId: sub.packageId,
        packageName: sub.package.title,
        packageThumbnail: sub.package.thumbnail,
        durationLabel: sub.package.durationLabel,
        classLevel: sub.classLevel,
        classLabel: classLabelMap[sub.classLevel] || sub.classLevel,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive && !isExpired,
        isExpired,
        daysRemaining,
        paymentId: sub.paymentId,
      }
    })

    const expiringSoon = enriched.filter(s => !s.isExpired && s.daysRemaining <= 7)

    return apiResponse({
      subscriptions: enriched,
      activeCount: enriched.filter(s => !s.isExpired).length,
      expiringSoon,
    })
  } catch (error) {
    return handleApiError(error, 'Get subscriptions')
  }
}
