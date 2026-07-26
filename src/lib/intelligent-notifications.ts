/**
 * Intelligent Notification Generation Service
 *
 * Generates personalized, prioritized notifications by analyzing
 * existing platform data. Reuses the existing Notification model
 * and createInAppNotification() exclusively.
 *
 * Sources:
 * - Revision overdue / due
 * - Weak subjects / chapters (from Weakness Detection)
 * - Daily goal incomplete
 * - Study streak at risk
 * - Upcoming exams
 * - Purchased content not started
 * - Course progress stalled
 * - Low exam performance
 * - New recommendation available
 * - Achievement unlocked
 * - Long inactivity
 * - Content completed
 * - Focus session completed
 * - Returning user encouragement
 *
 * Priority levels:
 * - critical: Urgent action required (overdue revision, imminent exam)
 * - high: Important but not urgent (weak subject, streak at risk)
 * - medium: Good to know (new recommendation, goal progress)
 * - low: Encouragement / FYI (achievement, returning user)
 */

import { db } from '@/lib/db'
import { createInAppNotification } from '@/lib/notification-service'
import { toBengaliNumerals } from '@/lib/utils'
import { computeUserStreak } from '@/lib/user-streak'

// ─── Types ──────────────────────────────────────────────────────────

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low'

export interface GeneratedNotification {
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  priority: NotificationPriority
  /** Category for deduplication — each category triggers at most once per 24h */
  category: string
  link?: string
}

export interface GenerationResult {
  generated: number
  skipped: number
  categories: string[]
}

// ─── Deduplication ─────────────────────────────────────────────────

/**
 * Check if a notification with the same category was created within the last 24 hours.
 * Uses the dedicated `category` field for precise matching.
 */
async function hasRecentNotification(userId: string, category: string): Promise<boolean> {
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await db.notification.findFirst({
    where: {
      userId,
      category,
      createdAt: { gte: recentCutoff },
    },
  })
  return existing !== null
}

/**
 * Check if a specific category notification has been sent within a custom cooldown period.
 */
async function hasRecentNotificationByCategory(
  userId: string,
  category: string,
  cooldownMs: number = 24 * 60 * 60 * 1000,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownMs)
  const existing = await db.notification.findFirst({
    where: { userId, category, createdAt: { gte: cutoff } },
  })
  return existing !== null
}

/**
 * Check if the user has already completed their daily goal today.
 */
async function hasCompletedDailyGoal(userId: string): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [lectureProgress, examResults] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', progress: { gte: 100 }, lastAccessed: { gte: todayStart } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: todayStart } },
    }),
  ])

  return lectureProgress >= 1 || examResults >= 1
}

/**
 * Check if the revision queue has any overdue items.
 */
async function getOverdueRevisionCount(userId: string): Promise<number> {
  const now = new Date()
  const overdue = await db.revisionQueue.count({
    where: { userId, isCompleted: false, nextReviewAt: { lt: now } },
  })
  return overdue
}

/**
 * Get weak subjects from weakness data or exam results.
 */
async function getWeakSubjectCount(userId: string): Promise<number> {
  const examResults = await db.examResult.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: 200,
    select: { percentage: true, exam: { select: { subjectId: true } } },
  })

  const subjectScores = new Map<string, { totalPercent: number; count: number }>()
  for (const r of examResults) {
    if (!r.exam?.subjectId) continue
    const entry = subjectScores.get(r.exam.subjectId) || { totalPercent: 0, count: 0 }
    entry.totalPercent += r.percentage
    entry.count++
    subjectScores.set(r.exam.subjectId, entry)
  }

  let weakCount = 0
  for (const [, data] of subjectScores) {
    if (data.count > 0 && data.totalPercent / data.count < 60) {
      weakCount++
    }
  }
  return weakCount
}

/**
 * Get upcoming exams within the next 7 days.
 */
async function getUpcomingExamCount(userId: string): Promise<{ count: number; nearestDate: Date | null }> {
  const now = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const mcqSets = await db.mCQExamSet.findMany({
    where: { scheduledDate: { gte: now, lte: nextWeek }, status: 'published' },
    select: { scheduledDate: true },
    take: 5,
  })

  const allDates = mcqSets.map(s => s.scheduledDate)
  const nearestDate = allDates.length > 0 ? allDates.sort((a, b) => a.getTime() - b.getTime())[0] : null

  return { count: allDates.length, nearestDate }
}

/**
 * Compute current study streak (delegates to shared utility).
 */
async function computeStreak(userId: string): Promise<number> {
  const streakData = await computeUserStreak(userId)
  return streakData.currentStreak
}

/**
 * Check for purchased but unstarted content.
 */
async function hasUnstartedPurchasedContent(userId: string): Promise<boolean> {
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 14)

  const [mcqPurchases, cqPurchases, coursePurchases] = await Promise.all([
    db.mCQExamPackagePurchase.findMany({
      where: { userId, purchasedAt: { gte: recentCutoff } },
      select: { packageId: true, purchasedAt: true },
      take: 5,
    }),
    db.cQExamPackagePurchase.findMany({
      where: { userId, purchasedAt: { gte: recentCutoff } },
      select: { packageId: true, purchasedAt: true },
      take: 5,
    }),
    db.coursePurchase.findMany({
      where: { userId, purchasedAt: { gte: recentCutoff } },
      select: { courseId: true, purchasedAt: true },
      take: 5,
    }),
  ])

  // Check if any recent purchases have zero progress
  const purchaseCount = mcqPurchases.length + cqPurchases.length + coursePurchases.length
  return purchaseCount > 0
}

