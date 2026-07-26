import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'
import { computeUserStreak } from '@/lib/user-streak'
import type {
  CalendarDay,
  CalendarMonth,
  CalendarMonthSummary,
  ActivityLevel,
} from '@/types/learning-calendar'
import { BENGALI_MONTH_NAMES } from '@/types/learning-calendar'

// ─── Month Helpers ─────────────────────────────────────────────────

function getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month
  return { start, end }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  // Returns 0=Sunday, 1=Monday, ..., 6=Saturday
  return new Date(year, month - 1, 1).getDay()
}

// ─── Activity Aggregation ──────────────────────────────────────────

interface DayActivity {
  studyMinutes: number
  mcqCount: number
  cqCount: number
  revisionCount: number
  lectureCount: number
}

/**
 * Aggregate all user activity within the month date range.
 * Queries all activity tables and returns a day-keyed map.
 */
async function aggregateMonthActivity(
  userId: string,
  start: Date,
  end: Date,
): Promise<Map<string, DayActivity>> {
  const activityMap = new Map<string, DayActivity>()

  const addActivity = (dateKey: string, updates: Partial<DayActivity>) => {
    const existing = activityMap.get(dateKey) || {
      studyMinutes: 0,
      mcqCount: 0,
      cqCount: 0,
      revisionCount: 0,
      lectureCount: 0,
    }
    Object.assign(existing, updates)
    activityMap.set(dateKey, existing)
  }

  // 1. Lecture progress (each interaction ≈ 5 min study + 1 lecture count)
  const progress = await db.progress.findMany({
    where: {
      userId,
      contentType: 'lecture',
      lastAccessed: { gte: start, lte: end },
    },
    select: { lastAccessed: true },
  })

  for (const p of progress) {
    const day = p.lastAccessed.toISOString().slice(0, 10)
    addActivity(day, {
      studyMinutes: (activityMap.get(day)?.studyMinutes ?? 0) + 5,
      lectureCount: (activityMap.get(day)?.lectureCount ?? 0) + 1,
    })
  }

  // 2. Exam results (actual time taken + MCQ count)
  const exams = await db.examResult.findMany({
    where: {
      userId,
      completedAt: { gte: start, lte: end },
    },
    select: { completedAt: true, timeTaken: true },
  })

  for (const e of exams) {
    const day = e.completedAt.toISOString().slice(0, 10)
    const mins = Math.round(e.timeTaken / 60)
    addActivity(day, {
      studyMinutes: (activityMap.get(day)?.studyMinutes ?? 0) + mins,
      mcqCount: (activityMap.get(day)?.mcqCount ?? 0) + 1,
    })
  }

  // 3. CQ submissions (≈ 20 min per submission)
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
    addActivity(day, {
      studyMinutes: (activityMap.get(day)?.studyMinutes ?? 0) + 20,
      cqCount: (activityMap.get(day)?.cqCount ?? 0) + 1,
    })
  }

  // 4. Revision queue completions
  const revisions = await db.revisionQueue.findMany({
    where: {
      userId,
      isCompleted: true,
      lastReviewedAt: { gte: start, lte: end },
    },
    select: { lastReviewedAt: true },
  })

  for (const r of revisions) {
    if (!r.lastReviewedAt) continue
    const day = r.lastReviewedAt.toISOString().slice(0, 10)
    addActivity(day, {
      studyMinutes: (activityMap.get(day)?.studyMinutes ?? 0) + 2, // Quick review ≈ 2 min
      revisionCount: (activityMap.get(day)?.revisionCount ?? 0) + 1,
    })
  }

  return activityMap
}

// ─── Intensity Calculation ─────────────────────────────────────────

