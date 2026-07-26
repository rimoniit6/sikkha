import { db } from '@/lib/db'
import { apiError, applyRateLimit } from '@/lib/api-utils'
import { NextRequest, NextResponse } from 'next/server'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

// GET /api/board-questions/filters?classLevel=ssc&year=2024
// Returns available filter options filtered by given params
export async function GET(request: NextRequest) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const { searchParams } = new URL(request.url)
    const classLevel = searchParams.get('classLevel')
    const year = searchParams.get('year')

    // Get all active boards
    const allBoards = await db.board.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true, color: true },
    })

    // Build where clause for MCQs based on filters
    // Must match board listing API filters: isActive, deletedAt=null, board not null, year not null
    const mcqWhere: Record<string, unknown> = {
      board: { not: null },
      year: { not: null },
      isActive: true,
      deletedAt: null,
    }
    if (classLevel) mcqWhere.classLevel = classLevel
    if (year) mcqWhere.year = year

    const cqWhere: Record<string, unknown> = {
      board: { not: null },
      year: { not: null },
      isActive: true,
      deletedAt: null,
    }
    if (classLevel) cqWhere.classLevel = classLevel
    if (year) cqWhere.year = year

    // Get distinct years, boards, classLevels from MCQs
    const mcqMeta = await db.mCQ.findMany({
      where: mcqWhere,
      select: { year: true, board: true, classLevel: true, subjectId: true },
      distinct: ['year', 'board', 'classLevel', 'subjectId'],
    })

    // Also from CQs
    const cqMeta = await db.cQ.findMany({
      where: cqWhere,
      select: { year: true, board: true, classLevel: true },
      distinct: ['year', 'board', 'classLevel'],
    })

    // Extract unique values
    const yearsSet = new Set<string>()
    const classLevelsSet = new Set<string>()
    const subjectIdsSet = new Set<string>()
    const boardsWithData = new Set<string>()

    for (const m of mcqMeta) {
      if (m.year) yearsSet.add(m.year)
      if (m.classLevel) classLevelsSet.add(m.classLevel)
      if (m.subjectId) subjectIdsSet.add(m.subjectId)
      if (m.board) boardsWithData.add(m.board)
    }
    for (const c of cqMeta) {
      if (c.year) yearsSet.add(c.year)
      if (c.classLevel) classLevelsSet.add(c.classLevel)
      if (c.board) boardsWithData.add(c.board)
    }

    const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a))

    // Get ClassCategory info for proper display
    const classLevelSlugs = Array.from(classLevelsSet)
    const classCategories = classLevelSlugs.length > 0
      ? await db.classCategory.findMany({
          where: { slug: { in: classLevelSlugs }, isActive: true },
          select: { id: true, name: true, slug: true, order: true, gradient: true },
          orderBy: { order: 'asc' },
        })
      : []

    // Get total board question counts per class level for stats (single query instead of N+1)
    const classLevelCounts: Record<string, { mcqCount: number; cqCount: number }> = {}
    if (classLevelSlugs.length > 0) {
      const [mcqCounts, cqCounts] = await Promise.all([
        db.mCQ.groupBy({
          by: ['classLevel'],
          where: mcqWhere,
          _count: { id: true },
        }),
        db.cQ.groupBy({
          by: ['classLevel'],
          where: cqWhere,
          _count: { id: true },
        }),
      ])
      for (const row of mcqCounts) {
        classLevelCounts[row.classLevel] = { mcqCount: row._count.id, cqCount: 0 }
      }
      for (const row of cqCounts) {
        if (!classLevelCounts[row.classLevel]) classLevelCounts[row.classLevel] = { mcqCount: 0, cqCount: 0 }
        classLevelCounts[row.classLevel].cqCount = row._count.id
      }
    }

    const classLevels = classCategories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      gradient: c.gradient || null,
      mcqCount: classLevelCounts[c.slug]?.mcqCount || 0,
      cqCount: classLevelCounts[c.slug]?.cqCount || 0,
      boardCount: allBoards.filter(b => boardsWithData.has(b.slug)).length,
    }))

    // Filter boards to only show boards that have data for the given filters
    const boards = allBoards
      .filter(b => boardsWithData.has(b.slug))
      .map(b => ({ ...b, hasData: true }))

    // Get subject names
    const uniqueSubjectIds = Array.from(subjectIdsSet)
    const subjects = uniqueSubjectIds.length > 0
      ? await db.subject.findMany({
          where: { id: { in: uniqueSubjectIds }, isActive: true, deletedAt: null },
          select: { id: true, name: true, slug: true },
          orderBy: { order: 'asc' },
        })
      : []

    return NextResponse.json({
      success: true,
      data: {
        boards,
        years,
        classLevels,
        subjects,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Board questions filters error:')
  }
}
