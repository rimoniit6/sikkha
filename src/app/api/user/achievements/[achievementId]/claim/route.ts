import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { claimReward } from '@/lib/achievement-engine'

/**
 * PATCH /api/user/achievements/:achievementId/claim
 *
 * Claim the reward for an unlocked achievement.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ achievementId: string }> },
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'প্রমাণীকরণ প্রয়োজন।' }, { status: 401 })
    }

    const { achievementId } = await params
    const result = await claimReward(auth.user.id, achievementId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'দাবি করতে সমস্যা হয়েছে।'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
