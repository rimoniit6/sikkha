import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params

    const chapter = await db.chapter.findUnique({
      where: { id, isActive: true },
      include: {
        subject: {
          include: {
            class: true,
          },
        },
        _count: {
          select: {
            lectures: { where: { isActive: true } },
            mcqs: { where: { isActive: true } },
            cqs: { where: { isActive: true } },
          },
        },
      },
    })

    if (!chapter) {
      return NextResponse.json(
        { error: 'অধ্যায় খুঁজে পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    const lectureCount = chapter._count.lectures
    const mcqCount = chapter._count.mcqs
    const cqCount = chapter._count.cqs

    const rows = await db.$queryRawUnsafe<
      Array<{
        boardMcqCount: number
        boardCqCount: number
        suggestionCount: number
        examCount: number
        shortQuestionCount: number
        freeShortQuestionCount: number
        freeLectureCount: number
        freeMcqCount: number
        freeCqCount: number
        freeBoardMcqCount: number
        freeBoardCqCount: number
        freeSuggestionCount: number
        freeExamCount: number
      }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM "MCQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "board" IS NOT NULL AND "year" IS NOT NULL) as "boardMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "board" IS NOT NULL AND "year" IS NOT NULL) as "boardCqCount",
        (SELECT COUNT(*) FROM "Suggestion" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL) as "suggestionCount",
        (SELECT COUNT(*) FROM "Exam" WHERE "isActive" = true AND "deletedAt" IS NULL AND "status" = 'PUBLISHED' AND "chapterIds" LIKE '%' || $1 || '%') as "examCount",
        (SELECT COUNT(*) FROM "KnowledgeQuestion" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL) as "shortQuestionCount",
        (SELECT COUNT(*) FROM "KnowledgeQuestion" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeShortQuestionCount",
        (SELECT COUNT(*) FROM "Lecture" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeLectureCount",
        (SELECT COUNT(*) FROM "MCQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeCqCount",
        (SELECT COUNT(*) FROM "MCQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false AND "board" IS NOT NULL AND "year" IS NOT NULL) as "freeBoardMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false AND "board" IS NOT NULL AND "year" IS NOT NULL) as "freeBoardCqCount",
        (SELECT COUNT(*) FROM "Suggestion" WHERE "chapterId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeSuggestionCount",
        (SELECT COUNT(*) FROM "Exam" WHERE "isActive" = true AND "deletedAt" IS NULL AND "status" = 'PUBLISHED' AND "isPremium" = false AND "chapterIds" LIKE '%' || $1 || '%') as "freeExamCount"`,
      id
    )

    const row = rows[0]
    const boardMcqCount = Number(row.boardMcqCount)
    const boardCqCount = Number(row.boardCqCount)
    const boardQuestionCount = boardMcqCount + boardCqCount
    const suggestionCount = Number(row.suggestionCount)
    const examCount = Number(row.examCount)
    const shortQuestionCount = Number(row.shortQuestionCount)
    const freeShortQuestionCount = Number(row.freeShortQuestionCount)
    const freeLectureCount = Number(row.freeLectureCount)
    const freeMcqCount = Number(row.freeMcqCount)
    const freeCqCount = Number(row.freeCqCount)
    const freeBoardMcqCount = Number(row.freeBoardMcqCount)
    const freeBoardCqCount = Number(row.freeBoardCqCount)
    const freeBoardQuestionCount = freeBoardMcqCount + freeBoardCqCount
    const freeSuggestionCount = Number(row.freeSuggestionCount)
    const freeExamCount = Number(row.freeExamCount)

    const result = {
      id: chapter.id,
      name: chapter.name,
      number: chapter.order,
      slug: chapter.slug,
      subjectName: chapter.subject.name,
      subjectSlug: chapter.subject.slug,
      className: chapter.subject.class.name,
      classSlug: chapter.subject.class.slug,
      subjectId: chapter.subject.id,
      // Keep individual counts for backward compatibility
      lectureCount,
      mcqCount,
      cqCount,
      boardQuestionCount,
      progress: 0,
      // Generic content counts map keyed by content type key
      // mcq = ALL MCQs (board + non-board) — matches what MCQ Practice page shows
      // board = board MCQs + CQs (a subset) — for board-specific navigation
      // knowledge = same as cq count (all CQs have question1 / ক)
      // understanding = same as cq count (all CQs have question1+question2 / ক+খ)
      // Note: mcq count includes board MCQs, so mcq ≥ board. This is intentional.
      contentCounts: {
        lecture: lectureCount,
        knowledge: cqCount,
        understanding: cqCount,
        mcq: mcqCount,
        cq: cqCount,
        board: boardQuestionCount,
        suggestion: suggestionCount,
        exam: examCount,
        'short-questions': shortQuestionCount,
      } as Record<string, number>,
      freeContentCounts: {
        lecture: freeLectureCount,
        knowledge: freeCqCount,
        understanding: freeCqCount,
        mcq: freeMcqCount,
        cq: freeCqCount,
        board: freeBoardQuestionCount,
        suggestion: freeSuggestionCount,
        exam: freeExamCount,
        'short-questions': freeShortQuestionCount,
      } as Record<string, number>,
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'Get chapter detail error')
  }
}
