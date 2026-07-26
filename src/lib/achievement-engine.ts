/**
 * Smart Achievement Engine
 *
 * Core logic for checking, unlocking, claiming, and tracking achievements.
 * All progress is computed server-side by querying existing data sources.
 *
 * Never duplicates calculations already performed by analytics, streak, or revision engines.
 */

import { db } from '@/lib/db'
import { createInAppNotification } from '@/lib/notification-service'
import { computeUserStreak } from '@/lib/user-streak'
import {
  ACHIEVEMENTS,
  type AchievementDefinition,
  type AchievementCardData,
  type AchievementDashboardData,
  type AchievementSummary,
  type UserAchievementState,
  type CheckAchievementsResponse,
  type ClaimRewardResponse,
} from '@/types/achievements'

// ─── Progress Calculation ──────────────────────────────────────────

/**
 * Calculate current progress for a single achievement.
 * Queries the minimum data needed — reuses shared utilities where possible.
 */
async function calculateProgress(
  userId: string,
  definition: AchievementDefinition,
): Promise<{ current: number; target: number }> {
  const target = definition.target

  switch (definition.measure) {
    case 'streak': {
      const streakData = await computeUserStreak(userId)
      return { current: streakData.currentStreak, target }
    }

    case 'count': {
      // Determine which table(s) to query based on the achievement
      if (definition.id.startsWith('lecture') || definition.id === 'first-lecture') {
        const count = await db.progress.count({
          where: { userId, contentType: 'lecture', progress: { gte: 100 } },
        })
        return { current: count, target }
      }
      if (definition.id.startsWith('mcq') || definition.id === 'first-mcq') {
        const result = await db.examResult.aggregate({
          where: { userId },
          _sum: { correct: true },
        })
        const count = result._sum.correct ?? 0
        return { current: count, target }
      }
      if (definition.id.startsWith('cq') || definition.id === 'first-cq') {
        const count = await db.cQExamSubmission.count({
          where: { userId, status: { in: ['submitted', 'graded', 'published'] } },
        })
        return { current: count, target }
      }
      if (definition.id.startsWith('revision') || definition.id === 'first-revision') {
        const count = await db.revisionQueue.count({
          where: { userId, isCompleted: true },
        })
        return { current: count, target }
      }
      if (definition.id === 'first-recommendation' || definition.id.startsWith('recommendation')) {
        // Count progress entries for recommended content (lectures viewed after recommendation)
        const count = await db.progress.count({
          where: { userId, contentType: 'lecture', progress: { gte: 50 } },
        })
        return { current: Math.min(count, 1), target: 1 } // Just first one
      }
      return { current: 0, target }
    }

    case 'percentage': {
      if (definition.id === 'perfect-score') {
        const result = await db.examResult.findFirst({
          where: { userId, percentage: { gte: 99.5 } },
          select: { id: true },
        })
        return { current: result ? 100 : 0, target: 100 }
      }
      if (definition.id === 'accuracy-90') {
        const result = await db.examResult.findFirst({
          where: { userId, percentage: { gte: 90 } },
          select: { id: true },
        })
        return { current: result ? 100 : 0, target: 100 }
      }
      if (definition.id === 'recover-weak') {
        // Check average score across recent exams
        const results = await db.examResult.findMany({
          where: { userId },
          select: { percentage: true },
          take: 50,
          orderBy: { completedAt: 'desc' },
        })
        const avg = results.length > 0
          ? results.reduce((s, r) => s + r.percentage, 0) / results.length
          : 0
        return { current: Math.round(avg), target: 50 }
      }
      if (definition.id === 'improve-chapter') {
        // PROXY: Measures overall score improvement by comparing first-half vs last-half exam results.
        // Ideally this would track per-chapter improvement (e.g. from exam.chapterIds),
        // but that requires more granular data. The overall improvement trend is a reasonable v1 proxy.
        const results = await db.examResult.findMany({
          where: { userId },
          select: { percentage: true, completedAt: true },
          orderBy: { completedAt: 'asc' },
          take: 200,
        })
        if (results.length >= 2) {
          const half = Math.floor(results.length / 2)
          const firstAvg = results.slice(0, half).reduce((s, r) => s + r.percentage, 0) / half
          const lastAvg = results.slice(-half).reduce((s, r) => s + r.percentage, 0) / half
          return { current: Math.round(Math.max(0, lastAvg - firstAvg)), target: 20 }
        }
        return { current: 0, target: 20 }
      }
      return { current: 0, target: 100 }
    }

    case 'days': {
      if (definition.id.startsWith('never-miss')) {
        // Check consecutive revision completion days
        const revisions = await db.revisionQueue.findMany({
          where: { userId, isCompleted: true },
          select: { lastReviewedAt: true },
          orderBy: { lastReviewedAt: 'desc' },
          take: 30,
        })
        let streak = 0
        const checkDate = new Date()
        for (let i = 0; i < revisions.length; i++) {
          const rev = revisions[i]
          if (!rev.lastReviewedAt) break
          const revDate = rev.lastReviewedAt.toISOString().slice(0, 10)
          const expectedDate = new Date(checkDate)
          expectedDate.setDate(expectedDate.getDate() - i)
          if (revDate === expectedDate.toISOString().slice(0, 10)) {
            streak++
          } else {
            break
          }
        }
        return { current: streak, target }
      }
      if (definition.id.startsWith('active') || definition.id === 'daily-goals-30') {
        // Count active days this month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

        const [progress, exams] = await Promise.all([
          db.progress.findMany({
            where: { userId, lastAccessed: { gte: startOfMonth, lte: endOfMonth } },
            select: { lastAccessed: true },
          }),
          db.examResult.findMany({
            where: { userId, completedAt: { gte: startOfMonth, lte: endOfMonth } },
            select: { completedAt: true },
          }),
        ])

        const activeDays = new Set<string>()
        progress.forEach(p => activeDays.add(p.lastAccessed.toISOString().slice(0, 10)))
        exams.forEach(e => activeDays.add(e.completedAt.toISOString().slice(0, 10)))

        return { current: activeDays.size, target }
      }
      return { current: 0, target }
    }

    case 'hours': {
      // Sum study time from progress, exam results, and CQ submissions
      const [progress, exams, cqSubmissions] = await Promise.all([
        db.progress.findMany({
          where: { userId, contentType: 'lecture' },
          select: { lastAccessed: true },
          take: 1000,
        }),
        db.examResult.findMany({
          where: { userId },
          select: { timeTaken: true },
          take: 1000,
        }),
        db.cQExamSubmission.count({
          where: { userId, status: { in: ['submitted', 'graded', 'published'] } },
        }),
      ])

      const lectureMinutes = progress.length * 5
      const examMinutes = exams.reduce((s, e) => s + Math.round(e.timeTaken / 60), 0)
      const cqMinutes = cqSubmissions * 20
      const totalHours = Math.round((lectureMinutes + examMinutes + cqMinutes) / 60)

      return { current: totalHours, target }
    }

    case 'boolean': {
      // These require checking the hour of last activity
      // For simplicity, check the last progress entry time
      if (definition.id === 'early-bird') {
        const last = await db.progress.findFirst({
          where: { userId },
          orderBy: { lastAccessed: 'desc' },
          select: { lastAccessed: true },
        })
        if (last) {
          const hour = last.lastAccessed.getHours()
          return { current: hour >= 6 && hour <= 9 ? 1 : 0, target: 1 }
        }
        return { current: 0, target: 1 }
      }
      if (definition.id === 'night-owl') {
        const last = await db.progress.findFirst({
          where: { userId },
          orderBy: { lastAccessed: 'desc' },
          select: { lastAccessed: true },
        })
        if (last) {
          const hour = last.lastAccessed.getHours()
          return { current: hour >= 22 || hour <= 2 ? 1 : 0, target: 1 }
        }
        return { current: 0, target: 1 }
      }
      if (definition.id === 'weekend-warrior') {
        // Check if user has EVER studied on a weekend
        const weekendStudies = await db.progress.findMany({
          where: { userId },
          select: { lastAccessed: true },
          take: 100,
        })
        const studiedOnWeekend = weekendStudies.some(p => {
          const day = p.lastAccessed.getDay()
          return day === 5 || day === 6 // Friday or Saturday in Bangladesh
        })
        return { current: studiedOnWeekend ? 1 : 0, target: 1 }
      }
      return { current: 0, target: 1 }
    }

    default:
      return { current: 0, target }
  }
}

