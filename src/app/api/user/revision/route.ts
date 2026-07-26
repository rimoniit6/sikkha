import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { createInAppNotification } from '@/lib/notification-service'
import { toBengaliNumerals } from '@/lib/utils'
import { generateNotificationsForContext } from '@/lib/intelligent-notifications'
import type { RevisionData, RevisionItem, RevisionSummary, RevisionUpdateRequest } from '@/types/user-dashboard'
import { computeNextReview, calculatePriority, createInitialSchedule } from '@/lib/revision-algorithm'
import { computeUserStreak } from '@/lib/user-streak'

/**
 * GET /api/user/revision
 *
 * Returns the user's revision queue, ordered by priority (most urgent first).
 * Dynamically seeds the queue from existing data sources if empty.
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

    // 1. Fetch existing revision queue items
    let queueItems = await db.revisionQueue.findMany({
      where: { userId },
      orderBy: { nextReviewAt: 'asc' },
    })

    // 2. If queue is empty, seed it dynamically from existing data
    if (queueItems.length === 0) {
      await seedRevisionQueue(userId)
      queueItems = await db.revisionQueue.findMany({
        where: { userId },
        orderBy: { nextReviewAt: 'asc' },
      })
    }

    // 3. Get study streak for priority calculation
    const streakData = await computeUserStreak(userId)
    const studyStreak = streakData.currentStreak

    // 4. Generate revision reminders for overdue items
    const now = new Date()
    const overdueItems = queueItems.filter(q => !q.isCompleted && q.nextReviewAt < now)
    if (overdueItems.length > 0) {
      const existingReminder = await db.notification.findFirst({
        where: {
          userId,
          title: 'রিভিশন reminder',
          createdAt: { gte: new Date(Date.now() - 86400000) }, // Within last 24h
        },
      })
      if (!existingReminder) {
        await createInAppNotification(db as any, {
          userId,
          title: 'রিভিশন রিমাইন্ডার',
          message: `আপনার ${toBengaliNumerals(overdueItems.length)}টি আইটেম রিভিউ করার সময় হয়েছে!`,
          type: 'WARNING',
          link: '/user/dashboard',
        }).catch(() => {}) // Best-effort — don't fail the request
      }
    }

    // 5. Compute priority and build response items
    const items: RevisionItem[] = queueItems.map((q) => {
      const routeParams = q.routeParams ? tryParseJson(q.routeParams) : undefined
      const priority = calculatePriority(q.nextReviewAt, q.confidenceScore, q.reviewCount, studyStreak)
      const reviewDuration = estimateReviewDuration(q.contentType, q.routeParams)
      return {
        id: q.id,
        contentType: q.contentType as RevisionItem['contentType'],
        contentId: q.contentId,
        subjectId: q.subjectId,
        chapterId: q.chapterId || undefined,
        title: q.title,
        subtitle: q.subtitle || undefined,
        intervalDays: q.intervalDays,
        easeFactor: q.easeFactor,
        reviewCount: q.reviewCount,
        confidenceScore: q.confidenceScore,
        nextReviewAt: q.nextReviewAt.toISOString(),
        lastReviewedAt: q.lastReviewedAt?.toISOString(),
        isCompleted: q.isCompleted,
        route: q.route,
        routeParams,
        priority,
        reviewDuration,
      }
    })

    // Sort by priority descending (most urgent first)
    items.sort((a, b) => b.priority - a.priority)

    // 5. Build summary
    const summary = computeRevisionSummary(items)

    const data: RevisionData = { items, summary }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Revision queue error:')
  }
}

/**
 * PATCH /api/user/revision
 *
 * Update a revision item (mark complete, update confidence, etc.)
 * Body: { id: string; quality: 0|1|2|3; skip?: boolean }
 */
