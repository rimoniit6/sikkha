import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import type { WeaknessData, WeaknessItem, WeaknessAction } from '@/types/user-dashboard'

// ─── Severity thresholds (must match frontend) ──────────────────────
const ACCURACY_CRITICAL = 40  // < 40% → critical
const ACCURACY_HIGH = 60      // 40-60% → high
const ACCURACY_MEDIUM = 75    // 60-75% → medium; ≥ 75% → healthy

// ─── Recency weighting: attempts within this many days get 1.5x weight ──
const RECENT_WINDOW_DAYS = 14

/**
 * Map accuracy % to severity level.
 */
export function accuracyToSeverity(accuracy: number): WeaknessItem['severity'] {
  if (accuracy < ACCURACY_CRITICAL) return 'critical'
  if (accuracy < ACCURACY_HIGH) return 'high'
  if (accuracy < ACCURACY_MEDIUM) return 'medium'
  return 'healthy'
}

/**
 * Determine trend by comparing recent attempts (last 14 days) vs older attempts.
 */
export function computeTrend(
  recentAccuracy: number | null,
  olderAccuracy: number | null,
): WeaknessItem['trend'] {
  if (recentAccuracy === null || olderAccuracy === null) return 'stable'
  const diff = recentAccuracy - olderAccuracy
  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

/**
 * Compute a weighted accuracy where recent attempts count 1.5x.
 */
export function weightedAccuracy(
  attempts: { accuracy: number; isRecent: boolean }[],
): number {
  if (attempts.length === 0) return 100
  let totalWeight = 0
  let weightedSum = 0
  for (const a of attempts) {
    const weight = a.isRecent ? 1.5 : 1
    totalWeight += weight
    weightedSum += a.accuracy * weight
  }
  return Math.round(weightedSum / totalWeight)
}

/**
 * Compute a confidence score (0-100) combining accuracy, attempt volume, and recency.
 * - accuracy contributes 50% (higher accuracy = higher confidence)
 * - attempt volume contributes 30% (more attempts = more confidence in the assessment)
 * - recency contributes 20% (recent data = more relevant)
 */
export function computeConfidenceScore(
  accuracy: number,
  attemptCount: number,
  lastAttempt: string,
): number {
  const attemptsScore = Math.min(100, attemptCount * 20) // 5+ attempts = max score
  const daysSinceLastAttempt = (Date.now() - new Date(lastAttempt).getTime()) / (1000 * 60 * 60 * 24)
  const recencyScore = Math.max(0, Math.round(100 - daysSinceLastAttempt * 5)) // decays 5/day
  return Math.round(accuracy * 0.5 + attemptsScore * 0.3 + recencyScore * 0.2)
}

// ─── Action suggestions per severity & content type ─────────────────

function getRecommendedAction(
  severity: WeaknessItem['severity'],
  contentType: WeaknessItem['contentType'],
  subjectName: string,
): { action: string; route: string } {
  if (severity === 'critical' || severity === 'high') {
    if (contentType === 'mcq') {
      return {
        action: `${subjectName} — MCQ অনুশীলন করুন`,
        route: 'mcq-practice',
      }
    }
    if (contentType === 'cq') {
      return {
        action: `${subjectName} — CQ লেখার অনুশীলন করুন`,
        route: 'cq-practice',
      }
    }
    return {
      action: `${subjectName} — লেকচার পুনরায় দেখুন`,
      route: 'subjects',
    }
  }
  // medium
  if (contentType === 'mcq') {
    return {
      action: `${subjectName} — আরও MCQ সমাধান করুন`,
      route: 'mcq-practice',
    }
  }
  if (contentType === 'cq') {
    return {
      action: `${subjectName} — CQ উত্তর লেখার অভ্যাস করুন`,
      route: 'cq-practice',
    }
  }
  return {
    action: `${subjectName} — পরবর্তী লেকচারে এগিয়ে যান`,
    route: 'subjects',
  }
}

/**
 * Generate convenience arrays from the full items list for backward-compatible response.
 */
export function buildConvenienceArrays(items: WeaknessItem[]) {
  const weakSubjects = items.filter(
    i => i.severity !== 'healthy' && !i.chapterId && !i.topicId,
  )
  const weakChapters = items.filter(
    i => i.severity !== 'healthy' && !!i.chapterId && !i.topicId,
  )
  const weakTopics = items.filter(
    i => i.severity !== 'healthy' && !!i.topicId,
  )
  const recommendedActions: WeaknessAction[] = items
    .filter(i => i.severity !== 'healthy')
    .map(i => ({
      itemId: i.id,
      action: i.recommendedAction,
      route: i.recommendedRoute,
      routeParams: i.recommendedRouteParams,
    }))

  return { weakSubjects, weakChapters, weakTopics, recommendedActions }
}

// ─── Main handler ───────────────────────────────────────────────────

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
    const recentCutoff = new Date()
    recentCutoff.setDate(recentCutoff.getDate() - RECENT_WINDOW_DAYS)

    const items: WeaknessItem[] = []

    // ──────────────────────────────────────────────────────────────
    // 1. EXAM RESULTS — group by subject and chapter
    // ──────────────────────────────────────────────────────────────
    const examResults = await db.examResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 500,
      select: {
        percentage: true,
        correct: true,
        wrong: true,
        skipped: true,
        completedAt: true,
        exam: {
          select: { subjectId: true, title: true, chapterIds: true },
        },
      },
    })

    // Group by subject
    const subjectAttempts = new Map<
      string,
      {
        name: string
        attempts: { accuracy: number; isRecent: boolean; total: number; correct: number; wrong: number; completedAt: Date }[]
      }
    >()

    for (const r of examResults) {
      if (!r.exam?.subjectId) continue
      const entry = subjectAttempts.get(r.exam.subjectId) || {
        name: r.exam.title || '',
        attempts: [],
      }
      entry.attempts.push({
        accuracy: r.percentage,
        isRecent: r.completedAt >= recentCutoff,
        total: r.correct + r.wrong + r.skipped,
        correct: r.correct,
        wrong: r.wrong,
        completedAt: r.completedAt,
      })
      subjectAttempts.set(r.exam.subjectId, entry)
    }

    // Resolve subject names
    const subjectIds = Array.from(subjectAttempts.keys())
    let subjectMap = new Map<string, string>()
    if (subjectIds.length > 0) {
      const subjects = await db.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
      })
      subjectMap = new Map(subjects.map(s => [s.id, s.name]))
    }

    // Resolve chapter names for all relevant chapterIds
    let chapterMap = new Map<string, { name: string; subjectId: string }>()

    async function ensureChapterMap(chapterIds: string[]) {
      const missing = chapterIds.filter(cid => !chapterMap.has(cid))
      if (missing.length === 0) return
      const chapters = await db.chapter.findMany({
        where: { id: { in: missing } },
        select: { id: true, name: true, subjectId: true },
      })
      for (const ch of chapters) {
        chapterMap.set(ch.id, { name: ch.name, subjectId: ch.subjectId })
      }
    }

    // Build weakness items per subject (MCQ)
    for (const [subjectId, data] of subjectAttempts.entries()) {
      const subjectName = subjectMap.get(subjectId) || data.name
      const allAttempts = data.attempts
      const totalAttempts = allAttempts.length
      const totalCorrect = allAttempts.reduce((s, a) => s + a.correct, 0)
      const totalWrong = allAttempts.reduce((s, a) => s + a.wrong, 0)

      const overallAccuracy = weightedAccuracy(allAttempts)

      // Recent vs older for trend
      const recent = allAttempts.filter(a => a.isRecent)
      const older = allAttempts.filter(a => !a.isRecent)
      const recentAvg = recent.length > 0
        ? recent.reduce((s, a) => s + a.accuracy, 0) / recent.length
        : null
      const olderAvg = older.length > 0
        ? older.reduce((s, a) => s + a.accuracy, 0) / older.length
        : null
      const trend = computeTrend(recentAvg, olderAvg)
      const severity = accuracyToSeverity(overallAccuracy)

      const lastAttempt = allAttempts.reduce(
        (latest, a) => (a.completedAt > latest ? a.completedAt : latest),
        allAttempts[0].completedAt,
      )
      const lastAttemptStr = lastAttempt.toISOString()
      const confidenceScore = computeConfidenceScore(overallAccuracy, totalAttempts, lastAttemptStr)

      const { action, route } = getRecommendedAction(severity, 'mcq', subjectName)

      items.push({
        id: `subject-mcq-${subjectId}`,
        subjectId,
        subjectName,
        contentType: 'mcq',
        attemptCount: totalAttempts,
        correctCount: totalCorrect,
        wrongCount: totalWrong,
        accuracy: overallAccuracy,
        severity,
        trend,
        lastAttempt: lastAttemptStr,
        confidenceScore,
        recommendedAction: action,
        recommendedRoute: route,
        recommendedRouteParams: { subjectId },
      })
    }

    // ──────────────────────────────────────────────────────────────
    // 2. MCQ EXAM SET RESULTS — group by subject AND chapter
    // ──────────────────────────────────────────────────────────────
    const mcqSetResults = await db.mCQExamSetResult.findMany({
      where: { userId, status: 'completed' },
      orderBy: { submittedAt: 'desc' },
      take: 500,
      select: {
        totalCorrect: true,
        totalWrong: true,
        totalSkipped: true,
        submittedAt: true,
        answers: true,
        set: {
          select: {
            packageId: true,
            package: {
              select: { subjectIds: true },
            },
          },
        },
      },
    })

    // Collect all MCQ IDs from answers for batch chapter lookup
    const allMcqIds = new Set<string>()
    for (const r of mcqSetResults) {
      if (!r.answers) continue
      try {
        const parsed = JSON.parse(r.answers)
        for (const mcqId of Object.keys(parsed)) {
          allMcqIds.add(mcqId)
        }
      } catch { /* ignore */ }
    }

    // Batch load MCQs chapterId and correctAnswer
    const mcqChapterMap = new Map<string, { chapterId: string; correctAnswer: string; topic: string | null }>()
    if (allMcqIds.size > 0) {
      const mcqs = await db.mCQ.findMany({
        where: { id: { in: Array.from(allMcqIds) } },
        select: { id: true, chapterId: true, correctAnswer: true, topic: true },
      })
      for (const m of mcqs) {
        mcqChapterMap.set(m.id, { chapterId: m.chapterId, correctAnswer: m.correctAnswer, topic: m.topic || null })
      }
    }

    // Aggregate subject-level (existing logic preserved) + chapter-level (new)
    const mcqSetSubjectMap = new Map<string, { correct: number; wrong: number; count: number; isRecent: boolean; submittedAt: Date }[]>()
    const mcqSetChapterMap = new Map<string, { correct: number; wrong: number; count: number; isRecent: boolean; submittedAt: Date }[]>()
    const mcqSetTopicMap = new Map<string, { correct: number; wrong: number; count: number; isRecent: boolean; submittedAt: Date; topicName: string }[]>()

    for (const r of mcqSetResults) {
      if (!r.submittedAt) continue
      let pkgSubjects: string[] = []
      try {
        pkgSubjects = JSON.parse(r.set.package.subjectIds || '[]')
      } catch { /* ignore */ }

      const isRecent = r.submittedAt >= recentCutoff
      const submittedAt = r.submittedAt

      // Subject-level aggregation
      for (const sid of pkgSubjects) {
        const entryArr = mcqSetSubjectMap.get(sid) || []
        entryArr.push({ correct: r.totalCorrect, wrong: r.totalWrong, count: r.totalCorrect + r.totalWrong + r.totalSkipped, isRecent, submittedAt })
        mcqSetSubjectMap.set(sid, entryArr)
      }

      // Chapter-level & topic-level from per-question answers
      if (r.answers) {
        try {
          const parsed = JSON.parse(r.answers) as Record<string, string>
          // Track per-chapter and per-topic within this result
          const chapterTotals = new Map<string, { correct: number; wrong: number; count: number }>()
          const topicTotals = new Map<string, { correct: number; wrong: number; count: number; topicName: string }>()

          for (const [mcqId, selectedAnswer] of Object.entries(parsed)) {
            const mcqInfo = mcqChapterMap.get(mcqId)
            if (!mcqInfo) continue
            const isCorrect = selectedAnswer.toUpperCase() === mcqInfo.correctAnswer.toUpperCase()
            const chId = mcqInfo.chapterId

            // Chapter
            const chEntry = chapterTotals.get(chId) || { correct: 0, wrong: 0, count: 0 }
            chEntry.count++
            if (isCorrect) chEntry.correct++
            else chEntry.wrong++
            chapterTotals.set(chId, chEntry)

            // Topic
            if (mcqInfo.topic) {
              const topicKey = `${chId}-${mcqInfo.topic}`
              const tEntry = topicTotals.get(topicKey) || { correct: 0, wrong: 0, count: 0, topicName: mcqInfo.topic }
              tEntry.count++
              if (isCorrect) tEntry.correct++
              else tEntry.wrong++
              topicTotals.set(topicKey, tEntry)
            }
          }

          // Push chapter-level
          for (const [chId, chData] of chapterTotals) {
            const entryArr = mcqSetChapterMap.get(chId) || []
            entryArr.push({ correct: chData.correct, wrong: chData.wrong, count: chData.count, isRecent, submittedAt })
            mcqSetChapterMap.set(chId, entryArr)
          }

          // Push topic-level
          for (const [topicKey, tData] of topicTotals) {
            const entryArr = mcqSetTopicMap.get(topicKey) || []
            entryArr.push({ correct: tData.correct, wrong: tData.wrong, count: tData.count, isRecent, submittedAt, topicName: tData.topicName })
            mcqSetTopicMap.set(topicKey, entryArr)
          }
        } catch { /* ignore */ }
      }
    }

    // Merge subject-level MCQ results from sets into existing items or create new
    for (const [subjectId, attempts] of mcqSetSubjectMap.entries()) {
      const subjectName = subjectMap.get(subjectId) || ''
      if (!subjectName) {
        const subj = await db.subject.findUnique({
          where: { id: subjectId },
          select: { name: true },
        })
        if (subj) {
          subjectMap.set(subjectId, subj.name)
        }
      }
      const resolvedName = subjectMap.get(subjectId) || ''

      const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0)
      const totalWrong = attempts.reduce((s, a) => s + a.wrong, 0)
      const totalAttempts = attempts.reduce((s, a) => s + a.count, 0)
      const overallAccuracy = totalAttempts > 0
        ? Math.round((totalCorrect / totalAttempts) * 100)
        : 100

      const recent = attempts.filter(a => a.isRecent)
      const older = attempts.filter(a => !a.isRecent)
      const recentAvg = recent.length > 0
        ? (recent.reduce((s, a) => s + (a.count > 0 ? (a.correct / a.count) * 100 : 0), 0) / recent.length)
        : null
      const olderAvg = older.length > 0
        ? (older.reduce((s, a) => s + (a.count > 0 ? (a.correct / a.count) * 100 : 0), 0) / older.length)
        : null
      const trend = computeTrend(recentAvg, olderAvg)
      const severity = accuracyToSeverity(overallAccuracy)
      const lastAttempt = attempts.reduce(
        (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
        attempts[0].submittedAt,
      )
      const lastAttemptStr = lastAttempt.toISOString()
      const confidenceScore = computeConfidenceScore(overallAccuracy, totalAttempts, lastAttemptStr)

      const { action, route } = getRecommendedAction(severity, 'mcq', resolvedName)

      const existingIdx = items.findIndex(i => i.subjectId === subjectId && i.contentType === 'mcq')
      if (existingIdx >= 0) {
        const existing = items[existingIdx]
        existing.attemptCount += totalAttempts
        existing.correctCount += totalCorrect
        existing.wrongCount += totalWrong
        existing.accuracy = existing.attemptCount > 0
          ? Math.round((existing.correctCount / existing.attemptCount) * 100)
          : 100
        existing.severity = accuracyToSeverity(existing.accuracy)
        if (new Date(lastAttempt) > new Date(existing.lastAttempt)) {
          existing.lastAttempt = lastAttemptStr
        }
        existing.confidenceScore = computeConfidenceScore(existing.accuracy, existing.attemptCount, existing.lastAttempt)
        items[existingIdx] = existing
      } else {
        items.push({
          id: `subject-mcq-set-${subjectId}`,
          subjectId,
          subjectName: resolvedName,
          contentType: 'mcq',
          attemptCount: totalAttempts,
          correctCount: totalCorrect,
          wrongCount: totalWrong,
          accuracy: overallAccuracy,
          severity,
          trend,
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: action,
          recommendedRoute: route,
          recommendedRouteParams: { subjectId },
        })
      }
    }

    // ─── Chapter-level MCQ from set results ──────────────────────
    if (mcqSetChapterMap.size > 0) {
      const allChapterIds = Array.from(mcqSetChapterMap.keys())
      await ensureChapterMap(allChapterIds)

      for (const [chapterId, attempts] of mcqSetChapterMap.entries()) {
        const chInfo = chapterMap.get(chapterId)
        if (!chInfo) continue

        const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0)
        const totalWrong = attempts.reduce((s, a) => s + a.wrong, 0)
        const totalAttempts = attempts.reduce((s, a) => s + a.count, 0)
        const overallAccuracy = totalAttempts > 0
          ? Math.round((totalCorrect / totalAttempts) * 100)
          : 100

        const recent = attempts.filter(a => a.isRecent)
        const older = attempts.filter(a => !a.isRecent)
        const recentAvg = recent.length > 0
          ? (recent.reduce((s, a) => s + (a.count > 0 ? (a.correct / a.count) * 100 : 0), 0) / recent.length)
          : null
        const olderAvg = older.length > 0
          ? (older.reduce((s, a) => s + (a.count > 0 ? (a.correct / a.count) * 100 : 0), 0) / older.length)
          : null
        const trend = computeTrend(recentAvg, olderAvg)
        const severity = accuracyToSeverity(overallAccuracy)
        const subjectName = subjectMap.get(chInfo.subjectId) || ''
        const lastAttempt = attempts.reduce(
          (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
          attempts[0].submittedAt,
        )
        const lastAttemptStr = lastAttempt.toISOString()
        const confidenceScore = computeConfidenceScore(overallAccuracy, totalAttempts, lastAttemptStr)

        const { action, route } = getRecommendedAction(severity, 'mcq', subjectName)

        items.push({
          id: `chapter-mcq-${chapterId}`,
          subjectId: chInfo.subjectId,
          chapterId,
          subjectName,
          chapterName: chInfo.name,
          contentType: 'mcq',
          attemptCount: totalAttempts,
          correctCount: totalCorrect,
          wrongCount: totalWrong,
          accuracy: overallAccuracy,
          severity,
          trend,
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: action,
          recommendedRoute: route,
          recommendedRouteParams: { subjectId: chInfo.subjectId, chapterId },
        })
      }
    }

    // ─── Topic-level MCQ from set results ────────────────────────
    if (mcqSetTopicMap.size > 0) {
      for (const [topicKey, attempts] of mcqSetTopicMap.entries()) {
        // topicKey format: `${chapterId}-${topicName}`
        const [chapterId, ...nameParts] = topicKey.split('-')
        const topicName = nameParts.join('-')
        if (!chapterId || !topicName) continue

        const chInfo = chapterMap.get(chapterId)
        if (!chInfo) continue

        const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0)
        const totalWrong = attempts.reduce((s, a) => s + a.wrong, 0)
        const totalAttempts = attempts.reduce((s, a) => s + a.count, 0)
        const overallAccuracy = totalAttempts > 0
          ? Math.round((totalCorrect / totalAttempts) * 100)
          : 100
        const severity = accuracyToSeverity(overallAccuracy)
        const subjectName = subjectMap.get(chInfo.subjectId) || ''
        const lastAttempt = attempts.reduce(
          (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
          attempts[0].submittedAt,
        )
        const lastAttemptStr = lastAttempt.toISOString()
        const confidenceScore = computeConfidenceScore(overallAccuracy, totalAttempts, lastAttemptStr)

        items.push({
          id: `topic-mcq-${topicKey}`,
          subjectId: chInfo.subjectId,
          chapterId,
          topicId: topicKey,
          subjectName,
          chapterName: chInfo.name,
          topicName,
          contentType: 'mcq',
          attemptCount: totalAttempts,
          correctCount: totalCorrect,
          wrongCount: totalWrong,
          accuracy: overallAccuracy,
          severity,
          trend: 'stable',
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: getRecommendedAction(severity, 'mcq', subjectName).action,
          recommendedRoute: 'mcq-practice',
          recommendedRouteParams: { subjectId: chInfo.subjectId, chapterId },
        })
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 3. CQ EXAM SUBMISSIONS — group by subject AND chapter
    // ──────────────────────────────────────────────────────────────
    const cqSubmissions = await db.cQExamSubmission.findMany({
      where: {
        userId,
        status: { in: ['submitted', 'graded', 'published'] },
      },
      orderBy: { submittedAt: 'desc' },
      take: 500,
      select: {
        totalMarks: true,
        obtainedMarks: true,
        submittedAt: true,
        answers: true,
        set: {
          select: {
            package: {
              select: { subjectIds: true },
            },
            questions: {
              select: {
                cqId: true,
                cq: { select: { chapterId: true, topic: true } },
              },
            },
          },
        },
      },
    })

    // Build chapter/topic mapping for CQ questions
    const cqChapterMap = new Map<string, { chapterId: string; topic: string | null }>()
    for (const s of cqSubmissions) {
      for (const q of s.set.questions) {
        if (q.cqId && q.cq) {
          cqChapterMap.set(q.cqId, { chapterId: q.cq.chapterId, topic: q.cq.topic || null })
        }
      }
    }

    const cqSubjectMap = new Map<string, { marks: number; total: number; isRecent: boolean; submittedAt: Date }[]>()
    const cqChapterMapAgg = new Map<string, { marks: number; total: number; isRecent: boolean; submittedAt: Date }[]>()

    for (const s of cqSubmissions) {
      if (!s.submittedAt) continue
      let pkgSubjects: string[] = []
      try {
        pkgSubjects = JSON.parse(s.set.package.subjectIds || '[]')
      } catch { /* ignore */ }
      if (pkgSubjects.length === 0) continue

      const isRecent = s.submittedAt >= recentCutoff
      const submittedAt = s.submittedAt

      for (const sid of pkgSubjects) {
        const entryArr = cqSubjectMap.get(sid) || []
        entryArr.push({ marks: s.obtainedMarks, total: s.totalMarks, isRecent, submittedAt })
        cqSubjectMap.set(sid, entryArr)
      }

      // Chapter-level: split marks across chapters based on question distribution
      const cqQuestions = s.set.questions.filter(q => q.cqId && q.cq)
      if (cqQuestions.length > 0) {
        // Evenly distribute marks per question across chapters
        const marksPerQuestion = s.totalMarks / cqQuestions.length
        const obtainedPerQuestion = s.obtainedMarks / cqQuestions.length
        for (const q of cqQuestions) {
          if (!q.cq) continue
          const chId = q.cq.chapterId
          const entryArr = cqChapterMapAgg.get(chId) || []
          entryArr.push({
            marks: obtainedPerQuestion,
            total: marksPerQuestion,
            isRecent,
            submittedAt,
          })
          cqChapterMapAgg.set(chId, entryArr)
        }
      }
    }

    for (const [subjectId, attempts] of cqSubjectMap.entries()) {
      const subjectName = subjectMap.get(subjectId)
      if (!subjectName) continue

      const totalMarks = attempts.reduce((s, a) => s + a.total, 0)
      const obtainedMarks = attempts.reduce((s, a) => s + a.marks, 0)
      const overallAccuracy = totalMarks > 0
        ? Math.round((obtainedMarks / totalMarks) * 100)
        : 100

      const recent = attempts.filter(a => a.isRecent)
      const older = attempts.filter(a => !a.isRecent)
      const recentAvg = recent.length > 0
        ? (recent.reduce((s, a) => s + (a.total > 0 ? (a.marks / a.total) * 100 : 0), 0) / recent.length)
        : null
      const olderAvg = older.length > 0
        ? (older.reduce((s, a) => s + (a.total > 0 ? (a.marks / a.total) * 100 : 0), 0) / older.length)
        : null
      const trend = computeTrend(recentAvg, olderAvg)
      const severity = accuracyToSeverity(overallAccuracy)
      const lastAttempt = attempts.reduce(
        (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
        attempts[0].submittedAt,
      )
      const lastAttemptStr = lastAttempt.toISOString()
      const confidenceScore = computeConfidenceScore(overallAccuracy, attempts.length, lastAttemptStr)

      const existingIdx = items.findIndex(i => i.subjectId === subjectId && i.contentType === 'cq')

      if (existingIdx >= 0) {
        const existing = items[existingIdx]
        existing.attemptCount += attempts.length
        existing.correctCount += obtainedMarks
        existing.wrongCount += totalMarks - obtainedMarks
        existing.accuracy = existing.attemptCount > 0
          ? Math.round((existing.correctCount / (existing.correctCount + existing.wrongCount)) * 100)
          : 100
        existing.severity = accuracyToSeverity(existing.accuracy)
        if (new Date(lastAttempt) > new Date(existing.lastAttempt)) {
          existing.lastAttempt = lastAttemptStr
        }
        existing.confidenceScore = computeConfidenceScore(existing.accuracy, existing.attemptCount, existing.lastAttempt)
        items[existingIdx] = existing
      } else {
        items.push({
          id: `subject-cq-${subjectId}`,
          subjectId,
          subjectName,
          contentType: 'cq',
          attemptCount: attempts.length,
          correctCount: Math.round(obtainedMarks),
          wrongCount: Math.round(totalMarks - obtainedMarks),
          accuracy: overallAccuracy,
          severity,
          trend,
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: getRecommendedAction(severity, 'cq', subjectName).action,
          recommendedRoute: 'cq-practice',
          recommendedRouteParams: { subjectId },
        })
      }
    }

    // ─── Chapter-level CQ from submissions ───────────────────────
    if (cqChapterMapAgg.size > 0) {
      const allChapterIds = Array.from(cqChapterMapAgg.keys())
      await ensureChapterMap(allChapterIds)

      for (const [chapterId, attempts] of cqChapterMapAgg.entries()) {
        const chInfo = chapterMap.get(chapterId)
        if (!chInfo) continue

        const totalMarks = attempts.reduce((s, a) => s + a.total, 0)
        const obtainedMarks = attempts.reduce((s, a) => s + a.marks, 0)
        const overallAccuracy = totalMarks > 0
          ? Math.round((obtainedMarks / totalMarks) * 100)
          : 100

        const severity = accuracyToSeverity(overallAccuracy)
        const subjectName = subjectMap.get(chInfo.subjectId) || ''
        const lastAttempt = attempts.reduce(
          (latest, a) => (a.submittedAt > latest ? a.submittedAt : latest),
          attempts[0].submittedAt,
        )
        const lastAttemptStr = lastAttempt.toISOString()
        const confidenceScore = computeConfidenceScore(overallAccuracy, attempts.length, lastAttemptStr)

        items.push({
          id: `chapter-cq-${chapterId}`,
          subjectId: chInfo.subjectId,
          chapterId,
          subjectName,
          chapterName: chInfo.name,
          contentType: 'cq',
          attemptCount: attempts.length,
          correctCount: Math.round(obtainedMarks),
          wrongCount: Math.round(totalMarks - obtainedMarks),
          accuracy: overallAccuracy,
          severity,
          trend: 'stable',
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: getRecommendedAction(severity, 'cq', subjectName).action,
          recommendedRoute: 'cq-practice',
          recommendedRouteParams: { subjectId: chInfo.subjectId, chapterId },
        })
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 4. LECTURE PROGRESS — identify incomplete lectures as weakness
    // ──────────────────────────────────────────────────────────────
    const lectureProgress = await db.progress.findMany({
      where: {
        userId,
        contentType: 'lecture',
        progress: { lt: 100 },
      },
      select: {
        contentId: true,
        progress: true,
        lastAccessed: true,
      },
      orderBy: { lastAccessed: 'desc' },
      take: 20,
    })

    if (lectureProgress.length > 0) {
      const lectureIds = lectureProgress.map(p => p.contentId)
      const lectures = await db.lecture.findMany({
        where: { id: { in: lectureIds } },
        select: {
          id: true,
          title: true,
          chapter: { select: { id: true, name: true, subjectId: true, subject: { select: { name: true } } } },
        },
      })
      const lectureMap = new Map(lectures.map(l => [l.id, l]))

      const chapterIncomplete = new Map<string, {
        chapterId: string
        chapterName: string
        subjectId: string
        subjectName: string
        total: number
        completed: number
        lastAccessed: Date
      }>()

      for (const p of lectureProgress) {
        const lecture = lectureMap.get(p.contentId)
        if (!lecture?.chapter) continue
        const entry = chapterIncomplete.get(lecture.chapter.id) || {
          chapterId: lecture.chapter.id,
          chapterName: lecture.chapter.name,
          subjectId: lecture.chapter.subjectId,
          subjectName: lecture.chapter.subject?.name || '',
          total: 0,
          completed: 0,
          lastAccessed: p.lastAccessed,
        }
        entry.total++
        if (p.progress >= 100) entry.completed++
        if (p.lastAccessed > entry.lastAccessed) entry.lastAccessed = p.lastAccessed
        chapterIncomplete.set(lecture.chapter.id, entry)
      }

      for (const [, entry] of chapterIncomplete) {
        const completionRate = entry.total > 0
          ? Math.round((entry.completed / entry.total) * 100)
          : 0
        const severity = accuracyToSeverity(completionRate)
        const lastAttemptStr = entry.lastAccessed.toISOString()
        const confidenceScore = computeConfidenceScore(completionRate, entry.total, lastAttemptStr)

        items.push({
          id: `chapter-lecture-${entry.chapterId}`,
          subjectId: entry.subjectId,
          chapterId: entry.chapterId,
          subjectName: entry.subjectName,
          chapterName: entry.chapterName,
          contentType: 'lecture',
          attemptCount: entry.total,
          correctCount: entry.completed,
          wrongCount: entry.total - entry.completed,
          accuracy: completionRate,
          severity,
          trend: 'stable',
          lastAttempt: lastAttemptStr,
          confidenceScore,
          recommendedAction: getRecommendedAction(severity, 'lecture', entry.subjectName).action,
          recommendedRoute: 'subjects',
          recommendedRouteParams: { subjectId: entry.subjectId, chapterId: entry.chapterId },
        })
      }
    }

    // ──────────────────────────────────────────────────────────────
    // SORT: critical → high → medium → healthy, then by accuracy ascending
    // ──────────────────────────────────────────────────────────────
    const severityOrder: Record<WeaknessItem['severity'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      healthy: 3,
    }

    items.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (sevDiff !== 0) return sevDiff
      return a.accuracy - b.accuracy
    })

    // ──────────────────────────────────────────────────────────────
    // BUILD SUMMARY & CONVENIENCE ARRAYS
    // ──────────────────────────────────────────────────────────────
    const summary = {
      critical: items.filter(i => i.severity === 'critical').length,
      high: items.filter(i => i.severity === 'high').length,
      medium: items.filter(i => i.severity === 'medium').length,
      healthy: items.filter(i => i.severity === 'healthy').length,
    }

    const { weakSubjects, weakChapters, weakTopics, recommendedActions } = buildConvenienceArrays(items)

    const data: WeaknessData = {
      summary,
      items,
      weakSubjects,
      weakChapters,
      weakTopics,
      recommendedActions,
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Weakness detection error:')
  }
}
