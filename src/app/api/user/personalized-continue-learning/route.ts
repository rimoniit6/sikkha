import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'
import { requireAuth } from '@/lib/auth'
import { getClassLevelForUserId } from '@/lib/class-filter'
import { getFeaturedRegistration, batchResolveFeaturedContent } from '@/lib/featured-content-registry'

/**
 * Seeded PRNG (Mulberry32) for deterministic daily rotation.
 * Same seed → same shuffle order for the whole day.
 */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic shuffle based on userId + date.
 * Within the same day, every user sees a consistent order.
 */
function seededShuffle<T>(arr: T[], userId: string): T[] {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  // Simple hash: sum char codes
  let hash = 0
  const seedStr = userId + today
  for (let i = 0; i < seedStr.length; i++) {
    const chr = seedStr.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  const rng = mulberry32(hash >>> 0)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Priority 1 — Incomplete lectures (progress < 100%).
 * Returns lectures with chapter/subject/class context for navigation.
 */
async function getIncompleteLectures(
  userId: string,
  classLevel: string | null,
  limit: number,
): Promise<
  Array<{
    id: string
    title: string
    thumbnail: string | null
    isPremium: boolean
    progress: number
    chapterId: string | null
    chapterSlug: string | null
    subjectId: string | null
    subjectSlug: string | null
    classSlug: string | null
  }>
> {
  // Get progress records where progress < 100
  const progressRecords = await db.progress.findMany({
    where: { userId, contentType: 'lecture', progress: { lt: 100 } },
    orderBy: { lastAccessed: 'desc' },
    take: limit * 2,
    select: { contentId: true, progress: true, lastAccessed: true },
  })

  if (progressRecords.length === 0) return []

  const lectureIds = progressRecords.map((p) => p.contentId)

  const lectures = await db.lecture.findMany({
    where: {
      id: { in: lectureIds },
      isActive: true,
      deletedAt: null,
      ...(classLevel ? { chapter: { subject: { class: { slug: classLevel } } } } : {}),
    },
    select: {
      id: true,
      title: true,
      thumbnail: true,
      isPremium: true,
      chapter: {
        select: {
          id: true,
          slug: true,
          subject: {
            select: {
              id: true,
              slug: true,
              class: { select: { slug: true } },
            },
          },
        },
      },
    },
  })

  const progressMap = new Map(progressRecords.map((p) => [p.contentId, p.progress]))

  return lectures.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.thumbnail || null,
    isPremium: l.isPremium,
    progress: progressMap.get(l.id) ?? 0,
    chapterId: l.chapter?.id || null,
    chapterSlug: l.chapter?.slug || null,
    subjectId: l.chapter?.subject?.id || null,
    subjectSlug: l.chapter?.subject?.slug || null,
    classSlug: l.chapter?.subject?.class?.slug || null,
  }))
}

/**
 * Priority 2 — Recently viewed lectures (not completed).
 * Excludes completed lectures (progress >= 100%).
 */
async function getRecentlyViewedLectures(
  userId: string,
  classLevel: string | null,
  excludeIds: Set<string>,
  limit: number,
): Promise<
  Array<{
    id: string
    title: string
    thumbnail: string | null
    isPremium: boolean
    chapterId: string | null
    chapterSlug: string | null
    subjectId: string | null
    subjectSlug: string | null
    classSlug: string | null
  }>
