import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { apiError, withCsrf, applyRateLimit } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { cacheHeaders } from '@/lib/cache-headers'


// Transform raw CQ Prisma object to frontend-expected format
function transformCQ(cq: {
  id: string
  uddeepok: string
  uddeepokImage?: string | null
  question1: string
  question1Image?: string | null
  question2: string
  question2Image?: string | null
  question3: string
  question3Image?: string | null
  question4: string
  question4Image?: string | null
  answer1: string
  answer1Image?: string | null
  answer2: string
  answer2Image?: string | null
  answer3: string
  answer3Image?: string | null
  answer4: string
  answer4Image?: string | null
  isPremium: boolean
  price: number
  board: string | null
  year: string | null
  difficulty: string
  chapterId: string
  chapter?: { id: string; name: string; slug: string; subject?: { id: string; name: string; slug: string; class?: { id: string; name: string; slug: string } } }
  [key: string]: unknown
}) {
  // Bengali sub-question labels: ক, খ, গ, ঘ
  const BENGALI_LABELS = ['ক', 'খ', 'গ', 'ঘ']

  // Build questions array from question1-4 and answer1-4
  const questions: Array<{
    id: string
    label: string
    number: number
    text: string
    marks: number
    answer: string
    questionImage: string | null
    answerImage: string | null
  }> = []
  for (let i = 1; i <= 4; i++) {
    const text = cq[`question${i}` as keyof typeof cq] as string
    const answer = cq[`answer${i}` as keyof typeof cq] as string
    const questionImage = cq[`question${i}Image` as keyof typeof cq] as string | null | undefined
    const answerImage = cq[`answer${i}Image` as keyof typeof cq] as string | null | undefined
    if (text) {
      questions.push({
        id: `${cq.id}-q${i}`,
        label: BENGALI_LABELS[i - 1], // ক, খ, গ, ঘ
        number: i,
        text,
        marks: i, // ক=১, খ=২, গ=৩, ঘ=৪
        answer: answer || '',
        questionImage: questionImage || null,
        answerImage: answerImage || null,
      })
    }
  }

  return {
    id: cq.id,
    uddeepok: cq.uddeepok,
    uddeepokImage: cq.uddeepokImage || null,
    questions,
    chapterName: cq.chapter?.name || '',
    subjectName: cq.chapter?.subject?.name || '',
    className: cq.chapter?.subject?.class?.name || '',
    classSlug: cq.chapter?.subject?.class?.slug || '',
    subjectId: cq.chapter?.subject?.id || '',
    subjectSlug: cq.chapter?.subject?.slug || '',
    chapterId: cq.chapterId,
    chapterSlug: cq.chapter?.slug || '',
    isPremium: cq.isPremium,
    price: cq.price || 0,
    difficulty: cq.difficulty || 'MEDIUM',
    year: cq.year || undefined,
    board: cq.board || undefined,
  }
}

