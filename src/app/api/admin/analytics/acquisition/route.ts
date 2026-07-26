import { db } from '@/lib/db'
import { apiResponse, withAdmin } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import type { AcquisitionData } from '@/types/analytics'

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

    const fromDate = new Date(from)
    const toDate = new Date(to + 'T23:59:59.999Z')

    // SAFE: Count users with/without password hash rather than loading
    // password hashes into memory. Password presence distinguishes
    // email signups (has password) from social/organic signups (no password).
    const [emailSignups, totalUsers, referralEvents, campaignEvents] = await Promise.all([
      db.user.count({
        where: { createdAt: { gte: fromDate, lte: toDate }, NOT: { password: null } },
      }),
      db.user.count({
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
      db.analyticsEvent.count({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          OR: [
            { eventType: { contains: 'referral' } },
            { eventName: { contains: 'referral' } },
          ],
        },
      }),
      db.analyticsEvent.count({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          OR: [
            { eventType: { contains: 'campaign' } },
            { eventName: { contains: 'campaign' } },
          ],
        },
      }),
    ])

    const organicCount = totalUsers - emailSignups
    const denominator = totalUsers || 1
    const toPercent = (v: number) => Math.round((v / denominator) * 100 * 100) / 100

    const signupSource = [
      { source: 'email', count: emailSignups, percentage: toPercent(emailSignups) },
      { source: 'organic', count: organicCount, percentage: toPercent(organicCount) },
    ]

    return apiResponse({
      signupSource,
      emailSignup: emailSignups,
      referral: referralEvents,
      organic: organicCount,
      campaign: campaignEvents,
    } satisfies AcquisitionData)
  } catch (error) {
    return handleApiError(error, 'Acquisition Analytics')
  }
}