// ─── Core Engine Functions ─────────────────────────────────────────

/**
 * Check and update progress for a single achievement.
 * Returns the updated user achievement state.
 */
export async function checkAchievement(
  userId: string,
  achievementId: string,
): Promise<UserAchievementState> {
  const definition = ACHIEVEMENTS.find(a => a.id === achievementId)
  if (!definition) {
    throw new Error(`Unknown achievement: ${achievementId}`)
  }

  const { current, target } = await calculateProgress(userId, definition)
  const progressPercent = Math.min(100, Math.round((current / target) * 100))
  const isUnlocked = progressPercent >= 100

  // Upsert the user achievement record
  const existing = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  })

  let record: typeof existing
  if (existing) {
    record = await db.userAchievement.update({
      where: { id: existing.id },
      data: {
        progress: progressPercent,
        unlocked: isUnlocked ? true : existing.unlocked,
        unlockedAt: isUnlocked && !existing.unlocked ? new Date() : existing.unlockedAt,
        metadata: JSON.stringify({ current, target }),
      },
    })
  } else {
    record = await db.userAchievement.create({
      data: {
        userId,
        achievementId,
        progress: progressPercent,
        unlocked: isUnlocked,
        unlockedAt: isUnlocked ? new Date() : null,
        metadata: JSON.stringify({ current, target }),
      },
    })
  }

  // Send notification on new unlock
  if (isUnlocked && (!existing || !existing.unlocked)) {
    await createInAppNotification(db as any, {
      userId,
      title: `🎉 ${definition.title}`,
      message: `আপনি "${definition.title}" অর্জন করেছেন! ${definition.description}`,
      type: 'SUCCESS',
      priority: 'medium',
      category: `achievement-${achievementId}`,
      link: '/dashboard',
    })
  }

  return {
    achievementId: record.achievementId,
    progress: record.progress,
    unlocked: record.unlocked,
    unlockedAt: record.unlockedAt?.toISOString() ?? null,
    claimedAt: record.claimedAt?.toISOString() ?? null,
    metadata: record.metadata,
  }
}

