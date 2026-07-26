import { batchCheckContentAccess } from '@/lib/access-control'
import { applyRateLimit } from '@/lib/api-utils'
import { verifyAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiLimiter } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getClassLevelForRequest } from '@/lib/class-filter'
import { handleApiError } from '@/lib/errors'

// ----------------------------------------------------------------
// Analytics helper — builds a Prisma.Sql WHERE clause from filter
// params.  boardList / yearList are intentionally excluded so the
// analytics always reflect the full set of *available* boards /
// years regardless of the current board / year‑level filter.
// ----------------------------------------------------------------

type AnalyticsRow = {
  premiumCount: number
  distinctBoards: number
  distinctSubjects: number
  distinctChapters: number
}

function analyticsWhere(
  params: {
    classLevelList: string[]
    subjectIdList: string[]
    chapterIdList: string[]
    difficultyList: string[]
    topicList: string[]
    isPremium?: boolean
  },
  searchColumn?: string,
  searchValue?: string,
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`"isActive" = true`,
    Prisma.sql`"deletedAt" IS NULL`,
    Prisma.sql`"board" IS NOT NULL`,
    Prisma.sql`"year" IS NOT NULL`,
  ]

  if (params.classLevelList.length > 0) {
    parts.push(Prisma.sql`"classLevel" IN (${Prisma.join(params.classLevelList)})`)
  }
  if (params.subjectIdList.length > 0) {
    parts.push(Prisma.sql`"subjectId" IN (${Prisma.join(params.subjectIdList)})`)
  }
  if (params.chapterIdList.length > 0) {
    parts.push(Prisma.sql`"chapterId" IN (${Prisma.join(params.chapterIdList)})`)
  }
  if (params.difficultyList.length > 0) {
    parts.push(Prisma.sql`"difficulty" IN (${Prisma.join(params.difficultyList)})`)
  }
  if (params.topicList.length > 0) {
    parts.push(Prisma.sql`"topic" IN (${Prisma.join(params.topicList)})`)
  }
  if (params.isPremium !== undefined) {
    parts.push(Prisma.sql`"isPremium" = ${params.isPremium}`)
  }
  if (searchColumn && searchValue) {
    const allowedColumns = new Set(['question', 'uddeepok'])
    const safeColumn = allowedColumns.has(searchColumn) ? searchColumn : 'question'
    parts.push(Prisma.sql`"${Prisma.raw(safeColumn)}" LIKE ${'%' + searchValue + '%'}`)
  }

  return parts.reduce((a, b) => Prisma.sql`${a} AND ${b}`)
}

