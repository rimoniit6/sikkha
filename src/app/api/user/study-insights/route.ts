import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { generateStudyInsights } from '@/lib/study-insights-engine'
import type { InsightsPeriod } from '@/types/study-insights'

/**
 * GET /api/user/study-insights?period=30d
 *
 * Returns comprehensive study insights, learning health score,
 * predictions, and consistency analysis for the authenticated user.
 *
 * All data is generated algorithmically from existing platform data.
 * No AI API required.
 *
 * Query params:
 *   period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 *
 * Response:
 * {
 *   healthScore: { overall, components, trend },
 *   insights: [{ id, category, title, message, impact, ... }],
 *   predictions: [{ id, title, description, confidence, ... }],
 *   consistency: { daily, weekly, monthly, overall },
 *   generatedAt: ISO date
 * }
 *
 * Performance:
 * - All aggregations run in parallel via Promise.all
 * - Results can be cached for 5 minutes
 * - Subject name queries use an in-memory cache
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'প্রমাণীকরণ প্রয়োজন।' },
        { status: 401 },
      )
    }

    const userId = auth.user.id
    const { searchParams } = new URL(request.url)
    const periodParam = (searchParams.get('period') || '30d')
    const period: InsightsPeriod = ['7d', '30d', '90d', 'all'].includes(periodParam)
      ? (periodParam as InsightsPeriod)
      : '30d'

    const data = await generateStudyInsights(userId, period)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Study insights error:')
  }
}