/**
 * Check all achievements for a user.
 * Returns any newly unlocked achievement IDs.
 */
export async function checkAllAchievements(userId: string): Promise<CheckAchievementsResponse> {
  // Run all achievement checks in parallel to avoid N+1
  const results = await Promise.allSettled(
    ACHIEVEMENTS.map(def => checkAchievement(userId, def.id)),
  )

  // Detect newly unlocked achievements
  const newUnlocks: string[] = []
  const existingRecords = await db.userAchievement.findMany({
    where: { userId, unlocked: true },
    select: { achievementId: true, createdAt: true, updatedAt: true },
  })
  const recordMap = new Map(existingRecords.map(r => [r.achievementId, r]))

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') continue
    const record = recordMap.get(ACHIEVEMENTS[i].id)
    if (record && record.createdAt.getTime() === record.updatedAt.getTime()) {
      newUnlocks.push(ACHIEVEMENTS[i].id)
    }
  }

  return { success: true, newUnlocks }
}

/**
 * Claim a reward for an unlocked achievement.
 */
export async function claimReward(
  userId: string,
  achievementId: string,
): Promise<ClaimRewardResponse> {
  const record = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  })

  if (!record) {
    throw new Error('Achievement not found')
  }
  if (!record.unlocked) {
    throw new Error('Achievement is not yet unlocked')
  }
  if (record.claimedAt) {
    throw new Error('Reward already claimed')
  }

  const now = new Date()
  await db.userAchievement.update({
    where: { id: record.id },
    data: { claimedAt: now },
  })

  return { success: true, claimedAt: now.toISOString() }
}

/**
 * Get the full achievement dashboard data for a user.
 */
export async function getAchievementDashboard(userId: string): Promise<AchievementDashboardData> {
  const userRecords = await db.userAchievement.findMany({
    where: { userId },
  })

  const recordMap = new Map(userRecords.map(r => [r.achievementId, r]))

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

  const achievements: AchievementCardData[] = await Promise.all(
    ACHIEVEMENTS.map(async (def) => {
      const record = recordMap.get(def.id)
      let userState: UserAchievementState | null = null
      let progressPercent: number

      if (record) {
        userState = {
          achievementId: record.achievementId,
          progress: record.progress,
          unlocked: record.unlocked,
          unlockedAt: record.unlockedAt?.toISOString() ?? null,
          claimedAt: record.claimedAt?.toISOString() ?? null,
          metadata: record.metadata,
        }
        progressPercent = record.progress
      } else {
        // Compute progress on-the-fly for unstarted achievements
        const { current, target } = await calculateProgress(userId, def)
        progressPercent = Math.min(100, Math.round((current / target) * 100))
      }

      return {
        definition: def,
        userState,
        progressPercent,
        isNewlyUnlocked: !!(
          userState?.unlocked &&
          userState.unlockedAt &&
          new Date(userState.unlockedAt) > sevenDaysAgo
        ),
      }
    }),
  )

  const unlocked = achievements.filter(a => a.userState?.unlocked)
  const claimed = achievements.filter(a => a.userState?.claimedAt)
  const recentUnlocks = achievements.filter(a => a.isNewlyUnlocked)

  const summary: AchievementSummary = {
    totalCount: ACHIEVEMENTS.length,
    unlockedCount: unlocked.length,
    claimedCount: claimed.length,
    completionPercent: Math.round((unlocked.length / ACHIEVEMENTS.length) * 100),
    recentUnlocks,
  }

  return { achievements, summary }
}
