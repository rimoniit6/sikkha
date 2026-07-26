import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import type { RecommendationItem } from '@/types/user-dashboard'

/**
 * ───────────────────────────────────────────────────────────
 *  Phase 2 — Smart Recommendations API
 *
 *  Generates personalized content recommendations entirely
 *  server-side (never exposes raw user data to the client).
 *
 *  Scoring priorities (highest to lowest):
 *    1. Unfinished lectures  (progress < 100%)    → weight: 100
 *    2. Weak subjects        (avg score < 60%)     → weight: 80
 *    3. Next lecture in chapter (continuation)     → weight: 70
 *    4. Bookmarked + unattempted content           → weight: 50
 *
 *  Returns max 6 recommendations sorted by weight.
 * ───────────────────────────────────────────────────────────
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'প্রমাণীকরণ প্রয়োজন।' },
        { status: 401 }
      )
    }

    const userId = auth.user.id
    const recommendations: RecommendationItem[] = []

    // ─── 1. UNFINISHED LECTURES ─────────────────────────────────
    // Find lectures the student started but hasn't completed.
    const incompleteProgress = await db.progress.findMany({
      where: {
        userId,
        contentType: 'lecture',
        progress: { gt: 0, lt: 100 },
      },
      select: {
        contentId: true,
        progress: true,
        lastAccessed: true,
      },
      orderBy: { lastAccessed: 'desc' },
      take: 10,
    })

    if (incompleteProgress.length > 0) {
      const lectureIds = incompleteProgress.map(p => p.contentId)
      const lectures = await db.lecture.findMany({
        where: { id: { in: lectureIds }, isActive: true },
        select: {
          id: true,
          title: true,
          chapter: { select: { name: true, subject: { select: { name: true } } } },
        },
      })
      const lectureMap = new Map(lectures.map(l => [l.id, l]))

      for (const p of incompleteProgress) {
        const lecture = lectureMap.get(p.contentId)
        if (!lecture) continue
        recommendations.push({
          id: `unfinished-${p.contentId}`,
          type: 'lecture',
          title: lecture.title,
          subtitle: lecture.chapter?.subject?.name || lecture.chapter?.name,
          reason: 'চালিয়ে যান',
          reasonColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
          route: 'lecture-viewer',
          routeParams: { lectureId: p.contentId },
          progress: Math.round(p.progress),
          priority: 100,
        })
      }
    }

    // ─── 2. WEAK SUBJECTS ───────────────────────────────────────
    // Identify subjects where the student's average score is < 60%.
    // Recommend a foundational lecture or practice for that subject.
    const examResults = await db.examResult.findMany({
      where: { userId },
      select: {
        percentage: true,
        exam: { select: { subjectId: true, title: true } },
      },
    })

    const subjectScores = new Map<string, { totalPercent: number; count: number; name: string }>()
    for (const r of examResults) {
      if (!r.exam.subjectId) continue
      const entry = subjectScores.get(r.exam.subjectId) || { totalPercent: 0, count: 0, name: r.exam.title }
      entry.totalPercent += r.percentage
      entry.count++
      subjectScores.set(r.exam.subjectId, entry)
    }

    const weakSubjectIds = Array.from(subjectScores.entries())
      .filter(([_, data]) => data.count > 0 && (data.totalPercent / data.count) < 60)
      .map(([id]) => id)
      .slice(0, 2) // max 2 weak subject recommendations

    if (weakSubjectIds.length > 0) {
      const subjects = await db.subject.findMany({
        where: { id: { in: weakSubjectIds } },
        select: { id: true, name: true },
      })

      // For each weak subject, find an active lecture
      for (const subject of subjects) {
        const lecture = await db.lecture.findFirst({
          where: {
            chapter: { subjectId: subject.id },
            isActive: true,
          },
          select: { id: true, title: true, chapter: { select: { name: true } } },
          orderBy: { order: 'asc' },
        })
        if (!lecture) continue

        recommendations.push({
          id: `weak-${subject.id}`,
          type: 'lecture',
          title: lecture.title,
          subtitle: `${subject.name} — ${lecture.chapter?.name || ''}`,
          reason: 'দুর্বল বিষয়',
          reasonColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
          route: 'lecture-viewer',
          routeParams: { lectureId: lecture.id },
          priority: 80,
        })
      }
    }

    // ─── 3. NEXT LECTURE IN CHAPTER (CONTINUATION) ───────────────
    // Find the most recently viewed lecture, then recommend the
    // next ordered lecture in the same chapter.
    const lastViewedProgress = await db.progress.findFirst({
      where: { userId, contentType: 'lecture' },
      select: { contentId: true },
      orderBy: { lastAccessed: 'desc' },
    })

    if (lastViewedProgress) {
      const lastLecture = await db.lecture.findUnique({
        where: { id: lastViewedProgress.contentId },
        select: { chapterId: true, order: true, chapter: { select: { name: true, subject: { select: { name: true } } } } },
      })

      if (lastLecture) {
        const nextLecture = await db.lecture.findFirst({
          where: {
            chapterId: lastLecture.chapterId,
            order: { gt: lastLecture.order },
            isActive: true,
          },
          select: { id: true, title: true },
          orderBy: { order: 'asc' },
        })

        if (nextLecture) {
          recommendations.push({
            id: `next-${nextLecture.id}`,
            type: 'lecture',
            title: nextLecture.title,
            subtitle: lastLecture.chapter?.subject?.name || lastLecture.chapter?.name,
            reason: 'পরবর্তী লেকচার',
            reasonColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
            route: 'lecture-viewer',
            routeParams: { lectureId: nextLecture.id },
            priority: 70,
          })
        }
      }
    }

    // ─── 4. BOOKMARKED + UNATTEMPTED CONTENT ────────────────────
    // Find MCQ or lecture bookmarks that have zero Progress records.
    const bookmarks = await db.bookmark.findMany({
      where: { userId },
      select: { contentId: true, contentType: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    if (bookmarks.length > 0) {
      // Check which bookmarks have progress
      const bookmarkContentIds = bookmarks.map(b => b.contentId)
      const progressRecords = await db.progress.findMany({
        where: {
          userId,
          contentId: { in: bookmarkContentIds },
        },
        select: { contentId: true },
      })
      const attemptedSet = new Set(progressRecords.map(p => p.contentId))

      const unattemptedBookmarks = bookmarks.filter(b => !attemptedSet.has(b.contentId)).slice(0, 2)

      // For unattempted bookmarks, try to find the content title
      const lectureIds = unattemptedBookmarks.filter(b => b.contentType === 'lecture').map(b => b.contentId)
      const lectures = lectureIds.length > 0
        ? await db.lecture.findMany({
            where: { id: { in: lectureIds }, isActive: true },
            select: { id: true, title: true, chapter: { select: { name: true } } },
          })
        : []
      const lectureTitleMap = new Map(lectures.map(l => [l.id, l]))

      for (const bm of unattemptedBookmarks) {
        const title = bm.contentType === 'lecture'
          ? lectureTitleMap.get(bm.contentId)?.title
          : undefined

        recommendations.push({
          id: `bookmarked-${bm.contentId}`,
          type: 'bookmark',
          title: title || (bm.contentType === 'mcq' ? 'MCQ প্রশ্ন' : 'সেভ করা কন্টেন্ট'),
          subtitle: bm.contentType === 'lecture' ? lectureTitleMap.get(bm.contentId)?.chapter?.name : undefined,
          reason: 'আপনার বুকমার্ক',
          reasonColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
          route: bm.contentType === 'lecture' ? 'lecture-viewer' : (bm.contentType === 'mcq' ? 'mcq-practice' : 'home'),
          routeParams: { [bm.contentType === 'lecture' ? 'lectureId' : 'id']: bm.contentId },
          priority: 50,
        })
      }
    }

    // ─── DEDUPLICATE & SORT ──────────────────────────────────────
    // Remove duplicates by contentId (keep highest priority).
    const seen = new Set<string>()
    const deduped: RecommendationItem[] = []
    for (const rec of recommendations.sort((a, b) => b.priority - a.priority)) {
      const key = rec.type === 'lecture' ? `lecture-${rec.routeParams?.lectureId}` : rec.id
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(rec)
      }
    }

    // Return max 6 recommendations
    const finalRecommendations = deduped.slice(0, 6)

    return NextResponse.json({ success: true, data: finalRecommendations })
  } catch (error) {
    return handleApiError(error, 'Recommendations error:')
  }
}
