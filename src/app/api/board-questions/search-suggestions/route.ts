import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

// GET /api/board-questions/search-suggestions?q=math
// Returns search suggestions grouped by category
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').toLowerCase().trim()

    if (!q || q.length < 1) {
      // Return popular suggestions when no query
      const [popularBoards, popularSubjects] = await Promise.all([
        db.board.findMany({
          where: { isActive: true },
          select: { name: true, slug: true },
          orderBy: { order: 'asc' },
          take: 5,
        }),
        db.subject.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          take: 5,
        }),
      ])

      return NextResponse.json({
        suggestions: [
          ...popularBoards.map((b) => ({
            text: `${b.name} Board`,
            type: 'board' as const,
            icon: 'map-pin',
          })),
          ...popularSubjects.map((s) => ({
            text: s.name,
            type: 'subject' as const,
            icon: 'book-open',
          })),
        ],
      })
    }

    // Search boards, subjects, chapters, years that match the query
    const [matchingBoards, matchingSubjects, matchingChapters, matchingYears] = await Promise.all([
      db.board.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { name: true },
        take: 3,
      }),
      db.subject.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { name: true },
        take: 3,
      }),
      db.chapter.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        select: { name: true },
        take: 3,
      }),
      // Years matching the query
      db.examYear.findMany({
        where: {
          isActive: true,
          year: { contains: q, mode: 'insensitive' },
        },
        select: { year: true },
        take: 3,
      }),
    ])

    const suggestions: Array<{ text: string; type: 'board' | 'subject' | 'chapter' | 'year'; icon: string }> = []

    for (const b of matchingBoards) {
      suggestions.push({ text: `${b.name} Board`, type: 'board', icon: 'map-pin' })
    }
    for (const s of matchingSubjects) {
      suggestions.push({ text: s.name, type: 'subject', icon: 'book-open' })
    }
    for (const c of matchingChapters) {
      suggestions.push({ text: c.name, type: 'chapter', icon: 'layers' })
    }
    for (const y of matchingYears) {
      suggestions.push({ text: `${y.year} Questions`, type: 'year', icon: 'calendar' })
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    return handleApiError(error, 'Search suggestions error:')
  }
}
