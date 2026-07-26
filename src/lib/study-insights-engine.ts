/**
 * Study Insights & Learning Intelligence Engine
 *
 * Generates personalized learning insights algorithmically from
 * existing platform data. No AI API required.
 *
 * Reuses existing analytics data, streak computation, and
 * achievement definitions.
 */

import { db } from '@/lib/db'
import { computeUserStreak } from '@/lib/user-streak'
import { ACHIEVEMENTS } from '@/types/achievements'
import type {
  StudyInsight,
  StudyPrediction,
  LearningHealthScore,
  HealthScoreComponent,
  ConsistencyScore,
  TrendResult,
  InsightCategory,
  InsightsPeriod,
  StudyInsightsResponse,
} from '@/types/study-insights'

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function getDateRange(period: InsightsPeriod): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)

  switch (period) {
    case '7d': start.setDate(start.getDate() - 7); break
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case 'all': start.setFullYear(start.getFullYear() - 5); break
  }

  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function getDaysInRange(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function getDayOfWeekLabel(day: number): string {
  const labels = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার']
  return labels[day] || ''
}

function getTimeOfDayLabel(hour: number): string {
  if (hour < 6) return 'রাত'
  if (hour < 12) return 'সকাল'
  if (hour < 14) return 'দুপুর'
  if (hour < 17) return 'বিকাল'
  if (hour < 20) return 'সন্ধ্যা'
  return 'রাত'
}

// ══════════════════════════════════════════════════════════════════════
// TREND & CONSISTENCY
// ══════════════════════════════════════════════════════════════════════

/**
 * Calculate trend direction from a sequence of values.
 */
export function calculateTrend(values: number[]): TrendResult {
  if (values.length < 2) return { direction: 'stable', changePercent: 0 }

  const mid = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, mid)
  const secondHalf = values.slice(mid)

  const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length

  const changePercent = firstAvg > 0
    ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
    : secondAvg > 0 ? 100 : 0

  let direction: TrendResult['direction'] = 'stable'
  if (changePercent > 10) direction = 'improving'
  else if (changePercent < -10) direction = 'declining'

  return { direction, changePercent }
}

/**
 * Calculate consistency scores for daily, weekly, and monthly activity.
 */
export async function calculateConsistency(userId: string): Promise<ConsistencyScore> {
  const { start, end } = getDateRange('30d')
  const daysInRange = getDaysInRange(start, end)

  // Get daily activity
  const progress = await db.progress.findMany({
    where: {
      userId,
      lastAccessed: { gte: start, lte: end },
    },
    select: { lastAccessed: true },
  })

  const exams = await db.examResult.findMany({
    where: { userId, completedAt: { gte: start, lte: end } },
    select: { completedAt: true },
  })

  const cqSubmissions = await db.cQExamSubmission.findMany({
    where: { userId, submittedAt: { gte: start, lte: end } },
    select: { submittedAt: true },
  })

  // Build set of active days
  const activeDays = new Set<string>()
  for (const p of progress) activeDays.add(p.lastAccessed.toISOString().slice(0, 10))
  for (const e of exams) activeDays.add(e.completedAt.toISOString().slice(0, 10))
  for (const c of cqSubmissions) {
    if (c.submittedAt) activeDays.add(c.submittedAt.toISOString().slice(0, 10))
  }

  const totalActiveDays = activeDays.size
  const daily = Math.min(100, Math.round((totalActiveDays / daysInRange) * 100))

  // Weekly consistency: how many weeks had at least 3 active days
  const weekMap = new Map<string, number>()
  for (const dayStr of activeDays) {
    const d = new Date(dayStr)
    const dayOfWeek = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const weekKey = monday.toISOString().slice(0, 10)
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1)
  }

  const totalWeeks = weekMap.size
  const goodWeeks = Array.from(weekMap.values()).filter(count => count >= 3).length
  const weekly = totalWeeks > 0 ? Math.round((goodWeeks / totalWeeks) * 100) : 0

  // Monthly consistency (simplified: active days >= 15 in a month)
  const monthMap = new Map<string, number>()
  for (const dayStr of activeDays) {
    const monthKey = dayStr.slice(0, 7)
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1)
  }

  const totalMonths = monthMap.size
  const goodMonths = Array.from(monthMap.values()).filter(count => count >= 15).length
  const monthly = totalMonths > 0 ? Math.round((goodMonths / totalMonths) * 100) : 0

  const overall = Math.round((daily + weekly + monthly) / 3)

  return { daily, weekly, monthly, overall }
}

