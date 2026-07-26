import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { generateNotificationsForContext } from '@/lib/intelligent-notifications'

/**
 * POST /api/user/notifications/generate
 *
 * Triggers intelligent notification generation for the authenticated user.
 * Delegates to the context-based process endpoint for consistency.
 *
 * Body: { context?: string } (optional — defaults to "daily-check")
 * Contexts: "dashboard-load", "revision-complete", "login", etc.
 *
 * Smart deduplication prevents spam (same category within 24h).
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'প্রমাণীকরণ প্রয়োজন।' },
        { status: 401 },
      )
    }

    const userId = auth.user.id
    const body = await request.json().catch(() => ({ context: 'daily-check' }))
    const context: string = body?.context || 'daily-check'

    const result = await generateNotificationsForContext(userId, context)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, 'Notification generation error:')
  }
}