> {
  const rawItems = await db.recentlyViewed.findMany({
    where: { userId, contentType: 'lecture' },
    orderBy: { viewedAt: 'desc' },
    take: 50,
    select: { contentId: true, title: true, viewedAt: true },
  })

  if (rawItems.length === 0) return []

  // Batch-fetch progress records to exclude completed lectures
  const rawIds = [...new Set(rawItems.map((r) => r.contentId))]
  const completedProgress = await db.progress.findMany({
    where: { userId, contentType: 'lecture', contentId: { in: rawIds }, progress: { gte: 100 } },
    select: { contentId: true },
  })
  const completedIds = new Set(completedProgress.map((p) => p.contentId))

  // Deduplicate, exclude P1 IDs, and exclude completed lectures
  const seen = new Set<string>()
  const uniqueItems: typeof rawItems = []
  for (const item of rawItems) {
    if (
      !seen.has(item.contentId) &&
      !excludeIds.has(item.contentId) &&
      !completedIds.has(item.contentId)
    ) {
      seen.add(item.contentId)
      uniqueItems.push(item)
    }
    if (uniqueItems.length >= limit * 2) break
  }

  if (uniqueItems.length === 0) return []

  const lectureIds = uniqueItems.map((item) => item.contentId)

  const lectures = await db.lecture.findMany({
    where: {
      id: { in: lectureIds },
      isActive: true,
      deletedAt: null,
      ...(classLevel ? { chapter: { subject: { class: { slug: classLevel } } } } : {}),
    },
    select: {
      id: true,
      title: true,
      thumbnail: true,
      isPremium: true,
      chapter: {
        select: {
          id: true,
          slug: true,
          subject: {
            select: {
              id: true,
              slug: true,
              class: { select: { slug: true } },
            },
          },
        },
      },
    },
  })

  return lectures.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.thumbnail || null,
    isPremium: l.isPremium,
    chapterId: l.chapter?.id || null,
    chapterSlug: l.chapter?.slug || null,
    subjectId: l.chapter?.subject?.id || null,
    subjectSlug: l.chapter?.subject?.slug || null,
    classSlug: l.chapter?.subject?.class?.slug || null,
  }))
}

/**
 * Priority 3 — Recommended content (same class + same subject).
 * Fetches lectures from the user's class that aren't already in the list.
 */
async function getRecommendedLectures(
  classLevel: string | null,
  excludeIds: Set<string>,
  limit: number,
): Promise<
  Array<{
    id: string
    title: string
    thumbnail: string | null
    isPremium: boolean
    chapterId: string | null
    chapterSlug: string | null
    subjectId: string | null
    subjectSlug: string | null
    classSlug: string | null
  }>
> {
  if (!classLevel) return []

  const lectures = await db.lecture.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      id: { notIn: Array.from(excludeIds) },
      chapter: { subject: { class: { slug: classLevel } } },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      thumbnail: true,
      isPremium: true,
      chapter: {
        select: {
          id: true,
          slug: true,
          subject: {
            select: {
              id: true,
              slug: true,
              class: { select: { slug: true } },
            },
          },
        },
      },
    },
  })

  return lectures.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.thumbnail || null,
    isPremium: l.isPremium,
    chapterId: l.chapter?.id || null,
    chapterSlug: l.chapter?.slug || null,
    subjectId: l.chapter?.subject?.id || null,
    subjectSlug: l.chapter?.subject?.slug || null,
    classSlug: l.chapter?.subject?.class?.slug || null,
  }))
}

/**
 * Priority 4 — New lectures (published within last 14 days).
 */
async function getNewLectures(
  classLevel: string | null,
  excludeIds: Set<string>,
  limit: number,
): Promise<
  Array<{
    id: string
    title: string
    thumbnail: string | null
    isPremium: boolean
    chapterId: string | null
    chapterSlug: string | null
    subjectId: string | null
    subjectSlug: string | null
    classSlug: string | null
  }>
> {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const lectures = await db.lecture.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      id: { notIn: Array.from(excludeIds) },
      createdAt: { gte: fourteenDaysAgo },
      ...(classLevel ? { chapter: { subject: { class: { slug: classLevel } } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      thumbnail: true,
      isPremium: true,
      chapter: {
        select: {
          id: true,
          slug: true,
          subject: {
            select: {
              id: true,
              slug: true,
              class: { select: { slug: true } },
            },
          },
        },
      },
    },
  })

  return lectures.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.thumbnail || null,
    isPremium: l.isPremium,
    chapterId: l.chapter?.id || null,
    chapterSlug: l.chapter?.slug || null,
    subjectId: l.chapter?.subject?.id || null,
    subjectSlug: l.chapter?.subject?.slug || null,
    classSlug: l.chapter?.subject?.class?.slug || null,
  }))
}

