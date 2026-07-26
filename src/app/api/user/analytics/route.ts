import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { computeUserStreak } from '@/lib/user-streak'
import type {
  StudentAnalytics,
  StudentAnalyticsSummary,
  StudyTimeDataPoint,
  DailyDataPoint,
  AccuracyDataPoint,
  SubjectAnalytics,
  ChapterAnalytics,
  RevisionAnalytics,
  AnalyticsPeriod,
} from '@/types/student-analytics'

// ─── Date Helpers ──────────────────────────────────────────────────

function getPeriodDateRange(period: AnalyticsPeriod, from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date()
  end.setHours(23, 59, 59, 999)

  let start: Date
  if (from) {
    start = new Date(from)
  } else {
    start = new Date(end)
    switch (period) {
      case 'today':
        // Start = beginning of today
        start.setHours(0, 0, 0, 0)
        break
      case 'thisWeek':
        // Start = Monday of this week
        const dayOfWeek = start.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        start.setDate(start.getDate() + mondayOffset)
        start.setHours(0, 0, 0, 0)
        break
      case '7d':
        start.setDate(start.getDate() - 7)
        break
      case '30d':
        start.setDate(start.getDate() - 30)
        break
      case '90d':
        start.setDate(start.getDate() - 90)
        break
      case '1y':
        start.setFullYear(start.getFullYear() - 1)
        break
      default:
        start.setDate(start.getDate() - 30)
    }
  }
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

function getDaysInRange(start: Date, end: Date): string[] {
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function getWeeksInRange(start: Date, end: Date): { weekStart: string; weekEnd: string }[] {
  const weeks: { weekStart: string; weekEnd: string }[] = []
  const cursor = new Date(start)
  // Find the Monday of the first week
  const dayOfWeek = cursor.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  cursor.setDate(cursor.getDate() + mondayOffset)

  while (cursor <= end) {
    const weekStart = new Date(cursor)
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weeks.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
    })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

// ─── Aggregation Helpers ───────────────────────────────────────────

/**
 * Aggregate daily study minutes from progress records.
 * Each progress update with content type 'lecture' counts as ~5 min of study.
 * Exam time is taken from timeTaken field in ExamResult.
 */
async function aggregateDailyStudyTime(
  userId: string,
  start: Date,
  end: Date,
): Promise<StudyTimeDataPoint[]> {
  const days = getDaysInRange(start, end)
  const dayMap = new Map<string, StudyTimeDataPoint>()

  for (const day of days) {
    dayMap.set(day, {
      date: day,
      minutes: 0,
      lectureMinutes: 0,
      examMinutes: 0,
    })
  }

  // Lecture progress — each interaction ≈ 5 min
  const progress = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      lastAccessed: { gte: start, lte: end },
    },
    select: { lastAccessed: true, progress: true },
  })

  for (const p of progress) {
    const day = p.lastAccessed.toISOString().slice(0, 10)
    const entry = dayMap.get(day)
    if (entry) {
      // Estimate: each progress interaction is ~5 minutes
      const estMinutes = 5
      entry.minutes += estMinutes
      entry.lectureMinutes += estMinutes
    }
  }

  // Exam results — use actual time taken
  const exams = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: { completedAt: true, timeTaken: true },
  })

  for (const e of exams) {
    const day = e.completedAt.toISOString().slice(0, 10)
    const entry = dayMap.get(day)
    if (entry) {
      const mins = Math.round(e.timeTaken / 60)
      entry.minutes += mins
      entry.examMinutes += mins
    }
  }

  // CQ submissions — estimate ~20 min per submission
  const cqSubmissions = await db.cQExamSubmission.findMany({
    where: {
      userId,
      submittedAt: { gte: start, lte: end },
    },
    select: { submittedAt: true },
  })

  for (const c of cqSubmissions) {
    if (!c.submittedAt) continue
    const day = c.submittedAt.toISOString().slice(0, 10)
    const entry = dayMap.get(day)
    if (entry) {
      entry.minutes += 20
      entry.examMinutes += 20
    }
  }

  return days.map(day => dayMap.get(day)!).filter(Boolean)
}

