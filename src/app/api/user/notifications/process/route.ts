import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { generateNotificationsForContext } from '@/lib/intelligent-notifications'

/**
 * POST /api/user/notifications/process
 *
 * Event-driven notification generation for specific contexts.
 * Generates only relevant notifications based on the context.
 *
 * Body: { context: string }
 * Contexts: "revision-complete", "exam-complete", "streak-update",
 *           "content-complete", "focus-complete", "login", "daily-check"
 *
 * Features:
 * - Context-aware source selection (only runs relevant generators)
 * - Deduplication (same category within 24h is skipped)
 * - Best-effort (never throws, never blocks the caller)
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
    const body = await request.json().catch(() => ({ context: '' }))
    const context: string = body?.context || 'daily-check'

    // Validate context
    const validContexts = [
      'revision-complete', 'exam-complete', 'streak-update',
      'content-complete', 'focus-complete', 'login', 'daily-check',
    ]
    if (!validContexts.includes(context)) {
      return NextResponse.json(
        { success: false, error: 'অবৈধ কনটেক্সট।' },
        { status: 400 },
      )
    }

    const result = await generateNotificationsForContext(userId, context)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, 'Notification process error:')
  }
}