// Lightweight transform for listing pages — includes uddeepok preview but not full questions/answers
function transformCQList(cq: {
  id: string
  uddeepok: string
  uddeepokImage?: string | null
  isPremium: boolean
  price: number
  difficulty: string
  board: string | null
  year: string | null
  chapterId: string
  question1: string
  question2: string
  question3: string
  question4: string
  chapter?: { id: string; name: string; slug: string; subject?: { id: string; name: string; slug: string; class?: { id: string; name: string; slug: string } } }
}) {
  // Count how many questions are non-empty
  let questionCount = 0
  for (let i = 1; i <= 4; i++) {
    if (cq[`question${i}` as keyof typeof cq] as string) questionCount++
  }

  return {
    id: cq.id,
    uddeepok: cq.uddeepok,
    uddeepokImage: cq.uddeepokImage || null,
    questionCount,
    isPremium: cq.isPremium || false,
    price: cq.price || 0,
    difficulty: cq.difficulty || 'MEDIUM',
    board: cq.board || null,
    year: cq.year || null,
    chapterId: cq.chapterId,
    chapterSlug: cq.chapter?.slug || '',
    chapterName: cq.chapter?.name || '',
    subjectName: cq.chapter?.subject?.name || '',
    className: cq.chapter?.subject?.class?.name || '',
    classSlug: cq.chapter?.subject?.class?.slug || '',
    subjectId: cq.chapter?.subject?.id || '',
    subjectSlug: cq.chapter?.subject?.slug || '',
  }
}

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const { searchParams } = new URL(request.url)
    const auth = await verifyAuth(request)
    const chapterId = searchParams.get('chapterId')
    let classLevel = searchParams.get('classLevel')
    if (!classLevel) {
      if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
        classLevel = auth.user.classLevel
      }
    }
    const subjectId = searchParams.get('subjectId')
    const board = searchParams.get('board')
    const year = searchParams.get('year')
    const isPremium = searchParams.get('isPremium')
    const difficulty = searchParams.get('difficulty')
    const type = searchParams.get('type') // "list" for listing page
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isActive: true }

    // Hierarchy-based filtering: prefer most specific filter available
    // chapterId > subjectId > classLevel
    // Never combine classLevel with subjectId/chapterId because classLevel
    // values in CQ records may be inconsistent
    if (chapterId) {
      where.chapterId = chapterId
    } else if (subjectId) {
      where.subjectId = subjectId
    } else if (classLevel) {
      where.classLevel = classLevel
    }
    if (board) where.board = board
    if (year) where.year = year
    if (difficulty) where.difficulty = difficulty
    if (isPremium !== null && isPremium !== undefined && isPremium !== '') {
      where.isPremium = isPremium === 'true'
    }

    // ─── LIST MODE: lightweight data for listing pages (free-first, paginated) ───
    if (type === 'list') {
      // List mode defaults: page=1, limit=20 (matching admin pages)
      const listPage = searchParams.has('page') ? page : 1
      const listLimit = searchParams.has('limit') ? limit : 20

      const [cqs, total, freeCount, premiumCount] = await Promise.all([
        db.cQ.findMany({
          where,
          include: {
            chapter: {
              select: {
                id: true,
                name: true,
                slug: true,
                subject: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    class: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { isPremium: 'asc' }, // free first
            { createdAt: 'desc' },
          ],
          skip: (listPage - 1) * listLimit,
          take: listLimit,
        }),
        db.cQ.count({ where }),
        db.cQ.count({ where: { ...where, isPremium: false } }),
        db.cQ.count({ where: { ...where, isPremium: true } }),
      ])

      const list = cqs.map((cq) => transformCQList(cq as unknown as Parameters<typeof transformCQList>[0]))
      const totalPages = Math.ceil(total / listLimit)

      return NextResponse.json({
        success: true,
        data: {
          cqs: list,
          total,
          freeCount,
          premiumCount,
        },
        pagination: {
          page: listPage,
          limit: listLimit,
          totalPages,
        },
      }, { headers: cacheHeaders.noCache })
    }

    // ─── NORMAL MODE: full data with pagination ───
    // Apply no-cache headers for premium content responses
    const [cqs, total] = await Promise.all([
      db.cQ.findMany({
        where,
        include: {
          chapter: {
            select: {
              id: true,
              name: true,
              slug: true,
              subject: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  class: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.cQ.count({ where }),
    ])

    // Fetch user access control list (reuse auth resolved earlier in handler)
    const isAdmin = auth?.user && ['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)

    let accessMap = new Map()
    if (!isAdmin && auth?.user) {
      const premiumCqIds = cqs.filter((c) => c.isPremium).map((c) => c.id)
      if (premiumCqIds.length > 0) {
        const { batchCheckContentAccess } = await import('@/lib/access-control')
        accessMap = await batchCheckContentAccess({
          userId: auth.user.id,
          items: premiumCqIds.map((id) => ({ contentType: 'cq', contentId: id })),
        })
      }
    }

    // Transform to frontend-expected format and apply access restriction
    const transformedCqs = cqs.map((cq) => {
      const baseTransformed = transformCQ(cq as unknown as Parameters<typeof transformCQ>[0])
      if (cq.isPremium && !isAdmin) {
        const hasAccess = auth?.user ? !!accessMap.get(cq.id)?.hasAccess : false
        if (!hasAccess) {
          // Return stripped version of questions (questions list without answers)
          const strippedQuestions = baseTransformed.questions.map((q) => ({
            id: q.id,
            label: q.label,
            number: q.number,
            text: q.text,
            marks: q.marks,
            questionImage: q.questionImage,
            answer: '',
            answerImage: null,
          }))

          return {
            id: baseTransformed.id,
            uddeepok: baseTransformed.uddeepok,
            uddeepokImage: baseTransformed.uddeepokImage,
            questions: strippedQuestions,
            chapterName: baseTransformed.chapterName,
            subjectName: baseTransformed.subjectName,
            className: baseTransformed.className,
            classSlug: baseTransformed.classSlug,
            subjectId: baseTransformed.subjectId,
            subjectSlug: baseTransformed.subjectSlug,
            chapterId: baseTransformed.chapterId,
            chapterSlug: baseTransformed.chapterSlug,
            isPremium: true,
            price: baseTransformed.price,
            difficulty: baseTransformed.difficulty,
            year: baseTransformed.year,
            board: baseTransformed.board,
            hasAccess: false,
          }
        }
      }
      return { ...baseTransformed, hasAccess: true }
    })

    return NextResponse.json({
      success: true,
      data: { cqs: transformedCqs },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers: cacheHeaders.noCache })
  } catch (error) {
    return handleApiError(error, 'Get CQs error')
  }
}

export async function POST(request: Request) {
  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    // Require admin auth for creating CQs
    const auth = await verifyAuth(request)
    if (!auth?.user || !['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)) {
      return apiError('সৃজনশীল প্রশ্ন তৈরি করার অনুমতি নেই', 403)
    }

    const { buildPremiumCreatePayload } = await import('@/lib/premium')
    const body = await request.json() as Record<string, unknown>
    const sanitized = buildPremiumCreatePayload(body)
    const data = {
      uddeepok: sanitized.uddeepok as string,
      uddeepokImage: (sanitized.uddeepokImage as string) || null,
      question1: sanitized.question1 as string,
      question1Image: (sanitized.question1Image as string) || null,
      question2: (sanitized.question2 as string) || '',
      question2Image: (sanitized.question2Image as string) || null,
      question3: (sanitized.question3 as string) || '',
      question3Image: (sanitized.question3Image as string) || null,
      question4: (sanitized.question4 as string) || '',
      question4Image: (sanitized.question4Image as string) || null,
      answer1: (sanitized.answer1 as string) || '',
      answer1Image: (sanitized.answer1Image as string) || null,
      answer2: (sanitized.answer2 as string) || '',
      answer2Image: (sanitized.answer2Image as string) || null,
      answer3: (sanitized.answer3 as string) || '',
      answer3Image: (sanitized.answer3Image as string) || null,
      answer4: (sanitized.answer4 as string) || '',
      answer4Image: (sanitized.answer4Image as string) || null,
      chapterId: sanitized.chapterId as string,
      classLevel: sanitized.classLevel as string,
      subjectId: sanitized.subjectId as string,
      board: (sanitized.board as string) || null,
      year: (sanitized.year as string) || null,
      difficulty: (sanitized.difficulty as string) || 'MEDIUM',
      isPremium: (sanitized.isPremium as boolean) || false,
      price: (sanitized.price as number) || 0,
      tags: (sanitized.tags as string) || null,
    }

    if (!data.uddeepok || !data.question1 || !data.chapterId || !data.classLevel || !data.subjectId) {
      return apiError('প্রয়োজনীয় ফিল্ড পূরণ করুন', 400)
    }

    const cq = await db.cQ.create({ data })

    return NextResponse.json(
      { success: true, data: { message: 'সৃজনশীল প্রশ্ন সফলভাবে তৈরি হয়েছে', cq } },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, 'Create CQ error')
  }
}