/**
 * Aggregate weekly study time from daily data.
 */
function aggregateWeeklyStudyTime(dailyData: StudyTimeDataPoint[]): DailyDataPoint[] {
  const weekMap = new Map<string, number>()

  for (const d of dailyData) {
    const date = new Date(d.date)
    const dayOfWeek = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const weekKey = monday.toISOString().slice(0, 10)
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + d.minutes)
  }

  return Array.from(weekMap.entries())
    .map(([date, minutes]) => ({ date, value: Math.round(minutes) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate monthly study time from daily data.
 */
function aggregateMonthlyStudyTime(dailyData: StudyTimeDataPoint[]): DailyDataPoint[] {
  const monthMap = new Map<string, number>()

  for (const d of dailyData) {
    const monthKey = d.date.slice(0, 7) // YYYY-MM
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + d.minutes)
  }

  return Array.from(monthMap.entries())
    .map(([date, minutes]) => ({ date, value: Math.round(minutes) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate MCQ accuracy trend from exam results.
 */
async function aggregateMcqAccuracy(
  userId: string,
  start: Date,
  end: Date,
): Promise<AccuracyDataPoint[]> {
  const results = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: {
      completedAt: true,
      correct: true,
      wrong: true,
      skipped: true,
    },
  })

  const dayMap = new Map<string, { correct: number; total: number }>()

  for (const r of results) {
    const day = r.completedAt.toISOString().slice(0, 10)
    const entry = dayMap.get(day) || { correct: 0, total: 0 }
    entry.correct += r.correct
    entry.total += r.correct + r.wrong + r.skipped
    dayMap.set(day, entry)
  }

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      totalQuestions: data.total,
      correctAnswers: data.correct,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate CQ activity trend.
 */
async function aggregateCqActivity(
  userId: string,
  start: Date,
  end: Date,
): Promise<DailyDataPoint[]> {
  const submissions = await db.cQExamSubmission.findMany({
    where: {
      userId,
      submittedAt: { gte: start, lte: end },
    },
    select: { submittedAt: true },
  })

  const dayMap = new Map<string, number>()

  for (const s of submissions) {
    if (!s.submittedAt) continue
    const day = s.submittedAt.toISOString().slice(0, 10)
    dayMap.set(day, (dayMap.get(day) || 0) + 1)
  }

  return Array.from(dayMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate exam completion trend.
 */
async function aggregateExamCompletion(
  userId: string,
  start: Date,
  end: Date,
): Promise<DailyDataPoint[]> {
  const results = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: { completedAt: true },
  })

  const dayMap = new Map<string, number>()

  for (const r of results) {
    const day = r.completedAt.toISOString().slice(0, 10)
    dayMap.set(day, (dayMap.get(day) || 0) + 1)
  }

  return Array.from(dayMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compute subject performance with trend detection.
 */
async function aggregateSubjectPerformance(
  userId: string,
  start: Date,
  end: Date,
): Promise<SubjectAnalytics[]> {
  const examResults = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: {
      score: true,
      totalMarks: true,
      correct: true,
      completedAt: true,
      exam: { select: { subjectId: true, title: true } },
    },
  })

  // Also estimate study time per subject from progress
  const recentProgress = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      lastAccessed: { gte: start, lte: end },
    },
    select: {
      contentId: true,
      lastAccessed: true,
    },
  })

  // Resolve contentId -> subjectId for lectures
  const lectureIds = recentProgress.map(p => p.contentId)
  const subjectMap = new Map<string, string>() // lectureId -> subjectId
  if (lectureIds.length > 0) {
    const chapterIds = new Set<string>()
    const lectures = await db.lecture.findMany({
      where: { id: { in: lectureIds } },
      select: { id: true, chapter: { select: { subjectId: true } } },
    })
    for (const l of lectures) {
      subjectMap.set(l.id, l.chapter.subjectId)
    }
  }

  // Group by subject
  const subjectData = new Map<
    string,
    {
      name: string
      scores: number[]
      totalCorrect: number
      totalQuestions: number
      studyInteractions: number
      recentScores: number[]
      olderScores: number[]
      completedAts: Date[]
    }
  >()

  for (const r of examResults) {
    if (!r.exam?.subjectId) continue
    const entry = subjectData.get(r.exam.subjectId) || {
      name: r.exam.title || '',
      scores: [],
      totalCorrect: 0,
      totalQuestions: 0,
      studyInteractions: 0,
      recentScores: [],
      olderScores: [],
      completedAts: [],
    }
    const percentage = r.totalMarks > 0 ? Math.round((Number(r.score) / Number(r.totalMarks)) * 100) : 0
    entry.scores.push(percentage)
    entry.totalCorrect += r.correct
    entry.totalQuestions += r.correct + (r.totalMarks > 0 ? Math.round(Number(r.totalMarks)) : 0)
    entry.completedAts.push(r.completedAt)

    // Split into recent (last 7 days) and older for trend
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (r.completedAt >= sevenDaysAgo) {
      entry.recentScores.push(percentage)
    } else {
      entry.olderScores.push(percentage)
    }

    subjectData.set(r.exam.subjectId, entry)
  }

  // Add lecture study time estimates to subjects
  for (const [lectureId, subjectId] of subjectMap.entries()) {
    const entry = subjectData.get(subjectId)
    if (entry) {
      entry.studyInteractions++
    }
  }

  // Resolve subject names
  const subjectIds = Array.from(subjectData.keys())
  let nameMap = new Map<string, string>()
  if (subjectIds.length > 0) {
    const subjects = await db.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    })
    nameMap = new Map(subjects.map(s => [s.id, s.name]))
  }

  return Array.from(subjectData.entries()).map(([subjectId, data]) => {
    const avgScore = data.scores.length > 0
      ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
      : 0

    // Compute trend
    const recentAvg = data.recentScores.length > 0
      ? data.recentScores.reduce((a, b) => a + b, 0) / data.recentScores.length
      : null
    const olderAvg = data.olderScores.length > 0
      ? data.olderScores.reduce((a, b) => a + b, 0) / data.olderScores.length
      : null
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (recentAvg !== null && olderAvg !== null) {
      const diff = recentAvg - olderAvg
      if (diff > 5) trend = 'improving'
      else if (diff < -5) trend = 'declining'
    }

    return {
      subjectId,
      subjectName: nameMap.get(subjectId) || data.name,
      averageScore: avgScore,
      totalExams: data.scores.length,
      totalCorrect: data.totalCorrect,
      totalQuestions: data.totalQuestions,
      studyMinutes: data.studyInteractions * 5,
      trend,
    }
  }).sort((a, b) => b.averageScore - a.averageScore)
}

