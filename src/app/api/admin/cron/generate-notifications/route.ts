export const maxDuration = 300 // 5 minutes for batch user processing

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { generateIntelligentNotifications } from '@/lib/intelligent-notifications'
import { verifyAuth } from '@/lib/auth'
import crypto from 'crypto'

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * POST /api/admin/cron/generate-notifications
 *
 * Batch notification generation for all active users.
 * Designed to be called by a cron job (e.g., once daily at 10am and 6pm).
 *
 * Auth: Requires SUPER_ADMIN or ADMIN role (can be triggered by cron with API key)
 *
 * Performance:
 * - Processes users in batches of 50
 * - Each user's generation runs independently (failures don't cascade)
 * - Uses Promise.allSettled for concurrent user processing
 * - Returns summary of generated/skipped per user
 *
 * Response: { success: true, data: { totalUsers, processed, summary } }
 */
export async function POST(request: Request) {
  try {
    // Allow admin auth or a valid cron secret
    const auth = await verifyAuth(request)
    const cronSecret = request.headers.get('x-cron-secret')

    const isValidCronCall =
      (cronSecret && process.env.CRON_SECRET && timingSafeCompare(cronSecret, process.env.CRON_SECRET)) ||
      (cronSecret && process.env.CRON_JWT_SECRET && timingSafeCompare(cronSecret, process.env.CRON_JWT_SECRET))

    if (!auth && !isValidCronCall) {
      return NextResponse.json(
        { success: false, error: 'অননুমোদিত অ্যাক্সেস।' },
        { status: 401 },
      )
    }

    if (auth && !auth.isAdmin && !auth.isSuperAdmin && !isValidCronCall) {
      return NextResponse.json(
        { success: false, error: 'এই কাজের জন্য অনুমতি নেই।' },
        { status: 403 },
      )
    }

    // Fetch all active student users in batches
    const totalUsers = await db.user.count({
      where: { role: 'STUDENT' },
    })

    const BATCH_SIZE = 50
    const results: Array<{ userId: string; generated: number; skipped: number }> = []

    for (let offset = 0; offset < totalUsers; offset += BATCH_SIZE) {
      const users = await db.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true },
        skip: offset,
        take: BATCH_SIZE,
      })

      const batchResults = await Promise.allSettled(
        users.map(async (user) => {
          const result = await generateIntelligentNotifications(user.id)
          return { userId: user.id, generated: result.generated, skipped: result.skipped }
        }),
      )

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          results.push({ userId: 'unknown', generated: 0, skipped: 0 })
        }
      }
    }

    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0)
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        processed: results.length,
        totalGenerated,
        totalSkipped,
        summary: results,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Cron notification generation error:')
  }
}
