import { db } from '@/lib/db'
import type { StudyStreak } from '@/types/user-dashboard'

/**
 * Compute the user's full study streak data from all activity tables.
 * Returns currentStreak, longestStreak, activeDates (last 7 days), and todayActive.
 *
 * Reusable across the learning dashboard, revision engine, learning calendar,
 * and intelligent notifications. Eliminates duplicate 5-query streak computation.
 */
export async function computeUserStreak(userId: string): Promise<StudyStreak> {
  const [progressDates, examDates, cqDates, recentDates, sessionDates] = await Promise.all([
    db.progress.findMany({
      where: { userId },
      select: { lastAccessed: true },
      orderBy: { lastAccessed: 'desc' },
      take: 365,
    }),
    db.examResult.findMany({
      where: { userId },
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 365,
    }),
    db.cQExamSubmission.findMany({
      where: { userId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 365,
    }),
    db.recentlyViewed.findMany({
      where: { userId },
      select: { viewedAt: true },
      take: 500,
    }),
    db.examSession.findMany({
      where: { userId },
      select: { startedAt: true },
      take: 500,
    }),
  ])

  // Collect all unique activity dates
  const dateSet = new Set<string>()
  const addDate = (d: Date) => {
    dateSet.add(d.toISOString().slice(0, 10))
  }
  progressDates.forEach(p => addDate(p.lastAccessed))
  examDates.forEach(e => addDate(e.completedAt))
  cqDates.forEach(c => {
    if (c.submittedAt) addDate(c.submittedAt)
  })
  recentDates.forEach(r => addDate(r.viewedAt))
  sessionDates.forEach(s => addDate(s.startedAt))

  const today = new Date().toISOString().slice(0, 10)
  const todayActive = dateSet.has(today)

  // Calculate current streak
  let currentStreak = 0
  const checkDate = new Date()
  if (!todayActive) {
    checkDate.setDate(checkDate.getDate() - 1)
  }
  while (true) {
    const ds = checkDate.toISOString().slice(0, 10)
    if (dateSet.has(ds)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Calculate longest streak
  let longestStreak = 0
  let tempStreak = 0
  const allSortedAsc = Array.from(dateSet).sort()
  for (let i = 0; i < allSortedAsc.length; i++) {
    if (i === 0) {
      tempStreak = 1
    } else {
      const prev = new Date(allSortedAsc[i - 1])
      const curr = new Date(allSortedAsc[i])
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)
  }

  // Last 7 days active dates
  const last7Days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last7Days.push(d.toISOString().slice(0, 10))
  }
  const activeDates = last7Days.filter(d => dateSet.has(d))

  return {
    currentStreak,
    longestStreak,
    activeDates,
    todayActive,
  }
}