export async function PATCH(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'প্রমাণীকরণ প্রয়োজন।' },
        { status: 401 },
      )
    }

    const userId = auth.user.id
    const body: RevisionUpdateRequest = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'রিভিশন আইডি প্রয়োজন।' },
        { status: 400 },
      )
    }

    const existing = await db.revisionQueue.findFirst({
      where: { id: body.id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'রিভিশন আইটেম খুঁজে পাওয়া যায়নি।' },
        { status: 404 },
      )
    }

    if (body.skip) {
      // Skip: move to tomorrow with same interval
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await db.revisionQueue.update({
        where: { id: body.id },
        data: {
          nextReviewAt: tomorrow,
          lastReviewedAt: new Date(),
          isCompleted: false,
        },
      })
    } else {
      // Review completed — apply SM-2 algorithm
      const { interval, easeFactor } = computeNextReview(
        existing.intervalDays,
        existing.reviewCount,
        existing.easeFactor,
        body.quality,
      )

      const nextReviewAt = new Date()
      nextReviewAt.setDate(nextReviewAt.getDate() + interval)

      // Compute new confidence score based on quality
      const qualityDelta = body.quality === 0 ? -15 : body.quality === 1 ? -5 : body.quality === 2 ? 5 : 15
      const newConfidence = Math.max(0, Math.min(100, existing.confidenceScore + qualityDelta))

      await db.revisionQueue.update({
        where: { id: body.id },
        data: {
          intervalDays: interval,
          easeFactor: easeFactor,
          reviewCount: { increment: 1 },
          confidenceScore: newConfidence,
          nextReviewAt,
          lastReviewedAt: new Date(),
          isCompleted: true,
        },
      })
    }

    // Trigger context-aware notification generation after revision update
    generateNotificationsForContext(userId, 'revision-complete').catch(() => {})

    return NextResponse.json({ success: true, data: { updated: true } })
  } catch (error) {
    return handleApiError(error, 'Revision update error:')
  }
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

/**
 * Seed the revision queue from existing user data sources.
 * Called once when the queue is empty.
 */
