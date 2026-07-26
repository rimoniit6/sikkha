import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { apiError, applyRateLimit } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { getClassLevelForRequest } from '@/lib/class-filter'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const type = searchParams.get('type')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10')), 50)
    const skip = (page - 1) * limit

    if (!q || q.trim().length === 0) {
      return apiError('সার্চ কোয়েরি আবশ্যক', 400)
    }

    const searchQuery = q.trim()
    const searchType = type || 'all'
    const classMode = searchParams.get('classMode') // 'my-class' | 'all'

    const classLevel = classMode === 'all' ? null : await getClassLevelForRequest(request)
    const classFilter = classLevel ? { classLevel } : {}
    const relationalClassFilter = classLevel
      ? { chapter: { subject: { class: { slug: classLevel } } } }
      : {}

    const results: Record<string, unknown[]> = {}

    const chapterInclude = {
      chapter: {
        select: {
          id: true, name: true, slug: true, subjectId: true,
          subject: { select: { id: true, name: true, slug: true, classId: true, class: { select: { id: true, name: true, slug: true } } } },
        },
      },
    } as const

    const queryPromises: Array<{ key: string; promise: Promise<unknown[]> }> = []

    if (searchType === 'all' || searchType === 'mcq') {
      queryPromises.push({
        key: 'mcqs',
        promise: db.mCQ.findMany({
          where: { isActive: true, question: { contains: searchQuery, mode: 'insensitive' }, ...classFilter },
          include: chapterInclude,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    if (searchType === 'all' || searchType === 'cq') {
      queryPromises.push({
        key: 'cqs',
        promise: db.cQ.findMany({
          where: { isActive: true, uddeepok: { contains: searchQuery, mode: 'insensitive' }, ...classFilter },
          include: chapterInclude,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    if (searchType === 'all' || searchType === 'lecture') {
      queryPromises.push({
        key: 'lectures',
        promise: db.lecture.findMany({
          where: { isActive: true, title: { contains: searchQuery, mode: 'insensitive' }, ...relationalClassFilter },
          include: chapterInclude,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    if (searchType === 'all' || searchType === 'suggestion') {
      queryPromises.push({
        key: 'suggestions',
        promise: db.suggestion.findMany({
          where: { isActive: true, title: { contains: searchQuery, mode: 'insensitive' }, ...(classLevel ? { classId: classLevel } : {}) },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    if (searchType === 'all' || searchType === 'notice') {
      queryPromises.push({
        key: 'notices',
        promise: db.notice.findMany({
          where: { isActive: true, title: { contains: searchQuery, mode: 'insensitive' } },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    if (searchType === 'all' || searchType === 'bundle') {
      queryPromises.push({
        key: 'bundles',
        promise: db.contentBundle.findMany({
          where: { isActive: true, title: { contains: searchQuery, mode: 'insensitive' } },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      })
    }

    const settled = await Promise.allSettled(
      queryPromises.map(async (qp) => ({ key: qp.key, data: await qp.promise })),
    )

    let totalResults = 0
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results[s.value.key] = s.value.data
        totalResults += s.value.data.length
      }
    }

    return NextResponse.json({ success: true, data: { query: searchQuery, results, total: totalResults, page, limit } })
  } catch (error) {
    return handleApiError(error, 'Search error')
  }
}