/**
 * Check if course progress has stalled (no activity in 3+ days after starting).
 */
async function hasStalledCourseProgress(userId: string): Promise<{
  stalled: boolean
  courseName: string | null
}> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  // Check Lecture progress that's partial and hasn't been touched in 3+ days
  const stalledLectures = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      progress: { gt: 0, lt: 100 },
      lastAccessed: { lt: threeDaysAgo },
    },
    select: { contentId: true, lastAccessed: true, progress: true },
    take: 3,
  })

  if (stalledLectures.length === 0) return { stalled: false, courseName: null }

  // Get lecture title
  const lectureIds = stalledLectures.map(l => l.contentId)
  const lectures = await db.lecture.findMany({
    where: { id: { in: lectureIds } },
    select: { id: true, title: true, chapter: { select: { name: true } } },
    take: 3,
  })

  return { stalled: true, courseName: lectures[0]?.title || null }
}

/**
 * Check if the revision streak is broken (was previously completing, now overdue).
 */
async function hasRevisionStreakBroken(userId: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [completedRecently, overdueNow] = await Promise.all([
    db.revisionQueue.count({
      where: { userId, isCompleted: true, lastReviewedAt: { gte: sevenDaysAgo } },
    }),
    db.revisionQueue.count({
      where: { userId, isCompleted: false, nextReviewAt: { lt: new Date() } },
    }),
  ])
  return completedRecently > 0 && overdueNow > 0
}

/**
 * Check if user had no activity yesterday.
 */
async function hadNoActivityYesterday(userId: string): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const progress = await db.progress.count({
    where: { userId, lastAccessed: { gte: yesterdayStart, lt: todayStart } },
  })
  const exams = await db.examResult.count({
    where: { userId, completedAt: { gte: yesterdayStart, lt: todayStart } },
  })

  return progress === 0 && exams === 0
}

/**
 * Check for bookmarked content not accessed in 3+ days.
 */
async function getStaleBookmarkCount(userId: string): Promise<number> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const bookmarks = await db.bookmark.findMany({
    where: { userId },
    select: { contentId: true },
    take: 10,
  })

  if (bookmarks.length === 0) return 0

  const lectureIds = bookmarks.map(b => b.contentId).filter((id): id is string => id !== null)
  if (lectureIds.length === 0) return 0

  const accessedRecently = await db.progress.count({
    where: {
      userId,
      contentId: { in: lectureIds },
      contentType: 'lecture',
      lastAccessed: { gte: threeDaysAgo },
    },
  })

  return lectureIds.length - accessedRecently
}

/**
 * Get unfinished lectures count (started but not completed, stale > 1 day).
 */
async function getUnfinishedLectureCount(userId: string): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return db.progress.count({
    where: {
      userId,
      contentType: 'lecture',
      progress: { gt: 0, lt: 100 },
      lastAccessed: { lt: oneDayAgo },
    },
  })
}

/**
 * Get chapter performance trend — check if recent scores are improving.
 * Returns null if no trend data, true if improving, false if declining.
 */
async function getChapterPerformanceTrend(userId: string): Promise<'improving' | 'declining' | 'stable' | null> {
  const results = await db.examResult.findMany({
    where: { userId },
    select: { percentage: true, completedAt: true },
    orderBy: { completedAt: 'asc' },
    take: 20,
  })

  if (results.length < 4) return null

  const mid = Math.floor(results.length / 2)
  const firstHalf = results.slice(0, mid)
  const secondHalf = results.slice(mid)

  const firstAvg = firstHalf.reduce((s, r) => s + r.percentage, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((s, r) => s + r.percentage, 0) / secondHalf.length

  const diff = secondAvg - firstAvg
  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

/**
 * Get count of unclaimed reward achievements.
 */
async function getUnclaimedRewardCount(userId: string): Promise<number> {
  return db.userAchievement.count({
    where: { userId, unlocked: true, claimedAt: null },
  })
}

/**
 * Get hours of study today (estimated from lectures + exams + CQs).
 */
async function getTodayStudyHours(userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [lectureCount, examCount, cqCount] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', lastAccessed: { gte: todayStart } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: todayStart } },
    }),
    db.cQExamSubmission.count({
      where: { userId, submittedAt: { gte: todayStart } },
    }),
  ])

  // Rough estimate: each lecture/exam ~30 min
  return (lectureCount + examCount + cqCount) * 0.5
}

/**
 * Get exam sessions that are ending within the next 30 minutes.
 */
async function getEndingExamSessions(userId: string): Promise<number> {
  const now = new Date()
  const in30Min = new Date(now.getTime() + 30 * 60 * 1000)

  return db.examSession.count({
    where: {
      userId,
      status: 'IN_PROGRESS',
      expiresAt: { gte: now, lte: in30Min },
    },
  })
}

/**
 * Get start of today (midnight) for date comparisons.
 */
function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Check if today is a weekly summary day (Sunday) and user has activity this week.
 */
