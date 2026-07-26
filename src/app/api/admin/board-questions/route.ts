import { db } from '@/lib/db'
import { apiResponse, paginatedApiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { softDelete } from '@/lib/soft-delete'
import { auditFromRequest, AuditActions, getClientIP } from '@/lib/audit'
import { createVersion } from '@/lib/version-history'

const createBoardMcqSchema = z.object({
  type: z.literal('mcq'),
  question: z.string().min(1, 'প্রশ্ন আবশ্যক'),
  questionImage: z.string().nullable().optional(),
  optionA: z.string().min(1, 'অপশন A আবশ্যক'),
  optionAImage: z.string().nullable().optional(),
  optionB: z.string().min(1, 'অপশন B আবশ্যক'),
  optionBImage: z.string().nullable().optional(),
  optionC: z.string().min(1, 'অপশন C আবশ্যক'),
  optionCImage: z.string().nullable().optional(),
  optionD: z.string().min(1, 'অপশন D আবশ্যক'),
  optionDImage: z.string().nullable().optional(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().nullable().optional(),
  explanationImage: z.string().nullable().optional(),
  chapterId: z.string().min(1, 'অধ্যায় আইডি আবশ্যক'),
  classLevel: z.string().min(1, 'শ্রেণি আবশ্যক'),
  subjectId: z.string().min(1, 'বিষয় আইডি আবশ্যক'),
  board: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  isPremium: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  tags: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const createBoardCqSchema = z.object({
  type: z.literal('cq'),
  uddeepok: z.string().min(1, 'উদ্দীপক আবশ্যক'),
  uddeepokImage: z.string().nullable().optional(),
  question1: z.string().min(1, 'প্রশ্ন ১ আবশ্যক'),
  question1Image: z.string().nullable().optional(),
  question2: z.string().optional(),
  question2Image: z.string().nullable().optional(),
  question3: z.string().optional(),
  question3Image: z.string().nullable().optional(),
  question4: z.string().optional(),
  question4Image: z.string().nullable().optional(),
  answer1: z.string().min(1, 'উত্তর ১ আবশ্যক'),
  answer1Image: z.string().nullable().optional(),
  answer2: z.string().optional(),
  answer2Image: z.string().nullable().optional(),
  answer3: z.string().optional(),
  answer3Image: z.string().nullable().optional(),
  answer4: z.string().optional(),
  answer4Image: z.string().nullable().optional(),
  chapterId: z.string().min(1, 'অধ্যায় আইডি আবশ্যক'),
  classLevel: z.string().min(1, 'শ্রেণি আবশ্যক'),
  subjectId: z.string().min(1, 'বিষয় আইডি আবশ্যক'),
  board: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  isPremium: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  tags: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

function mapMCQ(item: Record<string, unknown>) {
  return {
    id: item.id,
    type: 'mcq' as const,
    board: item.board,
    year: item.year,
    topic: item.topic,
    classLevel: item.classLevel,
    subjectId: item.subjectId,
    chapterId: item.chapterId,
    title: item.question,
    difficulty: item.difficulty,
    isPremium: item.isPremium,
    isActive: item.isActive,
    createdAt: item.createdAt,
    chapter: item.chapter ?? null,
    subject: (item.chapter as Record<string, unknown> | null)?.subject ?? null,
  }
}

function mapCQ(item: Record<string, unknown>) {
  return {
    id: item.id,
    type: 'cq' as const,
    board: item.board,
    year: item.year,
    topic: item.topic,
    classLevel: item.classLevel,
    subjectId: item.subjectId,
    chapterId: item.chapterId,
    title: item.uddeepok,
    difficulty: item.difficulty,
    isPremium: item.isPremium,
    isActive: item.isActive,
    createdAt: item.createdAt,
    chapter: item.chapter ?? null,
    subject: (item.chapter as Record<string, unknown> | null)?.subject ?? null,
  }
}

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const board = searchParams.get('board')
    const year = searchParams.get('year')
    const classLevel = searchParams.get('classLevel')
    const subjectId = searchParams.get('subjectId')
    const type = searchParams.get('type')
    const q = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (type === 'lecture') {
      return paginatedApiResponse([], { page, limit, total: 0, totalPages: 0 })
    }

    const buildWhere = (searchFields: string[]) => {
      const where: Record<string, unknown> = { board: { not: null } }
      if (q) {
        where.OR = searchFields.map((field) => ({ [field]: { contains: q, mode: 'insensitive' } }))
      }
      if (board) where.board = board
      if (year) where.year = year
      if (classLevel) where.classLevel = classLevel
      if (subjectId) where.subjectId = subjectId
      return where
    }

    const chapterInclude = {
      select: {
        id: true, name: true, slug: true,
        subject: { select: { id: true, name: true, slug: true, classId: true } },
      },
    }

    if (type === 'MCQ') {
      const where = buildWhere(['question', 'explanation', 'tags', 'topic'])
      const [records, total] = await Promise.all([
        db.mCQ.findMany({ where, include: { chapter: chapterInclude }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.mCQ.count({ where }),
      ])
      return paginatedApiResponse(records.map((r) => mapMCQ(r as unknown as Record<string, unknown>)), { page, limit, total, totalPages: Math.ceil(total / limit) })
    }

    if (type === 'CQ') {
      const where = buildWhere(['uddeepok', 'question1', 'question2', 'question3', 'question4', 'topic'])
      const [records, total] = await Promise.all([
        db.cQ.findMany({ where, include: { chapter: chapterInclude }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.cQ.count({ where }),
      ])
      return paginatedApiResponse(records.map((r) => mapCQ(r as unknown as Record<string, unknown>)), { page, limit, total, totalPages: Math.ceil(total / limit) })
    }

    const mcqWhere = buildWhere(['question', 'explanation', 'tags', 'topic'])
    const cqWhere = buildWhere(['uddeepok', 'question1', 'question2', 'question3', 'question4', 'topic'])

    const [mcqRecords, cqRecords, mcqTotal, cqTotal] = await Promise.all([
      db.mCQ.findMany({ where: mcqWhere, include: { chapter: chapterInclude }, orderBy: { createdAt: 'desc' } }),
      db.cQ.findMany({ where: cqWhere, include: { chapter: chapterInclude }, orderBy: { createdAt: 'desc' } }),
      db.mCQ.count({ where: mcqWhere }),
      db.cQ.count({ where: cqWhere }),
    ])

    const total = mcqTotal + cqTotal
    const merged = [
      ...mcqRecords.map((r) => mapMCQ(r as unknown as Record<string, unknown>)),
      ...cqRecords.map((r) => mapCQ(r as unknown as Record<string, unknown>)),
    ].sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())

    const start = (page - 1) * limit
    const paginated = merged.slice(start, start + limit)

    return paginatedApiResponse(paginated, { page, limit, total, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    return handleApiError(error, 'Admin Get Board Questions')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { type } = body

    if (type === 'MCQ') {
      const validation = validateBody(createBoardMcqSchema, body)
      if ('error' in validation) return validation.error
      const { question, questionImage, optionA, optionAImage, optionB, optionBImage, optionC, optionCImage, optionD, optionDImage, correctAnswer, explanation, explanationImage, chapterId, classLevel, subjectId, board, year, topic, difficulty, isPremium, price, tags, isActive } = validation.data

      const data = await db.mCQ.create({
        data: {
          question, questionImage: questionImage || null,
          optionA, optionAImage: optionAImage || null,
          optionB, optionBImage: optionBImage || null,
          optionC, optionCImage: optionCImage || null,
          optionD, optionDImage: optionDImage || null,
          correctAnswer, explanation: explanation || null, explanationImage: explanationImage || null,
          chapterId, classLevel, subjectId,
          board: board || null, year: year || null, topic: topic || null,
          difficulty: (difficulty || 'MEDIUM').toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
          isPremium: isPremium ?? false, price: price ?? 0,
          tags: tags || null, isActive: isActive ?? true,
        },
      })

      await invalidateContentCache('board-question')
      await auditFromRequest(request, auth.user.id, AuditActions.MCQ_CREATE, 'mcq', data.id, body as Record<string, unknown>, { question: data.question } as Record<string, unknown>)
      return apiResponse(data, 201)
    }

    const validation = validateBody(createBoardCqSchema, body)
    if ('error' in validation) return validation.error
    const { uddeepok, uddeepokImage, question1, question1Image, question2, question2Image, question3, question3Image, question4, question4Image, answer1, answer1Image, answer2, answer2Image, answer3, answer3Image, answer4, answer4Image, chapterId, classLevel, subjectId, board, year, topic, difficulty, isPremium, price, tags, isActive } = validation.data

    const data = await db.cQ.create({
      data: {
        uddeepok, uddeepokImage: uddeepokImage || null,
        question1, question1Image: question1Image || null,
        question2: question2 || '', question2Image: question2Image || null,
        question3: question3 || '', question3Image: question3Image || null,
        question4: question4 || '', question4Image: question4Image || null,
        answer1, answer1Image: answer1Image || null,
        answer2: answer2 || '', answer2Image: answer2Image || null,
        answer3: answer3 || '', answer3Image: answer3Image || null,
        answer4: answer4 || '', answer4Image: answer4Image || null,
        chapterId, classLevel, subjectId,
        board: board || null, year: year || null, topic: topic || null,
        difficulty: (difficulty || 'MEDIUM').toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
        isPremium: isPremium ?? false, price: price ?? 0,
        tags: tags || null, isActive: isActive ?? true,
      },
    })

    await invalidateContentCache('board-question')
    await auditFromRequest(request, auth.user.id, AuditActions.CQ_CREATE, 'cq', data.id, body as Record<string, unknown>, { uddeepok: data.uddeepok } as Record<string, unknown>)
    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Board Question')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { id, type, ...updateData } = body

    if (!id) return apiError('প্রশ্নের ID আবশ্যক', 400)
    if (!type || (type !== 'mcq' && type !== 'cq')) return apiError('প্রশ্নের ধরন নির্ধারণ করুন (mcq বা cq)', 400)

    if (type === 'mcq') {
      const existing = await db.mCQ.findUnique({ where: { id } })
      if (!existing) return apiError('MCQ খুঁজে পাওয়া যায়নি', 404)

      const data: Record<string, unknown> = {}
      const allowedFields = [
        'question', 'questionImage', 'optionA', 'optionAImage', 'optionB', 'optionBImage',
        'optionC', 'optionCImage', 'optionD', 'optionDImage',
        'correctAnswer', 'explanation', 'explanationImage', 'chapterId', 'classLevel',
        'subjectId', 'board', 'year', 'topic', 'difficulty',
        'isPremium', 'price', 'tags', 'isActive',
      ]
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) data[field] = updateData[field]
      }

      const ipAddress = getClientIP(request)
      const userAgent = request.headers.get('user-agent') || undefined

      const changedFields = Object.keys(data).filter(
        key => JSON.stringify(data[key]) !== JSON.stringify(existing[key as keyof typeof existing])
      )

      const updated = await db.$transaction(async (tx) => {
        await createVersion(tx, 'mCQ', id, { ...existing }, auth.user.id, changedFields, {
          ipAddress, userAgent,
        })
        return tx.mCQ.update({ where: { id }, data: data as never })
      }, { maxWait: 10000, timeout: 30000 })

      await invalidateContentCache('board-question')
      await auditFromRequest(request, auth.user.id, AuditActions.MCQ_UPDATE, 'mcq', id, existing as Record<string, unknown>, data)
      return apiResponse(updated)
    }

    const existingCq = await db.cQ.findUnique({ where: { id } })
    if (!existingCq) return apiError('CQ খুঁজে পাওয়া যায়নি', 404)

    const data: Record<string, unknown> = {}
    const allowedFields = [
      'uddeepok', 'uddeepokImage', 'question1', 'question1Image', 'question2', 'question2Image',
      'question3', 'question3Image', 'question4', 'question4Image',
      'answer1', 'answer1Image', 'answer2', 'answer2Image',
      'answer3', 'answer3Image', 'answer4', 'answer4Image',
      'chapterId', 'classLevel', 'subjectId', 'board', 'year', 'topic',
      'difficulty', 'isPremium', 'price', 'tags', 'isActive',
    ]
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) data[field] = updateData[field]
    }

    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const changedFields = Object.keys(data).filter(
      key => JSON.stringify(data[key]) !== JSON.stringify(existingCq[key as keyof typeof existingCq])
    )

    const updated = await db.$transaction(async (tx) => {
      await createVersion(tx, 'cQ', id, { ...existingCq }, auth.user.id, changedFields, {
        ipAddress, userAgent,
      })
      return tx.cQ.update({ where: { id }, data: data as never })
    }, { maxWait: 10000, timeout: 30000 })

    await invalidateContentCache('board-question')
    await auditFromRequest(request, auth.user.id, AuditActions.CQ_UPDATE, 'cq', id, existingCq as Record<string, unknown>, data)
    return apiResponse(updated)
  } catch (error) {
    return handleApiError(error, 'Admin Update Board Question')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id) return apiError('প্রশ্নের ID আবশ্যক', 400)
    if (!type || (type !== 'mcq' && type !== 'cq')) return apiError('প্রশ্নের ধরন নির্ধারণ করুন (mcq বা cq)', 400)

    if (type === 'mcq') {
      const existing = await db.mCQ.findUnique({ where: { id } })
      if (!existing) return apiError('MCQ খুঁজে পাওয়া যায়নি', 404)
      await softDelete(db, 'mcq', id, auth.user.id)
      await invalidateContentCache('board-question')
      await auditFromRequest(request, auth.user.id, AuditActions.MCQ_DELETE, 'mcq', id, existing as Record<string, unknown>, undefined)
      return apiResponse({ id }, 'MCQ সফলভাবে মুছে ফেলা হয়েছে')
    }

    const existing = await db.cQ.findUnique({ where: { id } })
    if (!existing) return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    await softDelete(db, 'cq', id, auth.user.id)
    await invalidateContentCache('board-question')
    await auditFromRequest(request, auth.user.id, AuditActions.CQ_DELETE, 'cq', id, existing as Record<string, unknown>, undefined)
    return apiResponse({ id }, 'CQ সফলভাবে মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Admin Delete Board Question')
  }
}