/**
 * Priority 5 — Admin Featured content (fallback).
 */
async function getFeaturedContent(): Promise<
  Array<{
    id: string
    contentType: string
    title: string
    subtitle: string | null
    thumbnail: string | null
    isPremium: boolean
    extra: Record<string, unknown>
  }>
> {
  const featuredItems = await db.featuredContent.findMany({
    where: { section: 'homepage', isActive: true },
    orderBy: { order: 'asc' },
    take: 10,
  })

  if (featuredItems.length === 0) return []

  // Group by type for batch fetch
  const idsByType: Record<string, string[]> = {}
  const featuredMap: Record<string, Array<{ contentId: string; title: string | null; subtitle: string | null; thumbnail: string | null }>> = {}
  for (const f of featuredItems) {
    const ids = idsByType[f.contentType] || []
    ids.push(f.contentId)
    idsByType[f.contentType] = ids

    const list = featuredMap[f.contentType] || []
    list.push({ contentId: f.contentId, title: f.title, subtitle: f.subtitle, thumbnail: f.thumbnail })
    featuredMap[f.contentType] = list
  }

  // Batch-resolve all types in parallel using the registry
  const contentMaps = await Promise.all(
    Object.entries(idsByType).map(([type, ids]) =>
      batchResolveFeaturedContent(type, ids, db as never).then((map) => ({ type, map }))
    )
  )

  const contentLookup: Record<string, Record<string, Record<string, unknown>>> = {}
  for (const { type, map } of contentMaps) {
    contentLookup[type] = map
  }

  const items: Array<{
    id: string
    contentType: string
    title: string
    subtitle: string | null
    thumbnail: string | null
    isPremium: boolean
    extra: Record<string, unknown>
  }> = []

  for (const featured of featuredItems) {
    const entry = contentLookup[featured.contentType]?.[featured.contentId]
    if (!entry) continue

    const reg = getFeaturedRegistration(featured.contentType)
    if (!reg) continue

    const fList = featuredMap[featured.contentType]
    const f = Array.isArray(fList) ? fList.find((fi) => fi.contentId === featured.contentId) : undefined
    if (!f) continue

    items.push({
      id: entry.id as string,
      contentType: featured.contentType,
      title: f.title || reg.getTitle(entry),
      subtitle: f.subtitle || reg.getSubtitle(entry),
      thumbnail: f.thumbnail || reg.getThumbnail(entry),
      isPremium: reg.isPremium(entry),
      extra: reg.getSearchExtra?.(entry) || {},
    })
  }

  return items
}

interface LectureItem {
  id: string
  title: string
  thumbnail: string | null
  isPremium: boolean
  chapterId: string | null
  chapterSlug: string | null
  subjectId: string | null
  subjectSlug: string | null
  classSlug: string | null
}

interface ContinueLearningItem {
  id: string
  contentType: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  isPremium: boolean
  extra: Record<string, unknown>
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    const userId = auth.user.id
    const classLevel = auth.user.classLevel && auth.user.learningMode === 'CLASS_BASED'
      ? auth.user.classLevel
      : await getClassLevelForUserId(userId)

    const MAX_ITEMS = 10
    const OVERFETCH = 6

    // ── Priority 1: Incomplete lectures ──
    const incomplete = await getIncompleteLectures(userId, classLevel, MAX_ITEMS)
    const usedIds = new Set(incomplete.map((l) => l.id))

    const lectureToItem = (l: LectureItem): ContinueLearningItem => ({
      id: l.id,
      contentType: 'lecture',
      title: l.title,
      subtitle: null,
      thumbnail: l.thumbnail,
      isPremium: l.isPremium,
      extra: {
        chapterId: l.chapterId,
        chapterSlug: l.chapterSlug,
        subjectId: l.subjectId,
        subjectSlug: l.subjectSlug,
        classSlug: l.classSlug,
      },
    })