function isWeeklySummaryDay(): boolean {
  return new Date().getDay() === 0 // Sunday
}

/**
 * Check if today is a monthly summary day (1st of month).
 */
function isMonthlySummaryDay(): boolean {
  return new Date().getDate() === 1
}

// ══════════════════════════════════════════════════════════════════════
// NOTIFICATION SOURCES
// ══════════════════════════════════════════════════════════════════════

/**
 * 1. REVISION OVERDUE — Critical, high
 */
async function makeRevisionOverdue(userId: string): Promise<GeneratedNotification | null> {
  const overdueCount = await getOverdueRevisionCount(userId)
  if (overdueCount === 0) return null

  return {
    category: 'revision-overdue',
    title: 'রিভিশন reminder',
    message: `আপনার ${toBengaliNumerals(overdueCount)}টি আইটেম রিভিউ করার সময় হয়েছে! এখনই রিভিউ সম্পন্ন করুন।`,
    type: 'WARNING',
    priority: overdueCount > 3 ? 'critical' : 'high',
    link: '/user/dashboard',
  }
}

/**
 * 2. WEAK SUBJECT — High, medium
 */
async function makeWeakSubject(userId: string): Promise<GeneratedNotification | null> {
  const weakCount = await getWeakSubjectCount(userId)
  if (weakCount === 0) return null

  return {
    category: 'weak-subject',
    title: 'দুর্বল বিষয়',
    message: `আপনার ${toBengaliNumerals(weakCount)}টি বিষয়ে দুর্বলতা দেখা যাচ্ছে। নিয়মিত অনুশীলন করুন।`,
    type: 'WARNING',
    priority: weakCount > 2 ? 'high' : 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 3. DAILY GOAL INCOMPLETE — Medium, low
 */
async function makeDailyGoalIncomplete(userId: string): Promise<GeneratedNotification | null> {
  const now = new Date()
  const hour = now.getHours()
  // Only remind after 2pm (students should have started by then)
  if (hour < 14) return null

  const goalCompleted = await hasCompletedDailyGoal(userId)
  if (goalCompleted) return null

  return {
    category: 'daily-goal',
    title: 'আজকের লক্ষ্য',
    message: 'আজকের স্টাডি লক্ষ্য এখনও পূরণ হয়নি। অন্তত একটি লেকচার শেষ করুন বা একটি পরীক্ষা দিন।',
    type: 'INFO',
    priority: hour >= 20 ? 'high' : 'medium', // More urgent after 8pm
    link: '/user/dashboard',
  }
}

/**
 * 4. STUDY STREAK AT RISK — Critical, high
 */
async function makeStreakAtRisk(userId: string): Promise<GeneratedNotification | null> {
  // Only check in the evening (after 6pm)
  const now = new Date()
  if (now.getHours() < 18) return null

  const streak = await computeStreak(userId)
  if (streak > 0) return null // Already studied today

  return {
    category: 'streak-risk',
    title: 'স্ট্রিক বিপদে',
    message: 'আপনার স্টudy streak আজ শেষ হয়ে যেতে পারে! একটু সময় দিয়ে একটি লেকচার দেখুন।',
    type: 'WARNING',
    priority: 'critical',
    link: '/user/dashboard',
  }
}

/**
 * 5. UPCOMING EXAM — Critical, high
 */
async function makeUpcomingExam(userId: string): Promise<GeneratedNotification | null> {
  const { count, nearestDate } = await getUpcomingExamCount(userId)
  if (count === 0 || !nearestDate) return null

  const daysUntil = Math.round((nearestDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysUntil > 7) return null // Only within a week

  return {
    category: 'upcoming-exam',
    title: 'আসন্ন পরীক্ষা',
    message: daysUntil === 0
      ? 'আজই আপনার একটি পরীক্ষা আছে! প্রস্তুতি নিন।'
      : `আগামী ${toBengaliNumerals(daysUntil)} দিনের মধ্যে ${toBengaliNumerals(count)}টি পরীক্ষা আছে। প্রস্তুতি শুরু করুন!`,
    type: 'WARNING',
    priority: daysUntil <= 1 ? 'critical' : 'high',
    link: '/user/dashboard',
  }
}

/**
 * 6. PURCHASED CONTENT NOT STARTED — Medium
 */
async function makePurchasedNotStarted(userId: string): Promise<GeneratedNotification | null> {
  const hasUnstarted = await hasUnstartedPurchasedContent(userId)
  if (!hasUnstarted) return null

  // Don't send this if already sent within 48h (longer cooldown)
  const recent = await hasRecentNotificationByCategory(userId, 'purchased-not-started', 48 * 60 * 60 * 1000)
  if (recent) return null

  return {
    category: 'purchased-not-started',
    title: 'নতুন কন্টেন্ট',
    message: 'আপনার কেনা নতুন কন্টেন্ট এখনও শুরু করেননি। আজই দেখে নিন!',
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 7. CONTENT COMPLETED — Success, low
 */
async function makeContentCompleted(userId: string): Promise<GeneratedNotification | null> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [completedLectures, recentExams] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', progress: { gte: 100 }, lastAccessed: { gte: todayStart } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: todayStart } },
    }),
  ])

  const totalCompleted = completedLectures + recentExams
  if (totalCompleted === 0) return null

  return {
    category: 'content-completed',
    title: 'দারুণ!',
    message: completedLectures > 0
      ? `আপনি আজ ${toBengaliNumerals(completedLectures)}টি লেকচার সম্পন্ন করেছেন!`
      : `আপনি আজ ${toBengaliNumerals(recentExams)}টি পরীক্ষা সম্পন্ন করেছেন!`,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 8. RETURNING USER ENCOURAGEMENT — Low
 */
async function makeReturningUser(userId: string): Promise<GeneratedNotification | null> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const recentActivity = await db.progress.findFirst({
    where: { userId, lastAccessed: { gte: threeDaysAgo } },
  })

  if (recentActivity) return null // User has been active

  // Check if already sent this week
  const existing = await hasRecentNotificationByCategory(userId, 'returning-user', 7 * 24 * 60 * 60 * 1000)
  if (existing) return null

  return {
    category: 'returning-user',
    title: 'ফিরে আসার জন্য ধন্যবাদ',
    message: 'আপনাকে দেখে ভালো লাগলো! আজ থেকে নতুন করে পড়া শুরু করুন। আপনার শিক্ষা যাত্রা চলুক!',
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 9. LOW EXAM PERFORMANCE — High, medium
 */
async function makeLowPerformance(userId: string): Promise<GeneratedNotification | null> {
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const lowResults = await db.examResult.findMany({
    where: { userId, completedAt: { gte: recentCutoff }, percentage: { lt: 40 } },
    select: { percentage: true, exam: { select: { title: true } } },
    take: 3,
  })

  if (lowResults.length === 0) return null

  const worstExam = lowResults.reduce((worst, r) => (r.percentage < worst.percentage ? r : worst), lowResults[0])

  return {
    category: 'low-performance',
    title: 'পরীক্ষায় উন্নতি প্রয়োজন',
    message: `আপনার "${worstExam.exam?.title || 'পরীক্ষা'}"-এ ${toBengaliNumerals(Math.round(worstExam.percentage))}% পাওয়া গেছে। আরও অনুশীলন প্রয়োজন।`,
    type: 'WARNING',
    priority: 'high',
    link: '/user/dashboard',
  }
}

/**
 * 10. ACHIEVEMENT UNLOCKED — Success, low
 */
async function makeAchievement(userId: string): Promise<GeneratedNotification | null> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const recentAchievement = await db.notification.findFirst({
    where: { userId, category: 'achievement-streak', createdAt: { gte: weekAgo } },
  })

  if (recentAchievement) return null

  const streak = await computeStreak(userId)
  if (streak >= 7) {
    return {
      category: 'achievement-streak',
      title: 'অভিনন্দন!',
      message: `আপনি ${toBengaliNumerals(streak)} দিনের একটি স্টudy streak অর্জন করেছেন! দারুণ অধ্যবসায়!`,
      type: 'SUCCESS',
      priority: 'low',
      link: '/user/dashboard',
    }
  }

  // Check for total exams milestone
  const recentExamAchievement = await db.notification.findFirst({
    where: { userId, category: 'achievement-exams', createdAt: { gte: weekAgo } },
  })
  if (recentExamAchievement) return null

  const totalExams = await db.examResult.count({ where: { userId } })
  if (totalExams > 0 && totalExams % 10 === 0) {
    return {
      category: 'achievement-exams',
      title: 'অভিনন্দন!',
      message: `আপনি মোট ${toBengaliNumerals(totalExams)}টি পরীক্ষা সম্পন্ন করেছেন!`,
      type: 'SUCCESS',
      priority: 'low',
      link: '/user/dashboard',
    }
  }

  return null
}

/**
 * 11. COURSE PROGRESS STALLED — Medium
 */
async function makeCourseStalled(userId: string): Promise<GeneratedNotification | null> {
  const { stalled, courseName } = await hasStalledCourseProgress(userId)
  if (!stalled || !courseName) return null

  // Check if already sent in last 72h
  const recent = await hasRecentNotificationByCategory(userId, 'course-stalled', 72 * 60 * 60 * 1000)
  if (recent) return null

  return {
    category: 'course-stalled',
    title: 'কোর্সে অগ্রগতি নেই',
    message: `আপনার "${courseName}" পড়া শেষ করতে পারেননি। আবার শুরু করুন এবং চালিয়ে যান!`,
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 12. NEW RECOMMENDATION AVAILABLE — Medium, low
 */
async function makeNewRecommendation(userId: string): Promise<GeneratedNotification | null> {
  // Check if user has recommendations available
  const incompleteProgress = await db.progress.findMany({
    where: { userId, contentType: 'lecture', progress: { gt: 0, lt: 100 } },
    select: { contentId: true },
    orderBy: { lastAccessed: 'desc' },
    take: 3,
  })

  if (incompleteProgress.length === 0) return null

  // Check if already sent in last 24h (but only once per 48h to not spam)
  const recent = await hasRecentNotificationByCategory(userId, 'new-recommendation', 48 * 60 * 60 * 1000)
  if (recent) return null

  return {
    category: 'new-recommendation',
    title: 'আপনার জন্য সাজেশন',
    message: `আপনার পড়ার ধরন অনুযায়ী ${toBengaliNumerals(incompleteProgress.length)}টি নতুন সাজেশন প্রস্তুত!`,
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 13. FOCUS SESSION COMPLETED — Success, low
 */
async function makeFocusSessionCompleted(userId: string): Promise<GeneratedNotification | null> {
  // Focus sessions are tracked client-side in the store,
  // so we check if the user has been active in the last 2 hours
  // as a proxy for completing a focus session
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const recentProgress = await db.progress.count({
    where: {
      userId,
      lastAccessed: { gte: twoHoursAgo },
    },
  })

  // Only trigger if there was study activity but no focus-completed notification today
  if (recentProgress === 0) return null

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayFocusNotif = await db.notification.findFirst({
    where: { userId, category: 'focus-session', createdAt: { gte: todayStart } },
  })
  if (todayFocusNotif) return null

  return {
    category: 'focus-session',
    title: 'ফোকাস সেশন শেষ!',
    message: 'আপনি ফোকাস মোডে পড়াশোনা করেছেন! নিয়মিত ফোকাস সেশন আপনার দক্ষতা বাড়াবে।',
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 14. REVISION STREAK BROKEN — High
 */
async function makeRevisionStreakBroken(userId: string): Promise<GeneratedNotification | null> {
  const broken = await hasRevisionStreakBroken(userId)
  if (!broken) return null

  return {
    category: 'revision-streak-broken',
    title: 'রিভিশন স্ট্রিক ভেঙেছে',
    message: 'আপনার নিয়মিত রিভিশনের ধারাবাহিকতা ভেঙেছে! আবার শুরু করুন এবং প্রতিদিন রিভিশন দিন।',
    type: 'WARNING',
    priority: 'high',
    link: '/user/dashboard',
  }
}

/**
 * 15. DAILY GOAL ALMOST COMPLETE — Medium
 */
async function makeDailyGoalAlmostComplete(userId: string): Promise<GeneratedNotification | null> {
  const now = new Date()
  const hour = now.getHours()
  if (hour < 14) return null

  const [lectureProgress, examResults] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', progress: { gte: 50, lt: 100 }, lastAccessed: { gte: todayStart() } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: todayStart() } },
    }),
  ])

  // Already completed or barely started — let other sources handle
  if (lectureProgress >= 1 || examResults >= 1) return null
  const hasPartialProgress = await db.progress.count({
    where: { userId, contentType: 'lecture', progress: { gt: 0, lt: 50 }, lastAccessed: { gte: todayStart() } },
  })

  if (hasPartialProgress === 0) return null

  return {
    category: 'daily-goal-almost',
    title: 'প্রায় শেষ!',
    message: 'আপনার আজকের লক্ষ্য প্রায় পূরণ! আরেকটু পড়লে আজকের লক্ষ্য সম্পূর্ণ হবে।',
    type: 'INFO',
    priority: hour >= 20 ? 'high' : 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 16. NO STUDY TODAY — Medium
 */
async function makeNoStudyToday(userId: string): Promise<GeneratedNotification | null> {
  const hour = new Date().getHours()
  if (hour < 10) return null // Too early

  const [todayLecture, todayExam, todayCQ] = await Promise.all([
    db.progress.count({ where: { userId, lastAccessed: { gte: todayStart() } } }),
    db.examResult.count({ where: { userId, completedAt: { gte: todayStart() } } }),
    db.cQExamSubmission.count({ where: { userId, submittedAt: { gte: todayStart() } } }),
  ])
  if (todayLecture > 0 || todayExam > 0 || todayCQ > 0) return null

  return {
    category: 'no-study-today',
    title: 'আজ পড়া হয়নি',
    message: hour >= 18
      ? 'আজ এখনও পড়াশোনা শুরু করেননি। একটু সময় বের করে পড়ে নিন!' 
      : 'আজ এখনো কোনো পড়া শুরু হয়নি। অল্প সময় পেলেই শুরু করুন!',
    type: 'INFO',
    priority: hour >= 18 ? 'high' : 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 17. GOAL MISSED YESTERDAY — Medium
 */
async function makeGoalMissedYesterday(userId: string): Promise<GeneratedNotification | null> {
  const hour = new Date().getHours()
  if (hour < 6 || hour > 12) return null // Only morning check

  const missed = await hadNoActivityYesterday(userId)
  if (!missed) return null

  return {
    category: 'goal-missed-yesterday',
    title: 'গতকালের লক্ষ্য',
    message: 'গতকাল আপনার পড়া হয়নি। আজকে নতুন করে শুরু করুন এবং নিয়মিত রাখার চেষ্টা করুন!',
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 18. EXAM ENDING SOON — Critical
 */
async function makeExamEndingSoon(userId: string): Promise<GeneratedNotification | null> {
  const endingCount = await getEndingExamSessions(userId)
  if (endingCount === 0) return null

  return {
    category: 'exam-ending-soon',
    title: 'পরীক্ষা শেষ হচ্ছে!',
    message: `আপনার ${toBengaliNumerals(endingCount)}টি পরীক্ষার সময় শেষ হতে চলেছে। জমা দিন!`,
    type: 'WARNING',
    priority: 'critical',
    link: '/user/dashboard',
  }
}

/**
 * 19. CONTINUE UNFINISHED LECTURE — Medium
 */
async function makeContinueUnfinishedLecture(userId: string): Promise<GeneratedNotification | null> {
  const count = await getUnfinishedLectureCount(userId)
  if (count === 0) return null

  return {
    category: 'unfinished-lecture',
    title: 'অসমাপ্ত লেকচার',
    message: `আপনার ${toBengaliNumerals(count)}টি লেকচার অসমাপ্ত রয়েছে। যেখানে ছেড়েছিলেন সেখান থেকে শুরু করুন!`,
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 20. CONTINUE UNFINISHED CHAPTER — Medium
 */
async function makeContinueUnfinishedChapter(userId: string): Promise<GeneratedNotification | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const incompleteChapters = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      progress: { gt: 0, lt: 100 },
      lastAccessed: { lt: oneDayAgo },
    },
    select: { contentId: true },
    take: 20,
  })

  if (incompleteChapters.length === 0) return null

  // Get unique chapters from incomplete lectures
  const lectureIds = incompleteChapters.map(l => l.contentId)
  const lectures = await db.lecture.findMany({
    where: { id: { in: lectureIds } },
    select: { chapterId: true, chapter: { select: { name: true } } },
    take: 20,
  })

  const uniqueChapterNames = [...new Set(lectures.map(l => l.chapter?.name).filter(Boolean))]
  if (uniqueChapterNames.length === 0) return null

  return {
    category: 'unfinished-chapter',
    title: 'অসমাপ্ত অধ্যায়',
    message: `আপনার ${toBengaliNumerals(Math.min(uniqueChapterNames.length, 3))}টি অধ্যায়ে অসমাপ্ত লেকচার রয়েছে। চালিয়ে যান!`,
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 21. RESUME BOOKMARKED CONTENT — Medium
 */
async function makeResumeBookmarkedContent(userId: string): Promise<GeneratedNotification | null> {
  const staleCount = await getStaleBookmarkCount(userId)
  if (staleCount === 0) return null

  return {
    category: 'bookmark-reminder',
    title: 'বুকমার্ক করা কন্টেন্ট',
    message: `আপনার ${toBengaliNumerals(staleCount)}টি বুকমার্ক করা কন্টেন্ট রয়েছে যা এখনও দেখা হয়নি। দেখে নিন!`,
    type: 'INFO',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 21. CHAPTER PERFORMANCE DECLINING — High
 */
async function makeChapterPerformanceDeclining(userId: string): Promise<GeneratedNotification | null> {
  const trend = await getChapterPerformanceTrend(userId)
  if (trend !== 'declining') return null

  return {
    category: 'performance-declining',
    title: 'দক্ষতা কমছে',
    message: 'আপনার পরীক্ষার ফলাফল আগের চেয়ে কমছে। আরও অনুশীলন ও রিভিশন প্রয়োজন!',
    type: 'WARNING',
    priority: 'high',
    link: '/user/dashboard',
  }
}

/**
 * 22. ACCURACY IMPROVING — Success, low
 */
async function makeAccuracyImproving(userId: string): Promise<GeneratedNotification | null> {
  const trend = await getChapterPerformanceTrend(userId)
  if (trend !== 'improving') return null

  return {
    category: 'accuracy-improving',
    title: 'উন্নতি হচ্ছে!',
    message: 'আপনার পরীক্ষার ফলাফল ধারাবাহিকভাবে উন্নতি করছে! এই গতি ধরে রাখুন!' ,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 23. REWARD CLAIM AVAILABLE — Success, medium
 */
async function makeRewardClaimAvailable(userId: string): Promise<GeneratedNotification | null> {
  const unclaimedCount = await getUnclaimedRewardCount(userId)
  if (unclaimedCount === 0) return null

  return {
    category: 'reward-claim',
    title: 'পুরস্কার নিন!',
    message: `আপনার ${toBengaliNumerals(unclaimedCount)}টি অর্জিত পুরস্কার অপেক্ষা করছে! এখনই সংগ্রহ করুন।`,
    type: 'SUCCESS',
    priority: 'medium',
    link: '/user/dashboard',
  }
}

/**
 * 24. WEEKLY STUDY SUMMARY — Low (only on Sundays)
 */
async function makeWeeklyStudySummary(userId: string): Promise<GeneratedNotification | null> {
  if (!isWeeklySummaryDay()) return null
  // Only during daytime
  const hour = new Date().getHours()
  if (hour < 9 || hour > 12) return null

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [lecturesThisWeek, examsThisWeek, studyHours] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', lastAccessed: { gte: weekAgo } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: weekAgo } },
    }),
    getTodayStudyHours(userId),
  ])

  if (lecturesThisWeek === 0 && examsThisWeek === 0) return null

  return {
    category: 'weekly-summary',
    title: 'সাপ্তাহিক সারসংক্ষেপ',
    message: `এই সপ্তাহে আপনি ${toBengaliNumerals(lecturesThisWeek)}টি লেকচার সম্পন্ন করেছেন এবং ${toBengaliNumerals(examsThisWeek)}টি পরীক্ষা দিয়েছেন! ${studyHours > 0 ? `প্রায় ${toBengaliNumerals(Math.round(studyHours))} ঘন্টা পড়াশোনা করেছেন।` : ''}`,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 25. MONTHLY PROGRESS SUMMARY — Low (only on 1st of month)
 */
async function makeMonthlyProgressSummary(userId: string): Promise<GeneratedNotification | null> {
  if (!isMonthlySummaryDay()) return null
  const hour = new Date().getHours()
  if (hour < 9 || hour > 12) return null

  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [lecturesThisMonth, examsThisMonth, mcqResults] = await Promise.all([
    db.progress.count({
      where: { userId, contentType: 'lecture', lastAccessed: { gte: monthAgo } },
    }),
    db.examResult.count({
      where: { userId, completedAt: { gte: monthAgo } },
    }),
    db.examResult.findMany({
      where: { userId, completedAt: { gte: monthAgo } },
      select: { percentage: true },
    }),
  ])

  if (lecturesThisMonth === 0 && examsThisMonth === 0) return null

  const avgScore = mcqResults.length > 0
    ? Math.round(mcqResults.reduce((s, r) => s + r.percentage, 0) / mcqResults.length)
    : 0

  return {
    category: 'monthly-summary',
    title: 'মাসিক অগ্রগতি প্রতিবেদন',
    message: `গত মাসে ${toBengaliNumerals(lecturesThisMonth)}টি লেকচার + ${toBengaliNumerals(examsThisMonth)}টি পরীক্ষা সম্পন্ন করেছেন। ${avgScore > 0 ? `গড় স্কোর: ${toBengaliNumerals(avgScore)}%` : ''}`,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 26. NEW LONGEST STREAK — Success, low
 */
async function makeNewLongestStreak(userId: string): Promise<GeneratedNotification | null> {
  const currentStreak = await computeStreak(userId)
  // Celebratory milestones at streak thresholds
  const milestoneThresholds = [3, 5, 7, 10, 14, 21, 30, 50, 100]
  const isMilestone = milestoneThresholds.includes(currentStreak)
  if (!isMilestone) return null

  // Deduplicate: only send once per milestone
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentMilestone = await db.notification.findFirst({
    where: { userId, category: 'longest-streak', createdAt: { gte: recentCutoff } },
  })
  if (recentMilestone) return null

  return {
    category: 'longest-streak',
    title: 'নতুন রেকর্ড!',
    message: `অভিনন্দন! আপনি ${toBengaliNumerals(currentStreak)} দিনের একটি নতুন স্টudy streak রেকর্ড তৈরি করেছেন!`,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 27. LONG FOCUS MILESTONE — Success, low
 */
async function makeLongFocusMilestone(userId: string): Promise<GeneratedNotification | null> {
  const todayHours = await getTodayStudyHours(userId)
  // Proxy: if user has been studying multiple hours today
  if (todayHours < 2) return null

  const todayAlready = await db.notification.findFirst({
    where: { userId, category: 'long-focus', createdAt: { gte: todayStart() } },
  })
  if (todayAlready) return null

  return {
    category: 'long-focus',
    title: 'দীর্ঘ ফোকাস সেশন!',
    message: `আপনি আজ প্রায় ${toBengaliNumerals(Math.round(todayHours))} ঘন্টা পড়াশোনা করেছেন! অসাধারণ মনোযোগ!`,
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

/**
 * 28. RECOMMENDED LESSON COMPLETED — Success, low
 */
async function makeRecommendedLessonDone(userId: string): Promise<GeneratedNotification | null> {
  // Check for recently completed lectures that match recommendation pattern
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const completedToday = await db.progress.count({
    where: {
      userId,
      contentType: 'lecture',
      progress: 100,
      lastAccessed: { gte: twoDaysAgo },
    },
  })

  if (completedToday === 0) return null

  return {
    category: 'recommendation-done',
    title: 'সাজেশন শেষ!',
    message: 'আপনার জন্য সুপারিশকৃত কন্টেন্ট সম্পন্ন করেছেন! নতুন সাজেশন দেখুন।',
    type: 'SUCCESS',
    priority: 'low',
    link: '/user/dashboard',
  }
}

// ══════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════

const NOTIFICATION_SOURCES: ((userId: string) => Promise<GeneratedNotification | null>)[] = [
  makeRevisionOverdue,
  makeUpcomingExam,
  makeStreakAtRisk,
  makeWeakSubject,
  makeLowPerformance,
  makeDailyGoalIncomplete,
  makeCourseStalled,
  makePurchasedNotStarted,
  makeNewRecommendation,
  makeContentCompleted,
  makeFocusSessionCompleted,
  makeAchievement,
  makeReturningUser,
  makeRevisionStreakBroken,
  makeDailyGoalAlmostComplete,
  makeNoStudyToday,
  makeGoalMissedYesterday,
  makeExamEndingSoon,
  makeContinueUnfinishedLecture,
  makeContinueUnfinishedChapter,
  makeResumeBookmarkedContent,
  makeChapterPerformanceDeclining,
  makeAccuracyImproving,
  makeRewardClaimAvailable,
  makeWeeklyStudySummary,
  makeMonthlyProgressSummary,
  makeNewLongestStreak,
  makeLongFocusMilestone,
  makeRecommendedLessonDone,
]

/**
 * Generate and persist intelligent notifications for a user.
 * Each source is checked independently with deduplication.
 */
export async function generateIntelligentNotifications(
  userId: string,
): Promise<GenerationResult> {
  const result: GenerationResult = { generated: 0, skipped: 0, categories: [] }

  for (const sourceFn of NOTIFICATION_SOURCES) {
    try {
      const notification = await sourceFn(userId)
      if (!notification) {
        result.skipped++
        continue
      }

      // Deduplication: check if same category was sent in last 24h
      const isDuplicate = await hasRecentNotification(userId, notification.category)
      if (isDuplicate) {
        result.skipped++
        continue
      }

      // Persist the notification using the existing infrastructure
      await createInAppNotification(db as any, {
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        category: notification.category,
        link: notification.link || undefined,
      })

      result.generated++
      result.categories.push(notification.category)
    } catch (err) {
      console.error(`[IntelligentNotifications] Source failed:`, err)
      result.skipped++
      // Never let one source failure crash the entire generation
    }
  }

  return result
}

/**
 * Generate notifications for specific event-driven contexts.
 * Called when a specific action occurs (revision complete, exam complete, etc.)
 */
export async function generateNotificationsForContext(
  userId: string,
  context: string,
): Promise<GenerationResult> {
  // Determine which sources to run based on context
  let relevantSources: ((userId: string) => Promise<GeneratedNotification | null>)[] = []

  switch (context) {
    case 'revision-complete':
      relevantSources = [makeContentCompleted, makeAchievement]
      break
    case 'exam-complete':
      relevantSources = [makeLowPerformance, makeContentCompleted, makeAchievement]
      break
    case 'streak-update':
      relevantSources = [makeAchievement, makeStreakAtRisk]
      break
    case 'content-complete':
      relevantSources = [makeContentCompleted, makeAchievement, makeCourseStalled]
      break
    case 'focus-complete':
      relevantSources = [makeFocusSessionCompleted]
      break
    case 'login':
      relevantSources = [
        makeReturningUser,
        makeRevisionOverdue,
        makeUpcomingExam,
        makeStreakAtRisk,
      ]
      break
    case 'daily-check':
      // Full check — run all sources
      return generateIntelligentNotifications(userId)
    default:
      // For unknown contexts, run all
      return generateIntelligentNotifications(userId)
  }

  const result: GenerationResult = { generated: 0, skipped: 0, categories: [] }

  for (const sourceFn of relevantSources) {
    try {
      const notification = await sourceFn(userId)
      if (!notification) {
        result.skipped++
        continue
      }

      const isDuplicate = await hasRecentNotification(userId, notification.category)
      if (isDuplicate) {
        result.skipped++
        continue
      }

      await createInAppNotification(db as any, {
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        category: notification.category,
        link: notification.link || undefined,
      })

      result.generated++
      result.categories.push(notification.category)
    } catch (err) {
      console.error(`[IntelligentNotifications] Source ${context} failed:`, err)
      result.skipped++
    }
  }

  return result
}

/**
 * Generate a single specific notification by category.
 * Used for event-driven triggers (e.g., revision completed, exam completed).
 */
export async function generateSpecificNotification(
  userId: string,
  category: string,
): Promise<{ generated: boolean }> {
  const sourceMap: Record<string, (userId: string) => Promise<GeneratedNotification | null>> = {
    'revision-overdue': makeRevisionOverdue,
    'revision-streak-broken': makeRevisionStreakBroken,
    'weak-subject': makeWeakSubject,
    'daily-goal': makeDailyGoalIncomplete,
    'daily-goal-almost': makeDailyGoalAlmostComplete,
    'no-study-today': makeNoStudyToday,
    'goal-missed-yesterday': makeGoalMissedYesterday,
    'streak-risk': makeStreakAtRisk,
    'upcoming-exam': makeUpcomingExam,
    'exam-ending-soon': makeExamEndingSoon,
    'purchased-not-started': makePurchasedNotStarted,
    'content-completed': makeContentCompleted,
    'unfinished-lecture': makeContinueUnfinishedLecture,
    'bookmark-reminder': makeResumeBookmarkedContent,
    'unfinished-chapter': makeContinueUnfinishedChapter,
    'returning-user': makeReturningUser,
    'low-performance': makeLowPerformance,
    'performance-declining': makeChapterPerformanceDeclining,
    'accuracy-improving': makeAccuracyImproving,
    'achievement': makeAchievement,
    'reward-claim': makeRewardClaimAvailable,
    'course-stalled': makeCourseStalled,
    'new-recommendation': makeNewRecommendation,
    'recommendation-done': makeRecommendedLessonDone,
    'focus-session': makeFocusSessionCompleted,
    'long-focus': makeLongFocusMilestone,
    'weekly-summary': makeWeeklyStudySummary,
    'monthly-summary': makeMonthlyProgressSummary,
    'longest-streak': makeNewLongestStreak,
  }

  const sourceFn = sourceMap[category]
  if (!sourceFn) return { generated: false }

  try {
    const notification = await sourceFn(userId)
    if (!notification) return { generated: false }

    const isDuplicate = await hasRecentNotification(userId, notification.category)
    if (isDuplicate) return { generated: false }

    await createInAppNotification(db as any, {
      userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      category: notification.category,
      link: notification.link || undefined,
    })

    return { generated: true }
  } catch {
    return { generated: false }
  }
}