// ----------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const board = searchParams.get('board')
    const year = searchParams.get('year')
    let classLevel = searchParams.get('classLevel')
    if (!classLevel) {
      classLevel = await getClassLevelForRequest(request)
    }
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const search = searchParams.get('search')
    const difficulty = searchParams.get('difficulty')
    const topic = searchParams.get('topic')
    const access = searchParams.get('access')
    const sortBy = searchParams.get('sortBy') || 'year_desc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))

    // ----- Multi‑value filter parsing ---------------------------------
    const boardList = board ? board.split(',').filter(Boolean) : []
    const yearList = year ? year.split(',').filter(Boolean) : []
    const classLevelList = classLevel ? classLevel.split(',').filter(Boolean) : []
    const subjectIdList = subjectId ? subjectId.split(',').filter(Boolean) : []
    const chapterIdList = chapterId ? chapterId.split(',').filter(Boolean) : []
    const difficultyList = difficulty ? difficulty.split(',').filter(Boolean) : []
    const topicList = topic ? topic.split(',').filter(Boolean) : []

    // ----- Prisma WHERE (used for data fetching & counts) -------------
    // Must match questionYears hierarchy metadata filters exactly
    const baseWhere: Record<string, unknown> = {
      isActive: true,
      board: { not: null },
      year: { not: null },
      deletedAt: null,
    }
    if (boardList.length > 0) baseWhere.board = { in: boardList }
    if (yearList.length > 0) baseWhere.year = { in: yearList }
    if (classLevelList.length > 0) baseWhere.classLevel = { in: classLevelList }
    if (subjectIdList.length > 0) baseWhere.subjectId = { in: subjectIdList }
    if (chapterIdList.length > 0) baseWhere.chapterId = { in: chapterIdList }
    if (difficultyList.length > 0) baseWhere.difficulty = { in: difficultyList }
    if (topicList.length > 0) baseWhere.topic = { in: topicList }

    const searchFilter = search ? { contains: search, mode: 'insensitive' } : undefined

    const accessFilter =
      access === 'free' ? { isPremium: false }
        : access === 'premium' ? { isPremium: true }
        : access === 'unlocked' ? undefined  // show all — access control hides answers for non-purchased
        : undefined

    const mcqWhere: Record<string, unknown> = { ...baseWhere }
    const cqWhere: Record<string, unknown> = { ...baseWhere }
    if (searchFilter) mcqWhere.question = searchFilter
    if (searchFilter) cqWhere.uddeepok = searchFilter
    if (accessFilter) mcqWhere.isPremium = accessFilter.isPremium
    if (accessFilter) cqWhere.isPremium = accessFilter.isPremium

    const fetchMcqs = !type || type === 'mcq'
    const fetchCqs = !type || type === 'cq'

    // ----- Counts ----------------------------------------------------
    const [mcqCount, cqCount] = await Promise.all([
      fetchMcqs ? db.mCQ.count({ where: mcqWhere }) : Promise.resolve(0),
      fetchCqs ? db.cQ.count({ where: cqWhere }) : Promise.resolve(0),
    ])

    const total = mcqCount + cqCount
    const totalPages = Math.ceil(total / limit)

    // ----- Ordering --------------------------------------------------
    let orderBy: Record<string, string>[]
    switch (sortBy) {
      case 'year_asc':
        orderBy = [{ year: 'asc' }, { board: 'asc' }]
        break
      case 'popularity':
        orderBy = [{ board: 'asc' }, { year: 'desc' }]
        break
      default:
        orderBy = [{ year: 'desc' }, { board: 'asc' }]
    }

    // ----- Pagination strategy ---------------------------------------
    // When bothTypes, we cannot know the distribution of the combined /
    // sorted result ahead of time.  Fetch `page * limit` rows from each
    // table (bounded overfetch), then combine, re‑sort, and slice.
    const bothTypes = fetchMcqs && fetchCqs
    const skip = (page - 1) * limit
    const fetchTake = bothTypes ? skip + limit : limit
    const fetchSkip = bothTypes ? 0 : skip

    // ----- Analytics filter (board / year intentionally excluded) ----
    const analyticsParams = {
      classLevelList,
      subjectIdList,
      chapterIdList,
      difficultyList,
      topicList,
      isPremium: accessFilter?.isPremium,
    }

    // ----- Data + analytics queries ----------------------------------
    const [mcqs, cqs, boards, mcqAnalytics, cqAnalytics] = await Promise.all([
      fetchMcqs
        ? db.mCQ.findMany({
            where: mcqWhere,
            include: {
              chapter: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
            orderBy,
            skip: fetchSkip,
            take: fetchTake,
          })
        : [],
      fetchCqs
        ? db.cQ.findMany({
            where: cqWhere,
            include: {
              chapter: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
            orderBy,
            skip: fetchSkip,
            take: fetchTake,
          })
        : [],
      db.board.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, slug: true, color: true },
      }),
      fetchMcqs
        ? db
            .$queryRaw<AnalyticsRow[]>`
              SELECT
                COUNT(*) FILTER (WHERE "isPremium" = true) AS "premiumCount",
                COUNT(DISTINCT "board")       AS "distinctBoards",
                COUNT(DISTINCT "subjectId")   AS "distinctSubjects",
                COUNT(DISTINCT "chapterId")   AS "distinctChapters"
              FROM "MCQ"
              WHERE ${analyticsWhere(analyticsParams, 'question', search ?? undefined)}
            `
            .then((r) => {
              const row = r[0]!
              return {
                premiumCount: Number(row.premiumCount),
                distinctBoards: Number(row.distinctBoards),
                distinctSubjects: Number(row.distinctSubjects),
                distinctChapters: Number(row.distinctChapters),
              }
            })
        : Promise.resolve<AnalyticsRow>({
            premiumCount: 0,
            distinctBoards: 0,
            distinctSubjects: 0,
            distinctChapters: 0,
          }),
      fetchCqs
        ? db
            .$queryRaw<AnalyticsRow[]>`
              SELECT
                COUNT(*) FILTER (WHERE "isPremium" = true) AS "premiumCount",
                COUNT(DISTINCT "board")       AS "distinctBoards",
                COUNT(DISTINCT "subjectId")   AS "distinctSubjects",
                COUNT(DISTINCT "chapterId")   AS "distinctChapters"
              FROM "CQ"
              WHERE ${analyticsWhere(analyticsParams, 'uddeepok', search ?? undefined)}
            `
            .then((r) => {
              const row = r[0]!
              return {
                premiumCount: Number(row.premiumCount),
                distinctBoards: Number(row.distinctBoards),
                distinctSubjects: Number(row.distinctSubjects),
                distinctChapters: Number(row.distinctChapters),
              }
            })
        : Promise.resolve<AnalyticsRow>({
            premiumCount: 0,
            distinctBoards: 0,
            distinctSubjects: 0,
            distinctChapters: 0,
          }),
    ])

    // ----- Transform MCQ rows ----------------------------------------
    const mcqItems = mcqs.map((mcq) => {
      const plainTitle = mcq.question
        .replace(/<[^>]*>/g, '')
        .replace(/\$\$[\s\S]*?\$\$/g, '[গণিত]')
        .replace(/\$[^$]*?\$/g, '[গণিত]')
      return {
        id: mcq.id,
        type: 'mcq' as const,
        board: mcq.board!,
        year: mcq.year || '',
        classLevel: mcq.classLevel,
        subjectId: mcq.subjectId,
        chapterId: mcq.chapterId,
        subjectName: mcq.chapter?.subject?.name || '',
        chapterName: mcq.chapter?.name || '',
        title: plainTitle.length > 80 ? plainTitle.slice(0, 80) + '...' : plainTitle,
        question: mcq.question,
        questionImage: mcq.questionImage,
        optionA: mcq.optionA,
        optionB: mcq.optionB,
        optionC: mcq.optionC,
        optionD: mcq.optionD,
        optionAImage: mcq.optionAImage,
        optionBImage: mcq.optionBImage,
        optionCImage: mcq.optionCImage,
        optionDImage: mcq.optionDImage,
        correctAnswer: mcq.correctAnswer,
        explanation: mcq.explanation,
        explanationImage: mcq.explanationImage,
        isPremium: mcq.isPremium,
        price: mcq.price,
        difficulty: mcq.difficulty,
        questionCount: 1,
      }
    })

    // ----- Transform CQ rows -----------------------------------------
    const cqItems = cqs.map((cq) => {
      const plainTitle = cq.uddeepok
        .replace(/<[^>]*>/g, '')
        .replace(/\$\$[\s\S]*?\$\$/g, '[গণিত]')
        .replace(/\$[^$]*?\$/g, '[গণিত]')
      return {
        id: cq.id,
        type: 'cq' as const,
        board: cq.board!,
        year: cq.year || '',
        classLevel: cq.classLevel,
        subjectId: cq.subjectId,
        chapterId: cq.chapterId,
        subjectName: cq.chapter?.subject?.name || '',
        chapterName: cq.chapter?.name || '',
        title: plainTitle.length > 80 ? plainTitle.slice(0, 80) + '...' : plainTitle,
        question: cq.uddeepok,
        questionImage: cq.uddeepokImage,
        question1: cq.question1,
        question1Image: cq.question1Image,
        question2: cq.question2,
        question2Image: cq.question2Image,
        question3: cq.question3,
        question3Image: cq.question3Image,
        question4: cq.question4,
        question4Image: cq.question4Image,
        answer1: cq.answer1,
        answer1Image: cq.answer1Image,
        answer2: cq.answer2,
        answer2Image: cq.answer2Image,
        answer3: cq.answer3,
        answer3Image: cq.answer3Image,
        answer4: cq.answer4,
        answer4Image: cq.answer4Image,
        isPremium: cq.isPremium,
        price: cq.price,
        difficulty: cq.difficulty,
        questionCount: 4,
      }
    })

    // ----- Combine, sort, page ---------------------------------------
    const allData = [...mcqItems, ...cqItems].sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year)
      return a.board.localeCompare(b.board)
    })

    const paginatedData = bothTypes ? allData.slice(skip, skip + limit) : allData

    // ----- Board color map -------------------------------------------
    const boardColorMap: Record<string, string> = {}
    for (const b of boards) {
      boardColorMap[b.slug] = b.color || 'rose'
    }

    const enrichedData = paginatedData.map((item) => ({
      ...item,
      boardColor: boardColorMap[item.board] || 'rose',
    }))

    // ----- Access control --------------------------------------------
    const auth = await verifyAuth(request)
    if (auth) {
      const accessItems = enrichedData.map((item) => ({
        contentType: item.type === 'mcq' ? 'board-mcq' as const : 'board-cq' as const,
        contentId: item.id,
      }))
      const accessMap = await batchCheckContentAccess({ userId: auth.user.id, items: accessItems })
      for (const item of enrichedData) {
        if (item.isPremium) {
          const access = accessMap.get(item.id)
          if (!access?.hasAccess) {
            const obj = item as Record<string, unknown>
            obj.correctAnswer = ''
            obj.explanation = ''
            obj.explanationImage = null
            obj.answer1 = ''
            obj.answer1Image = null
            obj.answer2 = ''
            obj.answer2Image = null
            obj.answer3 = ''
            obj.answer3Image = null
            obj.answer4 = ''
            obj.answer4Image = null
          }
        }
      }
    } else {
      for (const item of enrichedData) {
        if (item.isPremium) {
          const obj = item as Record<string, unknown>
          obj.correctAnswer = ''
          obj.explanation = ''
          obj.explanationImage = null
          obj.answer1 = ''
          obj.answer1Image = null
          obj.answer2 = ''
          obj.answer2Image = null
          obj.answer3 = ''
          obj.answer3Image = null
          obj.answer4 = ''
          obj.answer4Image = null
        }
      }
    }

    // ----- Analytics computation -------------------------------------
    const totalPremium = (mcqAnalytics?.premiumCount ?? 0) + (cqAnalytics?.premiumCount ?? 0)
    const distinctBoards = (mcqAnalytics?.distinctBoards ?? 0) + (cqAnalytics?.distinctBoards ?? 0)
    const distinctSubjects = (mcqAnalytics?.distinctSubjects ?? 0) + (cqAnalytics?.distinctSubjects ?? 0)
    const distinctChapters = (mcqAnalytics?.distinctChapters ?? 0) + (cqAnalytics?.distinctChapters ?? 0)

    const analytics = {
      totalQuestions: total,
      accessibleQuestions: total - totalPremium,
      premiumQuestions: totalPremium,
      unlockedQuestions: total - totalPremium,
      availableBoards: distinctBoards,
      availableSubjects: distinctSubjects,
      availableChapters: distinctChapters,
      questionsPracticed: 0,
      questionsRemaining: total,
      accuracyRate: 0,
    }

    return NextResponse.json({
      data: enrichedData,
      pagination: { page, limit, total, totalPages },
      analytics,
    })
  } catch (error) {
    return handleApiError(error, 'Board questions API error')
  }
}