/**
 * Chapter-level performance from exam results.
 */
async function aggregateChapterPerformance(
  userId: string,
  start: Date,
  end: Date,
): Promise<ChapterAnalytics[]> {
  const examResults = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: {
      percentage: true,
      completedAt: true,
      exam: { select: { subjectId: true, title: true, chapterIds: true } },
    },
  })

  const chapterData = new Map<
    string,
    { scores: number[]; subjectName: string; chapterName: string; studyMinutes: number }
  >()

  // Map chapterIds from exam results
  const referencedChapterIds = new Set<string>()
  for (const r of examResults) {
    if (!r.exam?.chapterIds) continue
    const ids = r.exam.chapterIds.split(',').map(c => c.trim()).filter(Boolean)
    for (const id of ids) {
      referencedChapterIds.add(id)
      const entry = chapterData.get(id) || {
        scores: [],
        subjectName: '',
        chapterName: '',
        studyMinutes: 0,
      }
      entry.scores.push(r.percentage)
      chapterData.set(id, entry)
    }
  }

  // Resolve chapter names and subject names
  const chIds = Array.from(referencedChapterIds)
  if (chIds.length > 0) {
    const chapters = await db.chapter.findMany({
      where: { id: { in: chIds } },
      select: { id: true, name: true, subject: { select: { name: true } } },
    })
    for (const ch of chapters) {
      const entry = chapterData.get(ch.id)
      if (entry) {
        entry.chapterName = ch.name
        entry.subjectName = ch.subject?.name || ''
      }
    }
  }

  return Array.from(chapterData.entries())
    .map(([chapterId, data]) => ({
      chapterId,
      chapterName: data.chapterName || 'অজানা',
      subjectName: data.subjectName,
      averageScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
      attemptCount: data.scores.length,
      studyMinutes: data.studyMinutes,
    }))
    .sort((a, b) => a.averageScore - b.averageScore) // Worst first
}