function computeActivityLevel(totalMinutes: number): ActivityLevel {
  if (totalMinutes === 0) return 0
  if (totalMinutes <= 20) return 1
  if (totalMinutes <= 60) return 2
  if (totalMinutes <= 120) return 3
  return 4
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════

/**
 * GET /api/user/learning-calendar?year=2026&month=7
 *
 * Returns a GitHub-style activity calendar for the requested month.
 * Aggregates data from Progress, ExamResult, CQExamSubmission, and RevisionQueue.
 *
 * Query params:
 *   year  — 4-digit year (default: current year)
 *   month — 1–12 (default: current month)
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
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10)

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'বছর অবৈধ।' },
        { status: 400 },
      )
    }
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'মাস অবৈধ।' },
        { status: 400 },
      )
    }

    const { start, end } = getMonthDateRange(year, month)
    const activityMap = await aggregateMonthActivity(userId, start, end)
    const totalDays = getDaysInMonth(year, month)
    const firstDayOfWeek = getFirstDayOfWeek(year, month)

    // Build the full day grid including leading/trailing days
    const days: CalendarDay[] = []
    const todayStr = now.toISOString().slice(0, 10)

    // Leading days from previous month
    if (firstDayOfWeek > 0) {
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const prevMonthDays = getDaysInMonth(prevYear, prevMonth)
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthDays - i
        const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const activity = activityMap.get(dateStr)
        days.push({
          date: dateStr,
          level: activity ? computeActivityLevel(activity.studyMinutes) : 0,
          studyMinutes: activity?.studyMinutes ?? 0,
          mcqCount: activity?.mcqCount ?? 0,
          cqCount: activity?.cqCount ?? 0,
          revisionCount: activity?.revisionCount ?? 0,
          lectureCount: activity?.lectureCount ?? 0,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        })
      }
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const activity = activityMap.get(dateStr)
      days.push({
        date: dateStr,
        level: activity ? computeActivityLevel(activity.studyMinutes) : 0,
        studyMinutes: activity?.studyMinutes ?? 0,
        mcqCount: activity?.mcqCount ?? 0,
        cqCount: activity?.cqCount ?? 0,
        revisionCount: activity?.revisionCount ?? 0,
        lectureCount: activity?.lectureCount ?? 0,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      })
    }

    // Trailing days from next month to fill the last row
    const totalCells = Math.ceil(days.length / 7) * 7
    const trailingCount = totalCells - days.length
    if (trailingCount > 0) {
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      for (let d = 1; d <= trailingCount; d++) {
        const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const activity = activityMap.get(dateStr)
        days.push({
          date: dateStr,
          level: activity ? computeActivityLevel(activity.studyMinutes) : 0,
          studyMinutes: activity?.studyMinutes ?? 0,
          mcqCount: activity?.mcqCount ?? 0,
          cqCount: activity?.cqCount ?? 0,
          revisionCount: activity?.revisionCount ?? 0,
          lectureCount: activity?.lectureCount ?? 0,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        })
      }
    }

    // Use shared streak utility for accurate streak data (cross-month)
    const streakData = await computeUserStreak(userId)
    const currentStreak = streakData.currentStreak
    const longestStreak = streakData.longestStreak

    // Summary
    let totalStudyMinutes = 0
    let totalMcqs = 0
    let totalCqs = 0
    let totalRevisions = 0
    let totalLectures = 0
    const activeDays = new Set<string>()

    for (const [dateStr, activity] of activityMap) {
      totalStudyMinutes += activity.studyMinutes
      totalMcqs += activity.mcqCount
      totalCqs += activity.cqCount
      totalRevisions += activity.revisionCount
      totalLectures += activity.lectureCount
      if (activity.studyMinutes > 0) activeDays.add(dateStr)
    }

    const summary: CalendarMonthSummary = {
      totalStudyMinutes,
      totalActiveDays: activeDays.size,
      totalMcqs,
      totalCqs,
      totalRevisions,
      totalLectures,
      currentStreak,
      longestStreak,
    }

    const monthData: CalendarMonth = {
      year,
      month,
      monthName: BENGALI_MONTH_NAMES[month] || '',
      totalDays,
      firstDayOfWeek,
      days,
      summary,
    }

    return NextResponse.json({ success: true, data: { month: monthData } })
  } catch (error) {
    return handleApiError(error, 'Learning calendar error:')
  }
}
