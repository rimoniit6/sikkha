import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { getAchievementDashboard, checkAllAchievements } from '@/lib/achievement-engine'

/**
 * GET /api/user/achievements
 *
 * Returns the user's complete achievement dashboard:
 * - All achievements (with/without progress)
 * - Summary statistics
 * - Recently unlocked
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'প্রমাণীকরণ প্রয়োজন।' }, { status: 401 })
    }

    const data = await getAchievementDashboard(auth.user.id)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Achievements GET error:')
  }
}

/**
 * POST /api/user/achievements
 *
 * Triggers a full check of all achievements.
 * Returns any newly unlocked achievement IDs.
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'প্রমাণীকরণ প্রয়োজন।' }, { status: 401 })
    }

    const result = await checkAllAchievements(auth.user.id)
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'Achievements POST error:')
  }
}