async function seedRevisionQueue(userId: string) {

  // ─── 1. Incomplete lectures ────────────────────────────────────
  const incompleteProgress = await db.progress.findMany({
    where: { userId, contentType: 'lecture', progress: { lt: 100 } },
    select: { contentId: true, progress: true, lastAccessed: true },
    orderBy: { lastAccessed: 'desc' },
    take: 30,
  })

  if (incompleteProgress.length > 0) {
    const lectureIds = incompleteProgress.map(p => p.contentId)
    const lectures = await db.lecture.findMany({
      where: { id: { in: lectureIds }, isActive: true },
      select: {
        id: true, title: true,
        chapter: { select: { id: true, name: true, subjectId: true } },
      },
    })
    const lectureMap = new Map(lectures.map(l => [l.id, l]))

    for (const p of incompleteProgress) {
      const lecture = lectureMap.get(p.contentId)
      if (!lecture) continue
      const schedule = createInitialSchedule()
      // Stagger by progress: less progress = sooner review
      const offsetHours = Math.round((100 - p.progress) / 10)
      schedule.nextReviewAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000)

      await db.revisionQueue.upsert({
        where: { userId_contentType_contentId: { userId, contentType: 'lecture', contentId: lecture.id } },
        update: { nextReviewAt: schedule.nextReviewAt },
        create: {
          userId,
          contentType: 'lecture',
          contentId: lecture.id,
          subjectId: lecture.chapter.subjectId,
          chapterId: lecture.chapter.id,
          title: lecture.title,
          subtitle: lecture.chapter.name,
          confidenceScore: Math.round(p.progress),
          nextReviewAt: schedule.nextReviewAt,
          intervalDays: schedule.intervalDays,
          route: 'lecture-viewer',
          routeParams: JSON.stringify({ lectureId: lecture.id }),
        },
      })
    }
  }

  // ─── 2. Weak MCQ chapters ──────────────────────────────────────
  // Find chapters where the user has low accuracy from exam results
  const examResults = await db.examResult.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: 200,
    select: { percentage: true, exam: { select: { subjectId: true, chapterIds: true } } },
  })

  const chapterAccuracy = new Map<string, { totalPercent: number; count: number; subjectId: string }>()
  for (const r of examResults) {
    if (!r.exam?.chapterIds) continue
    const chapterIds = r.exam.chapterIds.split(',').map(c => c.trim()).filter(Boolean)
    for (const chId of chapterIds) {
      const entry = chapterAccuracy.get(chId) || { totalPercent: 0, count: 0, subjectId: r.exam.subjectId || '' }
      entry.totalPercent += r.percentage
      entry.count++
      chapterAccuracy.set(chId, entry)
    }
  }

  if (chapterAccuracy.size > 0) {
    const weakChapters = Array.from(chapterAccuracy.entries())
      .filter(([_, data]) => data.count > 0 && (data.totalPercent / data.count) < 70)
      .slice(0, 10)

    const chIds = weakChapters.map(([id]) => id)
    const chapters = chIds.length > 0
      ? await db.chapter.findMany({ where: { id: { in: chIds } }, select: { id: true, name: true, subjectId: true } })
      : []
    const chapterMap = new Map(chapters.map(c => [c.id, c]))

    for (const [chapterId, data] of weakChapters) {
      const ch = chapterMap.get(chapterId)
      if (!ch) continue
      const avgPercent = data.totalPercent / data.count
      const schedule = createInitialSchedule()
      const confidence = Math.round(avgPercent)

      await db.revisionQueue.upsert({
        where: { userId_contentType_contentId: { userId, contentType: 'mcq-chapter', contentId: chapterId } },
        update: { confidenceScore: confidence },
        create: {
          userId,
          contentType: 'mcq-chapter',
          contentId: chapterId,
          subjectId: ch.subjectId,
          chapterId,
          title: ch.name,
          subtitle: 'MCQ অনুশীলন',
          confidenceScore: confidence,
          nextReviewAt: schedule.nextReviewAt,
          intervalDays: schedule.intervalDays,
          route: 'mcq-practice',
          routeParams: JSON.stringify({ subjectId: ch.subjectId, chapterId }),
        },
      })
    }
  }

  // ─── 3. Weak CQ chapters ───────────────────────────────────────
  const cqSubmissions = await db.cQExamSubmission.findMany({
    where: { userId, status: { in: ['submitted', 'graded', 'published'] } },
    select: {
      obtainedMarks: true, totalMarks: true,
      set: { select: { questions: { select: { cq: { select: { chapterId: true } } } } } },
    },
  })

  const cqChapterMarks = new Map<string, { obtained: number; total: number }>()
  for (const s of cqSubmissions) {
    const seenChapters = new Set<string>()
    for (const q of s.set.questions) {
      if (!q.cq?.chapterId || seenChapters.has(q.cq.chapterId)) continue
      seenChapters.add(q.cq.chapterId)
      const entry = cqChapterMarks.get(q.cq.chapterId) || { obtained: 0, total: 0 }
      entry.obtained += s.obtainedMarks
      entry.total += s.totalMarks
      cqChapterMarks.set(q.cq.chapterId, entry)
    }
  }

  if (cqChapterMarks.size > 0) {
    // Batch chapter lookup to avoid N+1
    const cqChapterIds = Array.from(cqChapterMarks.keys())
    const cqChapters = await db.chapter.findMany({
      where: { id: { in: cqChapterIds } },
      select: { id: true, name: true, subjectId: true },
    })
    const cqChapterMap = new Map(cqChapters.map(c => [c.id, c]))

    for (const [chapterId, marks] of cqChapterMarks) {
      if (marks.total === 0) continue
      const accuracy = Math.round((marks.obtained / marks.total) * 100)
      if (accuracy >= 75) continue // Skip healthy chapters

      const ch = cqChapterMap.get(chapterId)
      if (!ch) continue

      const schedule = createInitialSchedule()
      await db.revisionQueue.upsert({
        where: { userId_contentType_contentId: { userId, contentType: 'cq-chapter', contentId: chapterId } },
        update: { confidenceScore: accuracy },
        create: {
          userId,
          contentType: 'cq-chapter',
          contentId: chapterId,
          subjectId: ch.subjectId,
          chapterId,
          title: ch.name,
          subtitle: 'CQ লেখার অনুশীলন',
          confidenceScore: accuracy,
          nextReviewAt: schedule.nextReviewAt,
          intervalDays: schedule.intervalDays,
          route: 'cq-practice',
          routeParams: JSON.stringify({ subjectId: ch.subjectId, chapterId }),
        },
      })
    }
  }

  // ─── 4. Recently viewed content ────────────────────────────────
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 7)
  const recentViews = await db.recentlyViewed.findMany({
    where: { userId, viewedAt: { gte: recentCutoff } },
    orderBy: { viewedAt: 'desc' },
    take: 10,
  })

  // Batch lookup existing queue items and lectures to avoid N+1
  const recentLectureIds = recentViews
    .filter(rv => rv.contentType === 'lecture')
    .map(rv => rv.contentId)

  const [existingQueueItems, recentLectures] = await Promise.all([
    recentLectureIds.length > 0
      ? db.revisionQueue.findMany({
          where: { userId, contentType: 'lecture', contentId: { in: recentLectureIds } },
          select: { contentId: true },
        })
      : Promise.resolve([]),
    recentLectureIds.length > 0
      ? db.lecture.findMany({
          where: { id: { in: recentLectureIds } },
          select: { id: true, chapter: { select: { id: true, subjectId: true, name: true } } },
        })
      : Promise.resolve([]),
  ])

  const existingQueueSet = new Set(existingQueueItems.map(e => e.contentId))
  const lectureMap = new Map(recentLectures.map(l => [l.id, l]))

  for (const rv of recentViews) {
    // Map content type for revision
    let revisionContentType: string
    let route: string
    let routeParams: Record<string, string>

    if (rv.contentType === 'lecture') {
      revisionContentType = 'lecture'
      route = 'lecture-viewer'
      routeParams = { lectureId: rv.contentId }
    } else {
      continue // Only lectures for now from recently viewed
    }

    // Check if already in queue from other sources (using batch result)
    if (existingQueueSet.has(rv.contentId)) continue

    const schedule = createInitialSchedule()
    // Resolve subject for display (using batch result)
    const lecture = lectureMap.get(rv.contentId)

    await db.revisionQueue.create({
      data: {
        userId,
        contentType: revisionContentType,
        contentId: rv.contentId,
        subjectId: lecture?.chapter?.subjectId || '',
        title: rv.title,
        subtitle: lecture?.chapter?.name || undefined,
        chapterId: lecture?.chapter?.id || undefined,
        confidenceScore: 50,
        nextReviewAt: schedule.nextReviewAt,
        intervalDays: schedule.intervalDays,
        route,
        routeParams: JSON.stringify(routeParams),
      },
    })
  }

  // ─── 5. Recent exams (completed in last 7 days) ────────────────
  const recentExamCutoff = new Date()
  recentExamCutoff.setDate(recentExamCutoff.getDate() - 7)
  const recentExams = await db.examResult.findMany({
    where: { userId, completedAt: { gte: recentExamCutoff } },
    select: {
      id: true, percentage: true, exam: { select: { title: true, subjectId: true } },
    },
    take: 10,
  })

  for (const r of recentExams) {
    const schedule = createInitialSchedule()
    await db.revisionQueue.upsert({
      where: { userId_contentType_contentId: { userId, contentType: 'exam', contentId: r.id } },
      update: {},
      create: {
        userId,
        contentType: 'exam',
        contentId: r.id,
        subjectId: r.exam.subjectId || '',
        title: r.exam.title || 'পরীক্ষা',
        subtitle: 'পরীক্ষা পুনরায় দেখুন',
        confidenceScore: Math.round(r.percentage),
        nextReviewAt: schedule.nextReviewAt,
        intervalDays: schedule.intervalDays,
        route: 'exam-result',
        routeParams: JSON.stringify({ resultId: r.id }),
      },
    })
  }}

/**
 * Estimate review duration in minutes based on content type and route params.
 */
function estimateReviewDuration(contentType: string, routeParams: string | null): number {
  if (contentType === 'lecture') return 15 // Average lecture review
  if (contentType === 'mcq-chapter') return 10 // MCQ practice session
  if (contentType === 'cq-chapter') return 20 // CQ writing practice
  if (contentType === 'exam') return 15 // Exam result review
  return 10 // Default
}

/**
 * Compute current study streak for priority calculation.
 */
/**
 * Build summary statistics from revision items.
 */
function computeRevisionSummary(items: RevisionItem[]): RevisionSummary {
  const now = new Date()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todayCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) <= todayEnd).length
  const overdueCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) < now).length
  const upcomingCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) > todayEnd).length
  const completedCount = items.filter(i => i.isCompleted).length
  const totalCount = items.length
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return { todayCount, overdueCount, upcomingCount, completedCount, totalCount, completionPercent }
}

/**
 * Safely parse a JSON string, returning undefined on failure.
 */
function tryParseJson(str: string): Record<string, string> | undefined {
  try {
    return JSON.parse(str)
  } catch {
    return undefined
  }
}
