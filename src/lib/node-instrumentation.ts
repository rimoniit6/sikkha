/**
 * Node.js-Only Instrumentation
 *
 * This file contains ALL Node.js runtime-specific initialization code:
 * - Process signal handlers (SIGTERM, SIGINT)
 * - Process error handlers (uncaughtException, unhandledRejection)
 * - Graceful shutdown orchestration
 * - Automation worker startup
 * - Super admin seeding
 *
 * This file is ONLY imported inside instrumentation.ts behind a
 * `process.env.NEXT_RUNTIME !== 'nodejs'` guard, so it never
 * executes in Edge Runtime.
 */

import { db } from '@/lib/db'
import logger from '@/lib/logger'
import { registerProcessHandlers } from '@/lib/process-handlers.node'

export async function initializeNodeRuntime(): Promise<void> {
  // ─── Process error handlers ──────────────────────────────────
  registerProcessHandlers()

  logger.info('Application starting (Node.js runtime)', {
    context: 'instrumentation',
    nodeEnv: process.env.NODE_ENV,
  })

  // ─── Wire SIGTERM / SIGINT for graceful shutdown ────────────
  const shutdown = async (signal: string) => {
    logger.info(`Shutdown signal received: ${signal}`, { context: 'graceful-shutdown' })
    try {
      await db.$disconnect()
      logger.info('ডাটাবেস সংযোগ বিচ্ছিন্ন হয়েছে', { context: 'graceful-shutdown' })
    } catch {
      // db.$disconnect may already be handled by beforeExit in db.ts
    }
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // ─── Seed super admin ────────────────────────────────────────
  try {
    const { ensureSuperAdmin } = await import('@/lib/seed-super-admin')
    await ensureSuperAdmin(db as unknown as import('@prisma/client').PrismaClient)
    logger.info('Super admin seed completed', { context: 'instrumentation' })
  } catch (err) {
    logger.error('Super admin seed failed', err, { context: 'instrumentation' })
  }

  logger.info('Application ready (Node.js runtime)', {
    context: 'instrumentation',
  })
}