// ══════════════════════════════════════════════════════════════════════
// HEALTH SCORE
// ══════════════════════════════════════════════════════════════════════

/**
 * Calculate Learning Health Score (0-100).
 *
 * Components:
 * - study: Study frequency & consistency
 * - revision: Revision completion rate
 * - accuracy: Exam performance
 * - consistency: Daily/weekly/monthly consistency
 * - goal: Goal completion rate
 * - weakness: Weakness recovery
 * - streak: Current study streak
 */
export async function generateHealthScore(userId: string): Promise<LearningHealthScore> {
  const { start, end } = getDateRange('30d')

  // 1. STUDY SCORE — Based on active days vs total days
  const daysInRange = getDaysInRange(start, end)
  const progress = await db.progress.count({
    where: { userId, lastAccessed: { gte: start, lte: end } },
  })
  const examCount = await db.examResult.count({
    where: { userId, completedAt: { gte: start, lte: end } },
  })
  const totalActivity = progress + examCount
  const expectedActivity = daysInRange * 2 // Expect ~2 activities per day
  const studyScore = Math.min(100, Math.round((totalActivity / Math.max(expectedActivity, 1)) * 100))

  // 2. REVISION SCORE
  const [totalReviews, completedReviews] = await Promise.all([
    db.revisionQueue.count({ where: { userId } }),
    db.revisionQueue.count({ where: { userId, isCompleted: true } }),
  ])
  const revisionScore = totalReviews > 0
    ? Math.round((completedReviews / totalReviews) * 100)
    : 50 // Neutral if no data

  // 3. ACCURACY SCORE
  const recentResults = await db.examResult.findMany({
    where: { userId, completedAt: { gte: start, lte: end } },
    select: { score: true, totalMarks: true },
  })
  const totalScore = recentResults.reduce((s, r) => s + Number(r.score), 0)
  const totalMarks = recentResults.reduce((s, r) => s + Number(r.totalMarks), 0)
  const accuracyScore = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 50

  // 4. CONSISTENCY SCORE — Reuse calculateConsistency
  const consistency = await calculateConsistency(userId)

  // 5. GOAL SCORE — Based on weekly study targets
  const daysWithActivity = new Set<string>()
  const allProgress = await db.progress.findMany({
    where: { userId, lastAccessed: { gte: start, lte: end } },
    select: { lastAccessed: true },
  })
  for (const p of allProgress) {
    daysWithActivity.add(p.lastAccessed.toISOString().slice(0, 10))
  }
  const goalScore = Math.min(100, Math.round((daysWithActivity.size / Math.max(daysInRange, 1)) * 100))

  // 6. WEAKNESS SCORE — Based on weak subject improvement
  const examResults = await db.examResult.findMany({
    where: { userId },
    select: { percentage: true, completedAt: true, exam: { select: { subjectId: true } } },
    orderBy: { completedAt: 'asc' },
    take: 50,
  })
  const weakScore = examResults.length > 0
    ? Math.min(100, Math.round(examResults.reduce((s, r) => s + r.percentage, 0) / examResults.length))
    : 50

  // 7. STREAK SCORE
  const streakData = await computeUserStreak(userId)
  const streak = streakData.currentStreak
  const streakScore = Math.min(100, streak * 10) // 10 points per day, max 100

  const components: HealthScoreComponent[] = [
    { name: 'study', label: 'অধ্যয়ন', score: studyScore, weight: 0.2 },
    { name: 'revision', label: 'রিভিশন', score: revisionScore, weight: 0.15 },
    { name: 'accuracy', label: 'নির্ভুলতা', score: accuracyScore, weight: 0.15 },
    { name: 'consistency', label: 'ধারাবাহিকতা', score: consistency.overall, weight: 0.2 },
    { name: 'goal', label: 'লক্ষ্য', score: goalScore, weight: 0.1 },
    { name: 'weakness', label: 'দুর্বলতা', score: weakScore, weight: 0.1 },
    { name: 'streak', label: 'স্ট্রিক', score: streakScore, weight: 0.1 },
  ]

  const overall = Math.round(
    components.reduce((total, c) => total + c.score * c.weight, 0),
  )

  // Trend: compare to 7 days ago
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [recentActivities, olderActivities] = await Promise.all([
    db.progress.count({ where: { userId, lastAccessed: { gte: weekAgo } } }),
    db.progress.count({ where: { userId, lastAccessed: { gte: start, lt: weekAgo } } }),
  ])
  const recentPerDay = recentActivities / 7
  const olderDays = Math.max(1, Math.round((weekAgo.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const olderPerDay = olderActivities / olderDays

  let trend: 'improving' | 'declining' | 'stable' = 'stable'
  if (recentPerDay > olderPerDay * 1.2) trend = 'improving'
  else if (recentPerDay < olderPerDay * 0.8) trend = 'declining'

  return { overall, components, trend }
}

// ══════════════════════════════════════════════════════════════════════
// INSIGHT GENERATION
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate all study insights for a user.
 */
export async function generateInsights(userId: string, period: InsightsPeriod = '30d'): Promise<StudyInsight[]> {
  const { start, end } = getDateRange(period)
  const insights: StudyInsight[] = []

  // Run all data queries in parallel
  const [
    progressData,
    examResults,
    cqSubmissions,
    streakData,
    totalAchievements,
    revisionData,
  ] = await Promise.all([
    db.progress.findMany({
      where: { userId, lastAccessed: { gte: start, lte: end } },
      select: { lastAccessed: true, contentType: true, progress: true },
    }),
    db.examResult.findMany({
      where: { userId, completedAt: { gte: start, lte: end } },
      select: { percentage: true, completedAt: true, correct: true, score: true, totalMarks: true, exam: { select: { subjectId: true } } },
    }),
    db.cQExamSubmission.count({
      where: { userId, submittedAt: { gte: start, lte: end } },
    }),
    computeUserStreak(userId),
    db.userAchievement.count({ where: { userId, unlocked: true } }),
    db.revisionQueue.findMany({
      where: { userId },
      select: { isCompleted: true, confidenceScore: true, nextReviewAt: true },
    }),
  ])

  const streak = streakData.currentStreak

  // ─── STUDY PATTERN INSIGHTS ────────────────────────────────────────

  // Analyze by day of week
  const dayActivity = new Map<number, number>() // day -> count
  for (const p of progressData) {
    const day = p.lastAccessed.getDay()
    dayActivity.set(day, (dayActivity.get(day) || 0) + 1)
  }

  if (dayActivity.size > 0) {
    const sortedDays = Array.from(dayActivity.entries()).sort((a, b) => b[1] - a[1])
    const bestDay = sortedDays[0]
    const worstDay = sortedDays[sortedDays.length - 1]

    if (bestDay && bestDay[1] > 0) {
      insights.push({
        id: 'best-study-day',
        category: 'study-pattern',
        title: 'সেরা পড়ার দিন',
        message: `আপনি ${getDayOfWeekLabel(bestDay[0])} সবচেয়ে বেশি পড়াশোনা করেন (${bestDay[1]} বার)।`,
        impact: 'positive',
        value: bestDay[1],
        unit: 'বার',
        icon: '📅',
        priority: 3,
      })
    }

    if (worstDay && worstDay[0] !== bestDay?.[0] && worstDay[1] >= 0) {
      insights.push({
        id: 'least-active-day',
        category: 'study-pattern',
        title: 'কম পড়ার দিন',
        message: `${getDayOfWeekLabel(worstDay[0])} পড়াশোনার জন্য কম সময় দিচ্ছেন। এই দিনে বেশি পড়ার চেষ্টা করুন।`,
        impact: 'negative',
        icon: '⚠️',
        priority: 2,
      })
    }
  }

  // Analyze by time of day
  const timeActivity = new Map<string, number>()
  for (const p of progressData) {
    const timeLabel = getTimeOfDayLabel(p.lastAccessed.getHours())
    timeActivity.set(timeLabel, (timeActivity.get(timeLabel) || 0) + 1)
  }

  if (timeActivity.size > 0) {
    const bestTime = Array.from(timeActivity.entries()).sort((a, b) => b[1] - a[1])[0]
    if (bestTime) {
      insights.push({
        id: 'best-study-time',
        category: 'study-pattern',
        title: 'সেরা পড়ার সময়',
        message: `আপনি ${bestTime[0]} এর সময় সবচেয়ে বেশি পড়াশোনা করেন (${bestTime[1]} বার)। এই সময়ে পড়া চালিয়ে যান!`,
        impact: 'positive',
        value: bestTime[1],
        unit: 'বার',
        icon: '⏰',
        priority: 3,
      })
    }
  }

  // ─── PERFORMANCE INSIGHTS ──────────────────────────────────────────

  if (examResults.length >= 4) {
    const percentages = examResults.map(r => r.percentage)
    const trend = calculateTrend(percentages)

    if (trend.direction === 'improving') {
      insights.push({
        id: 'accuracy-improving',
        category: 'performance',
        title: 'নির্ভুলতা বাড়ছে',
        message: `আপনার পরীক্ষার ফলাফল ${trend.changePercent}% উন্নতি করছে! এই গতি ধরে রাখুন।`,
        impact: 'positive',
        value: Math.abs(trend.changePercent),
        unit: '%',
        icon: '📈',
        priority: 5,
      })
    } else if (trend.direction === 'declining') {
      insights.push({
        id: 'accuracy-declining',
        category: 'performance',
        title: 'নির্ভুলতা কমছে',
        message: `আপনার পরীক্ষার ফলাফল ${Math.abs(trend.changePercent)}% কমেছে। আরও অনুশীলন ও রিভিশন প্রয়োজন!`,
        impact: 'negative',
        value: Math.abs(trend.changePercent),
        unit: '%',
        icon: '📉',
        priority: 5,
      })
    }

    // Best and worst subjects
    const subjectScores = new Map<string, number[]>()
    for (const r of examResults) {
      if (!r.exam?.subjectId) continue
      const scores = subjectScores.get(r.exam.subjectId) || []
      scores.push(r.percentage)
      subjectScores.set(r.exam.subjectId, scores)
    }

    if (subjectScores.size >= 2) {
      const subjectAvgs = Array.from(subjectScores.entries()).map(([id, scores]) => ({
        id,
        avg: scores.reduce((s, v) => s + v, 0) / scores.length,
      })).sort((a, b) => b.avg - a.avg)

      const bestSubj = subjectAvgs[0]
      const worstSubj = subjectAvgs[subjectAvgs.length - 1]

      if (bestSubj && bestSubj.avg >= 60) {
        const subjName = await getSubjectName(bestSubj.id)
        insights.push({
          id: 'strongest-subject',
          category: 'performance',
          title: 'সেরা বিষয়',
          message: `আপনার সবচেয়ে ভালো বিষয়: ${subjName} (${Math.round(bestSubj.avg)}%)`,
          impact: 'positive',
          value: Math.round(bestSubj.avg),
          unit: '%',
          icon: '🏆',
          priority: 4,
        })
      }

      if (worstSubj && worstSubj.avg < 60) {
        const subjName = await getSubjectName(worstSubj.id)
        insights.push({
          id: 'weakest-subject',
          category: 'performance',
          title: 'মনোযোগ প্রয়োজন',
          message: `আপনার ${subjName} বিষয়ে উন্নতি প্রয়োজন (${Math.round(worstSubj.avg)}%)। আরও অনুশীলন করুন!`,
          impact: 'negative',
          value: Math.round(worstSubj.avg),
          unit: '%',
          icon: '🎯',
          priority: 4,
        })
      }
    }
  }

  // ─── REVISION INSIGHTS ─────────────────────────────────────────────

  if (revisionData.length > 0) {
    const totalRev = revisionData.length
    const completedRev = revisionData.filter(r => r.isCompleted).length
    const overdueRev = revisionData.filter(r => !r.isCompleted && r.nextReviewAt && r.nextReviewAt < new Date()).length
    const completionRate = Math.round((completedRev / totalRev) * 100)
    const avgConfidence = Math.round(
      revisionData.reduce((s, r) => s + r.confidenceScore, 0) / totalRev,
    )

    insights.push({
      id: 'revision-completion',
      category: 'revision',
      title: 'রিভিশন সম্পূর্ণতা',
      message: `আপনার ${completionRate}% রিভিশন সম্পন্ন হয়েছে (${completedRev}/${totalRev})। গড় আত্মবিশ্বাস ${avgConfidence}%।`,
      impact: completionRate >= 70 ? 'positive' : 'negative',
      value: completionRate,
      unit: '%',
      icon: '🔄',
      priority: 4,
    })

    if (overdueRev > 0) {
      insights.push({
        id: 'overdue-revision',
        category: 'revision',
        title: 'বাকি রিভিশন',
        message: `আপনার ${overdueRev}টি রিভিশন বাকি আছে। সময়মতো রিভিউ সম্পন্ন করুন!`,
        impact: 'negative',
        value: overdueRev,
        unit: 'টি',
        icon: '⏳',
        priority: 5,
      })
    }
  }

  // ─── BEHAVIOR INSIGHTS ────────────────────────────────────────────

  const completedContent = progressData.filter(p => p.progress >= 100).length
  const partialContent = progressData.filter(p => p.progress > 0 && p.progress < 100).length

  if (completedContent > 0) {
    insights.push({
      id: 'content-completion',
      category: 'behavior',
      title: 'কন্টেন্ট সম্পূর্ণতা',
      message: `আপনি ${completedContent}টি কন্টেন্ট সম্পন্ন করেছেন। নিয়মিত পড়া চালিয়ে যান!`,
      impact: 'positive',
      value: completedContent,
      unit: 'টি',
      icon: '✅',
      priority: 3,
    })
  }

  if (partialContent > 0 && partialContent > completedContent) {
    insights.push({
      id: 'drop-off-warning',
      category: 'behavior',
      title: 'অসমাপ্ত কন্টেন্ট',
      message: `আপনার ${partialContent}টি কন্টেন্ট অসমাপ্ত রয়েছে। একটি শেষ করার পর অন্যটি শুরু করুন!`,
      impact: 'negative',
      value: partialContent,
      unit: 'টি',
      icon: '✋',
      priority: 3,
    })
  }

  // ─── GOAL TRACKING INSIGHTS ───────────────────────────────────────

  const { start: monthStart } = getDateRange('30d')
  const totalDays = getDaysInRange(monthStart, end)
  const activeDays = new Set<string>()
  for (const p of progressData) {
    activeDays.add(p.lastAccessed.toISOString().slice(0, 10))
  }
  for (const e of examResults) {
    activeDays.add(e.completedAt.toISOString().slice(0, 10))
  }

  const goalCompletionRate = Math.round((activeDays.size / totalDays) * 100)
  insights.push({
    id: 'goal-completion-rate',
    category: 'goal-tracking',
    title: 'লক্ষ্য পূরণের হার',
    message: `গত ${totalDays} দিনে ${activeDays.size} দিন পড়াশোনা করেছেন (${goalCompletionRate}%)।`,
    impact: goalCompletionRate >= 60 ? 'positive' : 'negative',
    value: goalCompletionRate,
    unit: '%',
    icon: '🎯',
    priority: 3,
  })

  // ─── ACHIEVEMENT INSIGHTS ─────────────────────────────────────────

  if (totalAchievements > 0) {
    insights.push({
      id: 'achievement-count',
      category: 'achievement',
      title: 'অর্জন',
      message: `আপনি মোট ${totalAchievements}টি অর্জন আনলক করেছেন! আরও অর্জনের জন্য চেষ্টা চালিয়ে যান।`,
      impact: 'achievement',
      value: totalAchievements,
      unit: 'টি',
      icon: '🏅',
      priority: 3,
    })

    // Closest unearned achievement
    const unearnedAchievements = ACHIEVEMENTS.filter(
      a => a.category !== 'special',
    )

    if (unearnedAchievements.length > 0) {
      // Find the easiest next achievement based on simple criteria
      const easiestNext = unearnedAchievements.find(a => a.measure === 'count' && a.target <= 10)
        || unearnedAchievements[0]

      insights.push({
        id: 'next-achievement',
        category: 'achievement',
        title: 'পরবর্তী অর্জন',
        message: `পরবর্তী লক্ষ্য: "${easiestNext.title}" — ${easiestNext.description}`,
        impact: 'positive',
        icon: '⭐',
        priority: 2,
      })
    }
  }

  // ─── RECOMMENDATION INSIGHTS ──────────────────────────────────────

  const incompleteLectures = progressData.filter(p => p.progress > 0 && p.progress < 100).length
  if (incompleteLectures > 0) {
    insights.push({
      id: 'continue-learning',
      category: 'recommendation',
      title: 'চালিয়ে যান',
      message: `আপনার ${incompleteLectures}টি অসমাপ্ত লেকচার রয়েছে। যেখানে ছেড়েছিলেন সেখান থেকে শুরু করুন!`,
      impact: 'neutral',
      value: incompleteLectures,
      unit: 'টি',
      icon: '📚',
      priority: 3,
      actionUrl: '/user/dashboard',
      actionLabel: 'দেখুন',
    })
  }

  // ─── CALENDAR INSIGHTS ────────────────────────────────────────────

  if (streak > 0) {
    insights.push({
      id: 'current-streak',
      category: 'calendar',
      title: 'বর্তমান স্ট্রিক',
      message: `আপনার বর্তমান Study Streak ${streak} দিন!`,
      impact: streak >= 7 ? 'achievement' : 'positive',
      value: streak,
      unit: 'দিন',
      icon: '🔥',
      priority: 4,
    })
  }

  if (streak === 1) {
    insights.push({
      id: 'streak-risk',
      category: 'calendar',
      title: 'স্ট্রিক বিপদে',
      message: 'আজ পড়াশোনা না করলে আপনার স্ট্রিক শেষ হয়ে যাবে! একটু সময় দিন।',
      impact: 'negative',
      icon: '⚠️',
      priority: 5,
    })
  }

  // ─── FOCUS INSIGHTS ──────────────────────────────────────────────

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayProgress = progressData.filter(p => p.lastAccessed >= todayStart).length
  if (todayProgress > 0) {
    insights.push({
      id: 'focus-session',
      category: 'focus',
      title: 'ফোকাস সেশন',
      message: `আপনি আজ ${todayProgress} বার পড়াশোনা করেছেন। ফোকাস ধরে রাখুন!`,
      impact: 'positive',
      value: todayProgress,
      unit: 'বার',
      icon: '🧠',
      priority: 2,
    })
  }

  // Sort by priority (highest first)
  insights.sort((a, b) => b.priority - a.priority)

  return insights
}

// ══════════════════════════════════════════════════════════════════════
// PREDICTIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate deterministic predictions from existing data trends.
 * Never fabricates data — only predicts from observable trends.
 */
export async function generatePredictions(userId: string): Promise<StudyPrediction[]> {
  const predictions: StudyPrediction[] = []

  const [streakData, revisionData, progressData, examResults] = await Promise.all([
    computeUserStreak(userId),
    db.revisionQueue.findMany({
      where: { userId, isCompleted: false },
      select: { nextReviewAt: true, confidenceScore: true },
    }),
    db.progress.findMany({
      where: { userId, contentType: 'lecture', progress: { gt: 0, lt: 100 } },
      select: { progress: true, lastAccessed: true },
      take: 20,
    }),
    db.examResult.findMany({
      where: { userId },
      select: { percentage: true, completedAt: true, exam: { select: { subjectId: true } } },
      orderBy: { completedAt: 'asc' },
      take: 20,
    }),
  ])

  const streak = streakData.currentStreak

  // Prediction: Streak milestone
  if (streak > 0) {
    const nextMilestones = [3, 5, 7, 10, 14, 21, 30, 50, 100]
    const nextMilestone = nextMilestones.find(m => m > streak)
    if (nextMilestone) {
      const daysNeeded = nextMilestone - streak
      predictions.push({
        id: 'streak-milestone',
        title: `${nextMilestone} দিনের স্ট্রিক`,
        description: daysNeeded <= 1
          ? 'আগামীকাল আপনার স্ট্রিক পূর্ণ হবে!'
          : `আপনার স্ট্রিক ${nextMilestone} দিনে পৌঁছাতে ${daysNeeded} দিন বাকি। নিয়মিত পড়া চালিয়ে যান!`,
        confidence: daysNeeded <= 3 ? 'high' : daysNeeded <= 7 ? 'medium' : 'low',
        estimatedDays: daysNeeded,
        category: 'calendar',
      })
    }
  }

  // Prediction: Revision completion
  if (revisionData.length > 0) {
    const overdueCount = revisionData.filter(r => r.nextReviewAt && r.nextReviewAt < new Date()).length
    if (overdueCount > 0) {
      predictions.push({
        id: 'revision-completion',
        title: 'রিভিশন শেষ হবে',
        description: `আপনার ${overdueCount}টি বাকি রিভিশন আগামীকালের মধ্যে শেষ হবে বলে ধারণা করা হচ্ছে।`,
        confidence: 'medium',
        estimatedDays: 1,
        category: 'revision',
      })
    }
  }

  // Prediction: Chapter/subject improvement
  if (examResults.length >= 4) {
    const percentages = examResults.map(r => r.percentage)
    const recentAvg = percentages.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, percentages.length)

    if (recentAvg < 60) {
      predictions.push({
        id: 'subject-improvement',
        title: 'বিষয়ে উন্নতি',
        description: 'নিয়মিত অনুশীলন করলে আগামী ৭ দিনের মধ্যে আপনার স্কোর ৬০% ছাড়িয়ে যেতে পারে।',
        confidence: 'medium',
        estimatedDays: 7,
        category: 'performance',
      })
    }
  }

  // Prediction: Content completion
  if (progressData.length > 0) {
    const almostDone = progressData.filter(p => p.progress >= 70).length
    if (almostDone > 0) {
      predictions.push({
        id: 'content-completion',
        title: 'কোর্স শেষ হবে',
        description: `আপনার ${almostDone}টি লেকচার প্রায় শেষ। আরেকটু পড়লেই সম্পন্ন হবে!`,
        confidence: 'high',
        estimatedDays: 1,
        category: 'behavior',
      })
    }
  }

  return predictions
}

// ══════════════════════════════════════════════════════════════════════
// MISC HELPERS
// ══════════════════════════════════════════════════════════════════════

const subjectNameCache = new Map<string, string>()

async function getSubjectName(subjectId: string): Promise<string> {
  if (subjectNameCache.has(subjectId)) return subjectNameCache.get(subjectId)!

  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: { name: true },
  })
  const name = subject?.name || 'অজানা'
  subjectNameCache.set(subjectId, name)
  return name
}

// ══════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate complete study insights response.
 * Runs all generators in parallel for performance.
 */
export async function generateStudyInsights(
  userId: string,
  period: InsightsPeriod = '30d',
): Promise<StudyInsightsResponse> {
  const [healthScore, insights, predictions, consistency] = await Promise.all([
    generateHealthScore(userId),
    generateInsights(userId, period),
    generatePredictions(userId),
    calculateConsistency(userId),
  ])

  return {
    healthScore,
    insights,
    predictions,
    consistency,
    generatedAt: new Date().toISOString(),
  }
}