/**
 * Revision analytics.
 */
async function aggregateRevisionAnalytics(
  userId: string,
  start: Date,
  end: Date,
): Promise<RevisionAnalytics> {
  const totalReviews = await db.revisionQueue.count({
    where: { userId },
  })

  const completedReviews = await db.revisionQueue.count({
    where: { userId, isCompleted: true },
  })

  const overdueItems = await db.revisionQueue.count({
    where: { userId, isCompleted: false, nextReviewAt: { lt: new Date() } },
  })

  const confidenceScores = await db.revisionQueue.findMany({
    where: { userId },
    select: { confidenceScore: true },
  })

  const averageConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((s, c) => s + c.confidenceScore, 0) / confidenceScores.length)
    : 0

  // Reviews by day
  const completed = await db.revisionQueue.findMany({
    where: {
      userId,
      lastReviewedAt: { gte: start, lte: end },
    },
    select: { lastReviewedAt: true },
  })

  const dayMap = new Map<string, number>()
  for (const r of completed) {
    if (!r.lastReviewedAt) continue
    const day = r.lastReviewedAt.toISOString().slice(0, 10)
    dayMap.set(day, (dayMap.get(day) || 0) + 1)
  }

  return {
    totalReviews,
    completedReviews,
    overdueItems,
    averageConfidence,
    reviewsByDay: Array.from(dayMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/**
 * Compute study time by subject.
 */
async function computeStudyTimeBySubject(
  userId: string,
  start: Date,
  end: Date,
): Promise<{ subjectName: string; minutes: number }[]> {
  const progress = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      lastAccessed: { gte: start, lte: end },
    },
    select: { contentId: true, lastAccessed: true },
  })

  const lectureMap = new Map<string, string>() // lectureId -> subjectId
  const lectureIds = progress.map(p => p.contentId)
  if (lectureIds.length > 0) {
    const lectures = await db.lecture.findMany({
      where: { id: { in: lectureIds } },
      select: { id: true, chapter: { select: { subjectId: true, subject: { select: { name: true } } } } },
    })
    for (const l of lectures) {
      lectureMap.set(l.id, l.chapter?.subject?.name || 'অজানা')
    }
  }

  const subjectMinutes = new Map<string, number>()
  for (const p of progress) {
    const subjectName = lectureMap.get(p.contentId) || 'অজানা'
    subjectMinutes.set(subjectName, (subjectMinutes.get(subjectName) || 0) + 5)
  }

  return Array.from(subjectMinutes.entries())
    .map(([subjectName, minutes]) => ({ subjectName, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

/**
 * GET /api/user/analytics?period=30d&from=&to=
 *
 * Returns comprehensive personal analytics for the authenticated student.
 * All data is aggregated server-side — the client receives only the processed results.
 *
 * Query params:
 *   period: '7d' | '30d' | '90d' | '1y' | 'custom' (default: '30d')
 *   from: ISO date (for custom range)
 *   to: ISO date (for custom range)
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
    const period = (searchParams.get('period') || '30d') as AnalyticsPeriod
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const { start, end } = getPeriodDateRange(period, from, to)

    // Run all aggregations in parallel
    const [
      dailyStudyTime,
      mcqAccuracyTrend,
      cqActivityTrend,
      examCompletionTrend,
      subjectPerformance,
      chapterPerformance,
      revisionAnalytics,
      streakData,
      studyTimeBySubject,
    ] = await Promise.all([
      aggregateDailyStudyTime(userId, start, end),
      aggregateMcqAccuracy(userId, start, end),
      aggregateCqActivity(userId, start, end),
      aggregateExamCompletion(userId, start, end),
      aggregateSubjectPerformance(userId, start, end),
      aggregateChapterPerformance(userId, start, end),
      aggregateRevisionAnalytics(userId, start, end),
      computeUserStreak(userId),
      computeStudyTimeBySubject(userId, start, end),
    ])

    const currentStreak = streakData.currentStreak

    const weeklyStudyTime = aggregateWeeklyStudyTime(dailyStudyTime)
    const monthlyStudyTime = aggregateMonthlyStudyTime(dailyStudyTime)

    // Compute summary
    const totalStudyMinutes = dailyStudyTime.reduce((s, d) => s + d.minutes, 0)
    const daysInRange = getDaysInRange(start, end).length
    const avgDailyMinutes = daysInRange > 0 ? Math.round(totalStudyMinutes / daysInRange) : 0

    const allExams = await db.examResult.findMany({
      where: {
        userId,
        completedAt: { gte: start, lte: end },
      },
      select: { score: true, totalMarks: true },
    })

    const totalScore = allExams.reduce((s, e) => s + Number(e.score), 0)
    const totalMarks = allExams.reduce((s, e) => s + Number(e.totalMarks), 0)
    const averageScore = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0

    const bestSubject = subjectPerformance.length > 0 ? subjectPerformance[0] : null
    const weakestSubject = subjectPerformance.length > 0
      ? subjectPerformance[subjectPerformance.length - 1]
      : null

    // Count completed items in period
    const [completedLectures, mcqCount, cqCount, examsCount] = await Promise.all([
      db.progress.count({
        where: { userId, contentType: 'lecture', progress: { gte: 100 }, lastAccessed: { gte: start, lte: end } },
      }),
      db.examResult.count({
        where: { userId, completedAt: { gte: start, lte: end } },
      }),
      db.cQExamSubmission.count({
        where: { userId, submittedAt: { gte: start, lte: end }, status: { in: ['submitted', 'graded', 'published'] } },
      }),
      db.examResult.count({
        where: { userId, completedAt: { gte: start, lte: end } },
      }),
    ])

    // Count actual MCQs solved as correct + wrong + skipped across all exam results
    const mcqSolved = allExams.reduce((s, e) => s + (e.totalMarks > 0 ? Math.round(Number(e.totalMarks)) : 0), 0)
    // Note: totalMarks is used as a proxy for question count since ExamResult's
    // correct + wrong + skipped fields may not capture all question types

    const summary: StudentAnalyticsSummary = {
      totalStudyMinutes,
      avgDailyMinutes,
      completedLectures,
      mcqSolved,
      cqWritten: cqCount,
      examsTaken: examsCount,
      averageScore,
      bestSubject: bestSubject ? { name: bestSubject.subjectName, score: bestSubject.averageScore } : null,
      weakestSubject: weakestSubject ? { name: weakestSubject.subjectName, score: weakestSubject.averageScore } : null,
      revisionCompleted: revisionAnalytics.completedReviews,
      currentStreak,
    }

    const data: StudentAnalytics = {
      summary,
      dailyStudyTime,
      weeklyStudyTime,
      monthlyStudyTime,
      mcqAccuracyTrend,
      cqActivityTrend,
      subjectPerformance,
      chapterPerformance,
      revisionAnalytics,
      examCompletionTrend,
      studyTimeBySubject,
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Student analytics error:')
  }
}
