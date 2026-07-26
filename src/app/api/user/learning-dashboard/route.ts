import { db } from '@/lib/db'
import { apiError } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { toDecimal } from '@/lib/decimal'
import { handleApiError } from '@/lib/errors'
import { computeUserStreak } from '@/lib/user-streak'
import type { LearningDashboardData, TodayProgress, WeeklyProgress, SubjectPerformance, UpcomingExam } from '@/types/user-dashboard'

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return apiError('প্রমাণীকরণ প্রয়োজন।', 401, 'UNAUTHORIZED')
    }

    const userId = auth.user.id

    // ── 1. Compute study streak from all activity tables ──
    const streak = await computeUserStreak(userId)

    // ── 2. Today's progress ──
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [todayProgress, todayExams, todayCqSubmissions] = await Promise.all([
      db.progress.findMany({
        where: {
          userId,
          contentType: 'lecture',
          lastAccessed: { gte: todayStart, lte: todayEnd },
        },
        select: { progress: true },
      }),
      db.examResult.findMany({
        where: {
          userId,
          completedAt: { gte: todayStart, lte: todayEnd },
        },
        select: { correct: true, timeTaken: true },
      }),
      db.cQExamSubmission.count({
        where: {
          userId,
          submittedAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['submitted', 'graded', 'published'] },
        },
      }),
    ])

    const todayLecturesCompleted = todayProgress.filter(p => p.progress >= 100).length
    const todayLecturesStarted = todayProgress.filter(p => p.progress > 0 && p.progress < 100).length
    const todayMcqSolved = todayExams.reduce((sum, e) => sum + e.correct, 0)
    const todayStudyMinutes = Math.round(
      (todayExams.reduce((sum, e) => sum + e.timeTaken, 0) / 60) +
      (todayProgress.length * 5) // estimate 5 min per lecture session
    )

    const todayProgressData: TodayProgress = {
      completedLectures: todayLecturesCompleted,
      startedLectures: todayLecturesStarted,
      mcqSolved: todayMcqSolved,
      cqWritten: todayCqSubmissions,
      studyMinutes: todayStudyMinutes,
      goalMinutes: 30, // default daily goal — frontend can persist user preference
    }

    // ── 3. Weekly progress ──
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(weekStart)

    const getWeekStats = async (start: Date, end: Date) => {
      const [lectures, exams, cqs] = await Promise.all([
        db.progress.findMany({
          where: {
            userId,
            contentType: 'lecture',
            lastAccessed: { gte: start, lt: end },
            progress: { gte: 100 },
          },
          select: { id: true },
        }),
        db.examResult.findMany({
          where: {
            userId,
            completedAt: { gte: start, lt: end },
          },
          select: { correct: true, timeTaken: true },
        }),
        db.cQExamSubmission.count({
          where: {
            userId,
            submittedAt: { gte: start, lt: end },
            status: { in: ['submitted', 'graded', 'published'] },
          },
        }),
      ])
      const mcqCount = exams.reduce((s, e) => s + e.correct, 0)
      const mins = Math.round(
        (exams.reduce((s, e) => s + e.timeTaken, 0) / 60) +
        (lectures.length * 5)
      )
      return { lecturesCompleted: lectures.length, mcqSolved: mcqCount, cqWritten: cqs, studyMinutes: mins }
    }

    const [thisWeek, lastWeek] = await Promise.all([
      getWeekStats(weekStart, weekEnd),
      getWeekStats(prevWeekStart, prevWeekEnd),
    ])

    const weekly: WeeklyProgress = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      ...thisWeek,
      previousWeek: lastWeek,
    }

    // ── 4. Subject performance from exam results ──
    const examResultsWithSubjects = await db.examResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 200,
      select: {
        score: true,
        totalMarks: true,
        correct: true,
        exam: {
          select: {
            subjectId: true,
            title: true,
          },
        },
      },
    })

    const subjectMap = new Map<string, { totalScore: number; totalMarks: number; totalCorrect: number; totalQuestions: number; name: string }>()
    for (const r of examResultsWithSubjects) {
      if (!r.exam.subjectId) continue
      const entry = subjectMap.get(r.exam.subjectId) || {
        totalScore: 0,
        totalMarks: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        name: r.exam.title,
      }
      entry.totalScore += toDecimal(r.score)
      entry.totalMarks += toDecimal(r.totalMarks)
      entry.totalCorrect += r.correct
      subjectMap.set(r.exam.subjectId, entry)
    }

    // We need subject names — fetch them
    const subjectIds = Array.from(subjectMap.keys())
    const subjects = subjectIds.length > 0
      ? await db.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : []
    const subjectNameMap = new Map(subjects.map(s => [s.id, s.name]))

    const subjectPerformance: SubjectPerformance[] = Array.from(subjectMap.entries())
      .map(([subjectId, data]) => ({
        subjectId,
        subjectName: subjectNameMap.get(subjectId) || data.name,
        averageScore: data.totalMarks > 0 ? Math.round((data.totalScore / data.totalMarks) * 100) : 0,
        totalExams: 0, // approximate — we don't track per-subject exam count easily
        totalCorrect: data.totalCorrect,
        totalQuestions: Math.round(data.totalMarks), // approximate
      }))
      .sort((a, b) => b.averageScore - a.averageScore)

    // ── 5. Upcoming exams ──
    const now = new Date()
    const upcomingWindow = new Date()
    upcomingWindow.setDate(upcomingWindow.getDate() + 30) // next 30 days

    const [mcqSets, cqSets] = await Promise.all([
      db.mCQExamSet.findMany({
        where: {
          scheduledDate: { gte: now, lte: upcomingWindow },
          status: 'published',
        },
        select: {
          id: true,
          packageId: true,
          title: true,
          scheduledDate: true,
          duration: true,
          totalMarks: true,
          package: { select: { title: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 10,
      }),
      db.cQExamSet.findMany({
        where: {
          scheduledDate: { gte: now, lte: upcomingWindow },
          status: 'published',
        },
        select: {
          id: true,
          packageId: true,
          title: true,
          scheduledDate: true,
          duration: true,
          totalMarks: true,
          package: { select: { title: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 10,
      }),
    ])

    const upcomingExams: UpcomingExam[] = [
      ...mcqSets.map(s => ({
        id: s.id,
        packageId: s.packageId,
        packageTitle: s.package.title,
        title: s.title,
        type: 'mcq' as const,
        scheduledDate: s.scheduledDate.toISOString(),
        duration: s.duration,
        totalMarks: Math.round(s.totalMarks),
      })),
      ...cqSets.map(s => ({
        id: s.id,
        packageId: s.packageId,
        packageTitle: s.package.title,
        title: s.title,
        type: 'cq' as const,
        scheduledDate: s.scheduledDate.toISOString(),
        duration: s.duration,
        totalMarks: Math.round(s.totalMarks),
      })),
    ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

    const data: LearningDashboardData = {
      streak,
      today: todayProgressData,
      weekly,
      subjectPerformance,
      upcomingExams,
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Learning dashboard error:')
  }
}
