import { db } from '@/lib/db'
import { apiResponse, paginatedApiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { AuditActions, createAuditLog, getClientIP } from '@/lib/audit'
import { handleApiError } from '@/lib/errors'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { transitionWorkflow } from '@/lib/workflow'

const createKnowledgeQuestionSchema = z.object({
  chapterId: z.string().min(1, 'chapterId is required'),
  type: z.enum(['knowledge', 'comprehension'], { message: 'type must be "knowledge" or "comprehension"' }),
  question: z.string().min(1, 'question is required'),
  answer: z.string().min(1, 'answer is required'),
  questionImage: z.string().nullable().optional(),
  answerImage: z.string().nullable().optional(),
  isPremium: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  order: z.number().min(0).optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapterId')
    const type = searchParams.get('type')
    const q = searchParams.get('q')
    const isPremium = searchParams.get('isPremium')
    const isActive = searchParams.get('isActive')
    const classLevel = searchParams.get('classLevel')
    const subjectId = searchParams.get('subjectId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    const chapterFilter: Record<string, unknown> = {}
    if (chapterId) chapterFilter.id = chapterId
    if (classLevel) chapterFilter.subject = { class: { slug: classLevel } }
    if (subjectId) chapterFilter.subjectId = subjectId
    if (Object.keys(chapterFilter).length > 0) where.chapter = chapterFilter
    if (type) where.type = type
    if (q) {
      where.OR = [
        { question: { contains: q, mode: 'insensitive' } },
        { answer: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (isPremium !== null && isPremium !== undefined) where.isPremium = isPremium === 'true'
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    const [data, total] = await Promise.all([
      db.knowledgeQuestion.findMany({
        where,
        include: {
          chapter: {
            select: {
              id: true, name: true, slug: true,
              subject: {
                select: {
                  id: true, name: true,
                  class: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
        },
        orderBy: [{ type: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.knowledgeQuestion.count({ where }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Knowledge Questions')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validation = validateBody(createKnowledgeQuestionSchema, body)
    if ('error' in validation) return validation.error
    const { chapterId, type, question, answer, questionImage, answerImage, isPremium, price, order } = validation.data

    const chapter = await db.chapter.findUnique({ where: { id: chapterId } })
    if (!chapter) return apiError('Chapter not found', 404)

    const data = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeQuestion.create({
        data: {
          chapterId,
          type: type.toUpperCase() as 'KNOWLEDGE' | 'COMPREHENSION',
          question,
          answer,
          questionImage: questionImage || null,
          answerImage: answerImage || null,
          isPremium: deriveIsPremium(price),
          price: price ?? 0,
          order: order ?? 0,
        },
        include: {
          chapter: { select: { id: true, name: true, slug: true } },
        },
      })
      await createAuditLog({
        adminId: auth.user.id,
        action: AuditActions.KNOWLEDGE_CREATE,
        entityType: 'knowledge_question',
        entityId: created.id,
        newData: { chapterId, type, question, isPremium: created.isPremium, price: created.price },
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
        userName: auth.user.name,
        userRole: auth.user.role,
        status: 'success',
        tx: tx as never,
      })
      return created
    })

    return apiResponse(data, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Knowledge Question')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { id, chapterId, type, question, answer, questionImage, answerImage, isPremium, price, order, isActive } = body

    if (!id) return apiError('id is required', 400)

    const existing = await db.knowledgeQuestion.findUnique({ where: { id } })
    if (!existing) return apiError('Knowledge question not found', 404)

    const updateData: Record<string, unknown> = {}
    if (chapterId !== undefined) updateData.chapterId = chapterId
    if (type !== undefined) {
      if (!['knowledge', 'comprehension'].includes(type)) return apiError('type must be "knowledge" or "comprehension"', 400)
      updateData.type = type
    }
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (questionImage !== undefined) updateData.questionImage = questionImage
    if (answerImage !== undefined) updateData.answerImage = answerImage
    if (isPremium !== undefined) updateData.isPremium = isPremium
    if (price !== undefined) {
      updateData.price = price
      // Derive isPremium from price
      updateData.isPremium = deriveIsPremium(price)
    }
    if (order !== undefined) updateData.order = order
    if (isActive !== undefined) updateData.isActive = isActive

    // Determine which fields actually changed
    const changedFields = Object.keys(updateData).filter(
      key => JSON.stringify(updateData[key]) !== JSON.stringify(existing[key as keyof typeof existing])
    )

    // Transition workflow + update content atomically
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const workflow = await db.contentWorkflow.findFirst({ where: { entityType: 'knowledgeQuestion', entityId: id } })

    const result = await transitionWorkflow(db as never, {
      entityType: 'knowledgeQuestion',
      entityId: id,
      action: 'update_content',
      userId: auth.user.id,
      userRole: auth.user.role,
      expectedVersion: workflow?.version ?? 0,
      ipAddress,
      userAgent,
      changedFields,
      contentUpdate: {
        data: updateData,
        include: {
          chapter: { select: { id: true, name: true, slug: true } },
        },
      },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    return apiResponse(result.contentRecord)
  } catch (error) {
    return handleApiError(error, 'Admin Update Knowledge Question')
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
    const ids = searchParams.get('ids')

    if (id) {
      const existing = await db.knowledgeQuestion.findUnique({ where: { id } })
      if (!existing) return apiError('Knowledge question not found', 404)
      await db.$transaction(async (tx) => {
        await tx.knowledgeQuestion.update({
          where: { id },
          data: { deletedAt: new Date(), deletedBy: auth.user.id },
        })
        await createAuditLog({
          adminId: auth.user.id,
          action: AuditActions.KNOWLEDGE_DELETE,
          entityType: 'knowledge_question',
          entityId: id,
          oldData: { question: existing.question },
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || undefined,
          userName: auth.user.name,
          userRole: auth.user.role,
          status: 'success',
          tx: tx as never,
        })
      })
    } else if (ids) {
      const idArray = ids.split(',').filter(Boolean)
      if (idArray.length === 0) return apiError('No valid IDs provided', 400)
      await db.$transaction(async (tx) => {
        for (const kid of idArray) {
          await tx.knowledgeQuestion.update({
            where: { id: kid },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
        }
        await createAuditLog({
          adminId: auth.user.id,
          action: AuditActions.KNOWLEDGE_DELETE,
          entityType: 'knowledge_question',
          entityId: 'bulk:' + ids,
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || undefined,
          userName: auth.user.name,
          userRole: auth.user.role,
          status: 'success',
          tx: tx as never,
        })
      })
    } else {
      return apiError('id or ids is required', 400)
    }

    return apiResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Knowledge Questions')
  }
}
