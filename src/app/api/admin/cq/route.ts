import { db } from '@/lib/db'
import { apiResponse, paginatedApiResponse, apiError, withAdmin, parseIdsParam, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions, EntityTypes, getClientIP } from '@/lib/audit'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { transitionWorkflow } from '@/lib/workflow'

const createCqSchema = z.object({
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

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const classLevel = searchParams.get('classLevel')
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const difficulty = searchParams.get('difficulty')
    const board = searchParams.get('board')
    const year = searchParams.get('year')
    const topic = searchParams.get('topic')
    const isPremium = searchParams.get('isPremium')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (q) {
      where.OR = [
        { uddeepok: { contains: q, mode: 'insensitive' } },
        { question1: { contains: q, mode: 'insensitive' } },
        { question2: { contains: q, mode: 'insensitive' } },
        { question3: { contains: q, mode: 'insensitive' } },
        { question4: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (classLevel) where.classLevel = classLevel
    if (subjectId) where.subjectId = subjectId
    if (chapterId) where.chapterId = chapterId
    if (difficulty) where.difficulty = difficulty
    if (board) where.board = board
    if (year) where.year = year
    if (topic) where.topic = topic
    if (isPremium !== null && isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    const [data, total] = await Promise.all([
      db.cQ.findMany({
        where,
        include: {
          chapter: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.cQ.count({ where }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get CQs')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const body = await request.json()
    const validation = validateBody(createCqSchema, body)
    if ('error' in validation) return validation.error
    const {
      uddeepok, uddeepokImage, question1, question1Image,
      question2, question2Image, question3, question3Image,
      question4, question4Image, answer1, answer1Image,
      answer2, answer2Image, answer3, answer3Image,
      answer4, answer4Image, chapterId, classLevel, subjectId,
      board, year, topic, difficulty, isPremium, price, tags, isActive,
    } = validation.data

    const data = await db.$transaction(async (tx) => {
      const created = await tx.cQ.create({
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
          isPremium: deriveIsPremium(price), price: price ?? 0,
          tags: tags || null, isActive: isActive ?? true,
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_CREATE, EntityTypes.CQ_QUESTION, created.id, body, undefined, tx as never)
      return created
    })

    await invalidateContentCache('cq')
    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create CQ')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return apiError('CQ ID আবশ্যক', 400)
    }

    const existing = await db.cQ.findUnique({ where: { id } })
    if (!existing) {
      return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    }

    const updateFields: Record<string, unknown> = {}
    const allowedFields = [
      'uddeepok', 'uddeepokImage',
      'question1', 'question1Image', 'question2', 'question2Image',
      'question3', 'question3Image', 'question4', 'question4Image',
      'answer1', 'answer1Image', 'answer2', 'answer2Image',
      'answer3', 'answer3Image', 'answer4', 'answer4Image',
      'chapterId', 'classLevel', 'subjectId', 'board', 'year', 'topic',
      'difficulty', 'isPremium', 'price', 'tags', 'isActive',
    ]

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field]
      }
    }

    // Derive isPremium from price if price is being changed
    if (updateData.price !== undefined) {
      updateFields.isPremium = deriveIsPremium(updateData.price)
    }

    // Determine which fields actually changed
    const changedFields = Object.keys(updateFields).filter(
      key => JSON.stringify(updateFields[key]) !== JSON.stringify(existing[key as keyof typeof existing])
    )

    // Transition workflow + update content atomically
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const workflow = await db.contentWorkflow.findFirst({ where: { entityType: 'cQ', entityId: id } })

    const result = await transitionWorkflow(db as never, {
      entityType: 'cQ',
      entityId: id,
      action: 'update_content',
      userId: auth.user.id,
      userRole: auth.user.role,
      expectedVersion: workflow?.version ?? 0,
      ipAddress,
      userAgent,
      changedFields,
      contentUpdate: { data: updateFields },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    await invalidateContentCache('cq')
    return apiResponse(result.contentRecord)
  } catch (error) {
    return handleApiError(error, 'Admin Update CQ')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const { searchParams } = new URL(request.url)

    const ids = parseIdsParam(searchParams)
    if (ids) {
      await db.$transaction(async (tx) => {
        for (const delId of ids) {
          await tx.cQ.update({
            where: { id: delId },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
        }
        await Promise.all(ids.map(id => auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, EntityTypes.CQ_QUESTION, id, undefined, undefined, tx as never)))
      })
      await invalidateContentCache('cq')
      return apiResponse({ deleted: ids.length }, `${ids.length}টি CQ মুছে ফেলা হয়েছে`)
    }

    const idFromQuery = searchParams.get('id')

    let id = idFromQuery

    if (!id) {
      try {
        const body = await request.json()
        id = body.id
      } catch {
        // No body provided
      }
    }

    if (!id) {
      return apiError('CQ ID আবশ্যক', 400)
    }

    const existing = await db.cQ.findUnique({ where: { id } })
    if (!existing) {
      return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    }

    const guard = await guardDeleteDependencies('cq', id)
    if (!guard.ok) return guard.response

    await db.$transaction(async (tx) => {
      await tx.cQ.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: auth.user.id },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.CONTENT_DELETE, EntityTypes.CQ_QUESTION, id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('cq')
    return apiResponse({ id }, 'CQ সফলভাবে মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Admin Delete CQ')
  }
}
