import { db } from '@/lib/db'
import { apiError } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { cacheHeaders } from '@/lib/cache-headers'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/hierarchy/metadata
 *
 * Central metadata source for the entire app.
 * Returns all metadata needed across MCQ, CQ, Exam, and other forms:
 * - classes (with subjects count)
 * - boards (active only)
 * - years (active ExamYear records)
 * - board-years mapping (active only)
 */
export async function GET() {
  try {
    // Validate database connection
    if (!db) {
      return handleApiError(new Error('Database client is not available'), '[/api/hierarchy/metadata] Database client is not available')
    }

    // Fetch all data in parallel
    const [classes, boards, examYears, boardYears] = await Promise.all([
      db.classCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          order: true,
          icon: true,
          color: true,
          gradient: true,
          description: true,
          _count: { select: { subjects: true } },
        },
        orderBy: { order: 'asc' },
      }),
      db.board.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      }),
      db.examYear.findMany({
        where: { isActive: true },
        select: {
          id: true,
          year: true,
          order: true,
        },
        orderBy: { order: 'desc' },
      }),
      db.boardYear.findMany({
        where: { isActive: true },
        select: {
          id: true,
          board: true,
          year: true,
        },
        orderBy: [{ year: 'desc' }, { board: 'asc' }],
      }),
    ])

    // Also fetch subjects grouped by class for full hierarchy
    const subjects = await db.subject.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        classId: true,
        order: true,
        icon: true,
        color: true,
        _count: { select: { chapters: true } },
      },
      orderBy: [{ classId: 'asc' }, { order: 'asc' }],
    })

    // Also fetch chapters for full hierarchy
    const chapters = await db.chapter.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        subjectId: true,
        order: true,
      },
      orderBy: [{ subjectId: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: {
        classes,
        subjects,
        chapters,
        boards,
        years: examYears,
        boardYears,
      },
    }, { headers: cacheHeaders.public.long })
  } catch (error) {
    // Log full error details for server-side debugging
    return handleApiError(error, '[/api/hierarchy/metadata] Error fetching metadata:')
  }
}
