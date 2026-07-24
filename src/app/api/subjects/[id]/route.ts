import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params

    const subject = await db.subject.findUnique({
      where: { id, isActive: true },
      include: {
        class: true,
        chapters: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                lectures: { where: { isActive: true } },
                mcqs: { where: { isActive: true } },
                cqs: { where: { isActive: true } },
              },
            },
          },
        },
      },
    })

    if (!subject) {
      return NextResponse.json(
        { error: 'বিষয় খুঁজে পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Get board questions info from MCQs that have board/year set
    const mcqsWithBoard = await db.mCQ.findMany({
      where: {
        subjectId: id,
        isActive: true,
        board: { not: null },
        year: { not: null },
      },
      select: {
        board: true,
        year: true,
      },
    })

    // Aggregate board questions by board+year
    const boardQuestionMap = new Map<string, { board: string; year: string; count: number }>()
    for (const mcq of mcqsWithBoard) {
      if (mcq.board && mcq.year) {
        const key = `${mcq.board}-${mcq.year}`
        const existing = boardQuestionMap.get(key)
        if (existing) {
          existing.count++
        } else {
          boardQuestionMap.set(key, { board: mcq.board, year: mcq.year, count: 1 })
        }
      }
    }

    const boardQuestions = Array.from(boardQuestionMap.values())

    // Total MCQ practice count
    const mcqPracticeCount = subject.chapters.reduce(
      (sum, ch) => sum + ch._count.mcqs,
      0
    )

    // Total CQ count
    const cqCount = subject.chapters.reduce(
      (sum, ch) => sum + ch._count.cqs,
      0
    )

    // Total Lecture count
    const lectureCount = subject.chapters.reduce(
      (sum, ch) => sum + ch._count.lectures,
      0
    )

    // Single aggregated query for all subject-level counts
    const subjectCountRows = await db.$queryRawUnsafe<
      Array<{
        suggestionCount: number
        examCount: number
        boardMcqCount: number
        boardCqCount: number
        freeLectureCount: number
        freeMcqCount: number
        freeCqCount: number
        freeBoardMcqCount: number
        freeBoardCqCount: number
        shortQuestionCount: number
        freeShortQuestionCount: number
        freeSuggestionCount: number
        freeExamCount: number
      }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM "Suggestion" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL) as "suggestionCount",
        (SELECT COUNT(*) FROM "Exam" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "status" = 'PUBLISHED') as "examCount",
        (SELECT COUNT(*) FROM "MCQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "board" IS NOT NULL AND "year" IS NOT NULL) as "boardMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "board" IS NOT NULL AND "year" IS NOT NULL) as "boardCqCount",
        (SELECT COUNT(*) FROM "Lecture" l INNER JOIN "Chapter" ch ON l."chapterId" = ch."id" WHERE ch."subjectId" = $1 AND l."isActive" = true AND l."deletedAt" IS NULL AND l."isPremium" = false) as "freeLectureCount",
        (SELECT COUNT(*) FROM "MCQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeCqCount",
        (SELECT COUNT(*) FROM "MCQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false AND "board" IS NOT NULL AND "year" IS NOT NULL) as "freeBoardMcqCount",
        (SELECT COUNT(*) FROM "CQ" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false AND "board" IS NOT NULL AND "year" IS NOT NULL) as "freeBoardCqCount",
        (SELECT COUNT(*) FROM "KnowledgeQuestion" kq INNER JOIN "Chapter" ch ON kq."chapterId" = ch."id" WHERE ch."subjectId" = $1 AND kq."isActive" = true AND kq."deletedAt" IS NULL) as "shortQuestionCount",
        (SELECT COUNT(*) FROM "KnowledgeQuestion" kq INNER JOIN "Chapter" ch ON kq."chapterId" = ch."id" WHERE ch."subjectId" = $1 AND kq."isActive" = true AND kq."deletedAt" IS NULL AND kq."isPremium" = false) as "freeShortQuestionCount",
        (SELECT COUNT(*) FROM "Suggestion" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false) as "freeSuggestionCount",
        (SELECT COUNT(*) FROM "Exam" WHERE "subjectId" = $1 AND "isActive" = true AND "deletedAt" IS NULL AND "status" = 'PUBLISHED' AND "isPremium" = false) as "freeExamCount"`,
      id
    )
    const sr = subjectCountRows[0]
    const suggestionCount = Number(sr.suggestionCount)
    const examCount = Number(sr.examCount)
    const boardMcqCount = Number(sr.boardMcqCount)
    const boardCqCount = Number(sr.boardCqCount)
    const boardQuestionCount = boardMcqCount + boardCqCount
    const freeLectureCount = Number(sr.freeLectureCount)
    const freeMcqCount = Number(sr.freeMcqCount)
    const freeCqCount = Number(sr.freeCqCount)
    const freeBoardMcqCount = Number(sr.freeBoardMcqCount)
    const freeBoardCqCount = Number(sr.freeBoardCqCount)
    const freeBoardQuestionCount = freeBoardMcqCount + freeBoardCqCount
    const shortQuestionCount = Number(sr.shortQuestionCount)
    const freeShortQuestionCount = Number(sr.freeShortQuestionCount)
    const freeSuggestionCount = Number(sr.freeSuggestionCount)
    const freeExamCount = Number(sr.freeExamCount)

    // Per-chapter free counts — single aggregated query (SQLite-compatible IN)
    const chapterIds = subject.chapters.map(ch => ch.id)
    const chapterPlaceholders = chapterIds.map(() => '?').join(',')
    const perChapterRows = chapterIds.length > 0
      ? await db.$queryRawUnsafe<
          Array<{ type: string; chapterId: string; count: number }>
        >(
          `SELECT 'lecture' as "type", "chapterId", COUNT(*) as "count"
           FROM "Lecture" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false
           GROUP BY "chapterId"
           UNION ALL
           SELECT 'mcq' as "type", "chapterId", COUNT(*) as "count"
           FROM "MCQ" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false
           GROUP BY "chapterId"
           UNION ALL
           SELECT 'cq' as "type", "chapterId", COUNT(*) as "count"
           FROM "CQ" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false
           GROUP BY "chapterId"
           UNION ALL
           SELECT 'suggestion' as "type", "chapterId", COUNT(*) as "count"
           FROM "Suggestion" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL
           GROUP BY "chapterId"
           UNION ALL
           SELECT 'knowledge_free' as "type", "chapterId", COUNT(*) as "count"
           FROM "KnowledgeQuestion" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL AND "isPremium" = false
           GROUP BY "chapterId"
           UNION ALL
           SELECT 'knowledge_total' as "type", "chapterId", COUNT(*) as "count"
           FROM "KnowledgeQuestion" WHERE "chapterId" IN (${chapterPlaceholders}) AND "isActive" = true AND "deletedAt" IS NULL
           GROUP BY "chapterId"`,
          ...chapterIds, ...chapterIds, ...chapterIds, ...chapterIds, ...chapterIds, ...chapterIds
        )
      : []

    // Build per-chapter map from aggregated results
    const chapterFreeMap = new Map<
      string,
      {
        freeLectures: number
        freeMcqs: number
        freeCqs: number
        suggestionCount: number
        freeKnowledgeQuestions: number
        shortQuestionsCount: number
        examCount: number
      }
    >()
    for (const ch of subject.chapters) {
      chapterFreeMap.set(ch.id, {
        freeLectures: 0,
        freeMcqs: 0,
        freeCqs: 0,
        suggestionCount: 0,
        freeKnowledgeQuestions: 0,
        shortQuestionsCount: 0,
        examCount: 0,
      })
    }
    for (const row of perChapterRows) {
      const entry = chapterFreeMap.get(row.chapterId)
      if (!entry) continue
      const c = Number(row.count)
      switch (row.type) {
        case 'lecture':
          entry.freeLectures = c
          break
        case 'mcq':
          entry.freeMcqs = c
          break
        case 'cq':
          entry.freeCqs = c
          break
        case 'suggestion':
          entry.suggestionCount = c
          break
        case 'knowledge_free':
          entry.freeKnowledgeQuestions = c
          break
        case 'knowledge_total':
          entry.shortQuestionsCount = c
          break
      }
    }

    // Exam counts per chapter — single pass with chapterId→count map
    const allExams = await db.exam.findMany({
      where: { isActive: true, status: 'PUBLISHED' },
      select: { chapterIds: true },
    })
    const examCountMap = new Map<string, number>()
    for (const exam of allExams) {
      for (const chId of exam.chapterIds || []) {
        examCountMap.set(chId, (examCountMap.get(chId) || 0) + 1)
      }
    }
    for (const [chId, entry] of chapterFreeMap) {
      entry.examCount = examCountMap.get(chId) || 0
    }

    // Transform to match SubjectDetailPage expected format
    const result = {
      id: subject.id,
      name: subject.name,
      className: subject.class.name,
      classSlug: subject.class.slug,
      chapters: subject.chapters.map((chapter) => {
        const freeCounts = chapterFreeMap.get(chapter.id)
        return {
          id: chapter.id,
          name: chapter.name,
          slug: chapter.slug,
          number: chapter.order,
          lectureCount: chapter._count.lectures,
          mcqCount: chapter._count.mcqs,
          cqCount: chapter._count.cqs,
          freeLectureCount: freeCounts?.freeLectures ?? 0,
          freeMcqCount: freeCounts?.freeMcqs ?? 0,
          freeCqCount: freeCounts?.freeCqs ?? 0,
          suggestionCount: freeCounts?.suggestionCount ?? 0,
          examCount: freeCounts?.examCount ?? 0,
          shortQuestionsCount: freeCounts?.shortQuestionsCount ?? 0,
          freeShortQuestionsCount: freeCounts?.freeKnowledgeQuestions ?? 0,
          progress: 0,
        }
      }),
      boardQuestions,
      mcqPracticeCount,
      // Generic content counts for subject-level tabs
      // mcq = ALL MCQs (board + non-board) — matches what MCQ Practice page shows
      // board = board MCQs + CQs (a subset) — for board-specific navigation
      // knowledge = same as cq count (all CQs have question1 / ক)
      // understanding = same as cq count (all CQs have question1+question2 / ক+খ)
      // Note: mcq count includes board MCQs, so mcq ≥ board. This is intentional.
      contentCounts: {
        lecture: lectureCount,
        knowledge: cqCount,
        understanding: cqCount,
        mcq: mcqPracticeCount,
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
    return handleApiError(error, 'Get subject detail error')
  }
}