    const result: ContinueLearningItem[] = [...incomplete.map(lectureToItem)]

    // ── Priority 2: Recently viewed (not completed) ──
    if (result.length < MAX_ITEMS) {
      const recent = await getRecentlyViewedLectures(userId, classLevel, usedIds, MAX_ITEMS - result.length + OVERFETCH)
      for (const l of recent) {
        if (usedIds.has(l.id)) continue
        usedIds.add(l.id)
        result.push(lectureToItem(l))
        if (result.length >= MAX_ITEMS) break
      }
    }

    // ── Priority 3: Recommended (same class + subject) ──
    if (result.length < MAX_ITEMS && classLevel) {
      const recommended = await getRecommendedLectures(classLevel, usedIds, MAX_ITEMS - result.length + OVERFETCH)
      for (const l of recommended) {
        if (usedIds.has(l.id)) continue
        usedIds.add(l.id)
        result.push(lectureToItem(l))
        if (result.length >= MAX_ITEMS) break
      }
    }

    // ── Priority 4: New lectures (last 14 days) ──
    if (result.length < MAX_ITEMS) {
      const newLectures = await getNewLectures(classLevel, usedIds, MAX_ITEMS - result.length + OVERFETCH)
      for (const l of newLectures) {
        if (usedIds.has(l.id)) continue
        usedIds.add(l.id)
        result.push(lectureToItem(l))
        if (result.length >= MAX_ITEMS) break
      }
    }

    // ── Priority 5: Admin Featured (fallback) ──
    let usedFeatured = false
    if (result.length < MAX_ITEMS) {
      const featured = await getFeaturedContent()
      for (const f of featured) {
        if (usedIds.has(f.id)) continue
        usedIds.add(f.id)
        result.push(f)
        usedFeatured = true
        if (result.length >= MAX_ITEMS) break
      }
    }

    // ── Priority 6: Random fallback (newest lectures from any class) ──
    if (result.length < MAX_ITEMS) {
      const fallback = await db.lecture.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          id: { notIn: Array.from(usedIds) },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS - result.length,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          isPremium: true,
          chapter: {
            select: {
              id: true,
              slug: true,
              subject: {
                select: {
                  id: true,
                  slug: true,
                  class: { select: { slug: true } },
                },
              },
            },
          },
        },
      })
      for (const l of fallback) {
        result.push(lectureToItem({
          id: l.id,
          title: l.title,
          thumbnail: l.thumbnail || null,
          isPremium: l.isPremium,
          chapterId: l.chapter?.id || null,
          chapterSlug: l.chapter?.slug || null,
          subjectId: l.chapter?.subject?.id || null,
          subjectSlug: l.chapter?.subject?.slug || null,
          classSlug: l.chapter?.subject?.class?.slug || null,
        }))
      }
    }

    // ── Apply daily seeded rotation ──
    // If featured content was mixed in, keep featured at the end (lower priority)
    // For pure lectures, shuffle for variety
    if (!usedFeatured) {
      const shuffled = seededShuffle(result, userId)
      return NextResponse.json({ success: true, data: { items: shuffled } })
    }

    // If featured is included, split: lectures first (shuffled), featured last (preserve order)
    // All non-lecture items are featured content since that's the only other content type in the chain
    const nonLectureItems = result.filter((r) => r.contentType !== 'lecture')

    // Shuffle lecture portion for daily variety
    const lecturePortion = result.filter((r) => r.contentType === 'lecture')
    const shuffledLectures = seededShuffle(lecturePortion, userId)

    return NextResponse.json({
      success: true,
      data: { items: [...shuffledLectures, ...nonLectureItems] },
    })
  } catch (error) {
    return handleApiError(error, 'Personalized continue learning error')
  }
}
