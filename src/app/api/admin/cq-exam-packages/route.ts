import { apiError,apiResponse,withAdmin,withCsrf } from '@/lib/api-utils'
import { AuditActions, auditFromRequest, createAuditLog, EntityTypes, getClientIP } from '@/lib/audit'
import { createVersion } from '@/lib/version-history'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { softDelete } from '@/lib/soft-delete'
import { Prisma } from '@prisma/client'

async function checkGradingDeadline(setId: string): Promise<void> {
  const examSet = await db.cQExamSet.findUnique({
    where: { id: setId },
    select: { gradingDeadline: true },
  })
  if (examSet?.gradingDeadline && Date.now() > examSet.gradingDeadline.getTime()) {
    throw new Error('মূল্যায়নের সময়সীমা শেষ হয়ে গেছে।')
  }
}

// When called inside $transaction, pass the tx client so queries run on the
// same connection and see uncommitted writes from the transaction.
async function recalculateSetTotals(setId: string, client: any = db) {
  const result = await client.cQExamSetQuestion.aggregate({
    where: { setId },
    _count: { id: true },
    _sum: { marks: true },
  })
  const totalQuestions = result._count.id
  const totalMarks = result._sum.marks || 0
  await client.cQExamSet.update({
    where: { id: setId },
    data: { totalQuestions, totalMarks },
  })
  return { totalQuestions, totalMarks }
}

async function recalculatePackageTotalSets(packageId: string, client: any = db) {
  const count = await client.cQExamSet.count({
    where: { packageId },
  })
  await client.cQExamPackage.update({
    where: { id: packageId },
    data: { totalSets: count },
  })
  return count
}

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      // List packages
      case 'list': {
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const search = searchParams.get('search') || ''
        const classId = searchParams.get('classId') || ''
        const status = searchParams.get('status') || ''

        const where: Record<string, unknown> = {}
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        }
        if (classId) where.classId = classId
        if (status) where.status = status

        const includeSets = searchParams.get('includeSets') === 'true'
        const [packages, total] = await Promise.all([
          db.cQExamPackage.findMany({
            where,
            include: {
              class: { select: { id: true, name: true, slug: true } },
              _count: { select: { examSets: true, purchases: true } },
              ...(includeSets ? { examSets: { select: { id: true, title: true, scheduledDate: true, startTime: true, endTime: true }, orderBy: { scheduledDate: 'asc' } } } : {}),
            },
            orderBy: { order: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.cQExamPackage.count({ where }),
        ])

        return apiResponse({
          packages,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }

      // Package detail
      case 'detail': {
        const id = searchParams.get('id')
        if (!id) return apiError('Package ID is required', 400)

        const pkg = await db.cQExamPackage.findUnique({
          where: { id },
          include: {
            class: { select: { id: true, name: true, slug: true } },
            examSets: {
              orderBy: { order: 'asc' },
              include: {
                _count: { select: { questions: true, submissions: true } },
              },
            },
            _count: { select: { purchases: true } },
          },
        })
        if (!pkg) return apiError('Package not found', 404)

        return apiResponse({ package: pkg })
      }

      // Set detail
      case 'set-detail': {
        const setId = searchParams.get('setId')
        if (!setId) return apiError('Set ID is required', 400)

        const set = await db.cQExamSet.findUnique({
          where: { id: setId },
          include: {
            _count: { select: { questions: true, submissions: true } },
            questions: {
              orderBy: { order: 'asc' },
              include: {
                cq: {
                  include: { chapter: { select: { id: true, name: true } } },
                },
              },
            },
          },
        })
        if (!set) return apiError('Set not found', 404)

        return apiResponse({ set })
      }

      // Search CQ questions
      case 'search-cqs': {
        const classLevel = searchParams.get('classLevel') || ''
        const subjectId = searchParams.get('subjectId') || ''
        const chapterId = searchParams.get('chapterId') || ''
        const q = searchParams.get('q') || ''
        const cqPage = parseInt(searchParams.get('page') || '1')
        const cqLimit = parseInt(searchParams.get('limit') || '20')

        const where: Record<string, unknown> = { isActive: true }
        if (classLevel) where.classLevel = classLevel
        if (subjectId) where.subjectId = subjectId
        if (chapterId) where.chapterId = chapterId
        if (q) where.uddeepok = { contains: q, mode: 'insensitive' }

        const [cqs, total] = await Promise.all([
          db.cQ.findMany({
            where,
            include: {
              chapter: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (cqPage - 1) * cqLimit,
            take: cqLimit,
          }),
          db.cQ.count({ where }),
        ])

        return apiResponse({
          cqs,
          pagination: { page: cqPage, limit: cqLimit, total, totalPages: Math.ceil(total / cqLimit) },
        })
      }

      // List submissions for a set (with pagination)
      case 'submissions': {
        const subSetId = searchParams.get('setId')
        if (!subSetId) return apiError('Set ID is required', 400)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
        const status = searchParams.get('status') || ''

        const where: Record<string, unknown> = { setId: subSetId }
        if (status) where.status = status

        const [subs, total] = await Promise.all([
          db.cQExamSubmission.findMany({
            where,
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true, classLevel: true } },
              answers: {
                include: { images: { orderBy: { order: 'asc' } } },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.cQExamSubmission.count({ where }),
        ])

        return apiResponse({
          submissions: subs,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }

      // Bulk grading by question — all submissions with answer for a specific question (with pagination)
      case 'bulk-grade-by-question': {
        const bgSetId = searchParams.get('setId')
        const questionId = searchParams.get('questionId')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        if (!bgSetId || !questionId) return apiError('Set ID and Question ID are required', 400)

        const where = { setId: bgSetId, status: { in: ['SUBMITTED', 'GRADED', 'PUBLISHED'] as ['SUBMITTED', 'GRADED', 'PUBLISHED'] } }

        const [bulkSubs, total] = await Promise.all([
          db.cQExamSubmission.findMany({
            where,
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true, classLevel: true } },
              answers: {
                where: { questionId },
                include: { images: { orderBy: { order: 'asc' } } },
                orderBy: { subIndex: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.cQExamSubmission.count({ where }),
        ])

        return apiResponse({
          submissions: bulkSubs,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }

      // Get single submission for grading
      case 'submission-detail': {
        const subId = searchParams.get('submissionId')
        if (!subId) return apiError('Submission ID is required', 400)

        const submission = await db.cQExamSubmission.findUnique({
          where: { id: subId },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true, classLevel: true } },
            set: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  include: {
                    cq: {
                      include: { chapter: { select: { id: true, name: true } } },
                    },
                  },
                },
              },
            },
            answers: {
              include: { images: { orderBy: { order: 'asc' } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
        if (!submission) return apiError('Submission not found', 404)

        return apiResponse({ submission })
      }

      default:
        return apiError('Unknown action', 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin CQ Exam error')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      // Create package
      case 'create-package': {
        const { title, description, classId, subjectIds, price, originalPrice, thumbnail, isPremium, isActive, order, status } = body
        if (!title || !classId) return apiError('Title and class are required', 400)

        // Check for duplicate title within the same class
        const duplicateTitle = await db.cQExamPackage.findFirst({
          where: {
            title,
            classId,
            deletedAt: null,
          },
          select: { id: true },
        })
        if (duplicateTitle) {
          return apiError('এই শ্রেণিতে একই নামের একটি প্যাকেজ ইতিমধ্যে বিদ্যমান।', 409, 'PACKAGE_NAME_EXISTS')
        }

        const pkg = await db.$transaction(async (tx) => {
          const created = await tx.cQExamPackage.create({
            data: {
              title, description, classId,
              subjectIds: subjectIds ? JSON.stringify(subjectIds) : '[]',
              price: price || 0, originalPrice: originalPrice || 0,
              thumbnail: thumbnail || null,
              isPremium: deriveIsPremium(price),
              isActive: isActive ?? true,
              order: order ?? 0, status: status || 'DRAFT',
            },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_PACKAGE_CREATE, 'cq_exam_package', created.id, body, { title: created.title }, tx as never)
          return created
        })
        return apiResponse({ package: pkg }, 201)
      }

      // Create set
      case 'create-set': {
        const { packageId, title, description, scheduledDate, startTime, endTime, duration, marksPerQ, instructions, allowRetake, order, status, answerMode, showAnnotatedImages, autoPublishResults, maxImagesPerAnswer, gradingDeadline, passMarks, showCorrectAnswers, enablePartialGrading, practiceMode, allowUnlimitedAttempts, maxAttempts, reviewAnswers, showExplanations } = body
        if (!packageId || !title || !scheduledDate) return apiError('Package, title, and date are required', 400)

        const set = await db.cQExamSet.create({
          data: {
            packageId, title, description: description || null,
            scheduledDate: new Date(scheduledDate),
            startTime: startTime || '00:00', endTime: endTime || '23:59',
            duration: duration || 30, marksPerQ: marksPerQ || 1,
            instructions: instructions || null,
            allowRetake: allowRetake ?? false,
            answerMode: answerMode || 'flexible',
            showAnnotatedImages: showAnnotatedImages ?? true,
            autoPublishResults: autoPublishResults ?? false,
            maxImagesPerAnswer: maxImagesPerAnswer ?? 5,
            gradingDeadline: gradingDeadline ? new Date(gradingDeadline) : null,
            passMarks: passMarks ?? 0,
            showCorrectAnswers: showCorrectAnswers ?? false,
            enablePartialGrading: enablePartialGrading ?? true,
            practiceMode: practiceMode ?? false,
            allowUnlimitedAttempts: allowUnlimitedAttempts ?? true,
            maxAttempts: maxAttempts ?? null,
            reviewAnswers: reviewAnswers ?? true,
            showExplanations: showExplanations ?? true,
            order: order ?? 0, status: status || 'DRAFT',
          },
        })
        await db.$transaction(async (tx) => {
          await recalculatePackageTotalSets(packageId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_CREATE, 'cq_exam_set', set.id, body, { title: set.title }, tx as never)
        })
        return apiResponse({ set }, 201)
      }

      // Add questions to set (batched)
      case 'add-questions': {
        const { setId, cqIds } = body
        if (!setId || !cqIds?.length) return apiError('Set ID and CQ IDs are required', 400)

        const rawSubMarks = body.subMarks
        const marksArr: number[] = Array.isArray(rawSubMarks) && rawSubMarks.length > 0 && rawSubMarks.every((m: number) => typeof m === 'number' && m > 0)
          ? rawSubMarks
          : [1, 2, 3, 4]
        const totalMarks = marksArr.reduce((a, b) => a + b, 0)

        // Get existing question count for ordering
        const existingCount = await db.cQExamSetQuestion.count({ where: { setId } })

        // Batch check existing questions
        const existingQuestions = await db.cQExamSetQuestion.findMany({
          where: { setId, cqId: { in: cqIds } },
          select: { cqId: true },
        })
        const existingCqIds = new Set(existingQuestions.map(q => q.cqId))

        // Filter to only new CQ IDs
        const newCqIds = (cqIds as string[]).filter((id: string) => !existingCqIds.has(id))

        if (newCqIds.length > 0) {
          // Batch create new questions
          const data = newCqIds.map((cqId, _i) => ({
            setId,
            cqId,
            marks: totalMarks,
            subMarks: JSON.stringify(marksArr),
            order: existingCount + cqIds.indexOf(cqId),
          }))
          await db.cQExamSetQuestion.createMany({ data })
        }

        // Return created questions
        const created = await db.cQExamSetQuestion.findMany({
          where: { setId, cqId: { in: newCqIds } },
          orderBy: { order: 'asc' },
        })
        await db.$transaction(async (tx) => {
          await recalculateSetTotals(setId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_QUESTIONS_ADD, 'cq_exam_set', setId, undefined, { cqIds: newCqIds, count: newCqIds.length }, tx as never)
        })
        return apiResponse({ created })
      }

      // Create typed question (inline typing, no CQ reference)
      case 'create-typed-question': {
        const { setId, typedUddeepok, typedUddeepokImage, typedQuestion1, typedQuestion1Image, typedQuestion2, typedQuestion2Image, typedQuestion3, typedQuestion3Image, typedQuestion4, typedQuestion4Image, subMarks } = body
        if (!setId || !typedQuestion1) return apiError('Set ID and question 1 are required', 400)

        const existingCount = await db.cQExamSetQuestion.count({ where: { setId } })

        const marksArr: number[] = Array.isArray(subMarks) && subMarks.length === 4
          ? subMarks
          : [1, 2, 3, 4]
        const totalMarks = marksArr.reduce((a, b) => a + b, 0)

        const question = await db.cQExamSetQuestion.create({
          data: {
            setId,
            marks: totalMarks,
            order: existingCount,
            type: 'typed',
            subMarks: JSON.stringify(marksArr),
            typedUddeepok: typedUddeepok || null,
            typedUddeepokImage: typedUddeepokImage || null,
            typedQuestion1,
            typedQuestion1Image: typedQuestion1Image || null,
            typedQuestion2: typedQuestion2 || null,
            typedQuestion2Image: typedQuestion2Image || null,
            typedQuestion3: typedQuestion3 || null,
            typedQuestion3Image: typedQuestion3Image || null,
            typedQuestion4: typedQuestion4 || null,
            typedQuestion4Image: typedQuestion4Image || null,
          },
        })
        await db.$transaction(async (tx) => {
          await recalculateSetTotals(setId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_QUESTIONS_ADD, 'cq_exam_set', setId, undefined, { questionId: question.id }, tx as never)
        })
        return apiResponse({ question }, 201)
      }

      // Create non-CQ question (mcq-single, mcq-multiple, fill-blanks, written)
      case 'create-non-cq-question': {
        const { setId, questionType, stem, stemImage, config, marks } = body
        if (!setId || !questionType) return apiError('Set ID and question type required', 400)
        if (!['mcq-single', 'mcq-multiple', 'fill-blanks', 'written'].includes(questionType)) {
          return apiError('Invalid question type', 400)
        }
        if (config !== undefined && (typeof config !== 'object' || config === null || Array.isArray(config))) {
          return apiError('Config must be a valid JSON object', 400)
        }

        const existingCount = await db.cQExamSetQuestion.count({ where: { setId } })

        const question = await db.cQExamSetQuestion.create({
          data: {
            setId,
            type: questionType,
            marks: marks || 1,
            order: existingCount,
            stem: stem || null,
            stemImage: stemImage || null,
            config: config || {},
          },
        })
        await db.$transaction(async (tx) => {
          await recalculateSetTotals(setId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_QUESTIONS_ADD, 'cq_exam_set', setId, undefined, { questionId: question.id }, tx as never)
        })
        return apiResponse({ question }, 201)
      }

      default:
        return apiError('Unknown action', 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin CQ Exam POST error')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      // Update package
      case 'update-package': {
        const { id, ...data } = body
        if (!id) return apiError('Package ID is required', 400)

        const existing = await db.cQExamPackage.findUnique({ where: { id } })
        if (!existing) return apiError('Package not found', 404)

        // Check if package is soft-deleted
        if (existing.deletedAt) return apiError('এই প্যাকেজটি মুছে ফেলা হয়েছে। এটি সম্পাদনা করা যাবে না।', 400, 'PACKAGE_DELETED')

        const allowed = ['title', 'description', 'classId', 'subjectIds', 'price', 'originalPrice', 'thumbnail', 'isPremium', 'isActive', 'order', 'status']
        const updateData: Record<string, unknown> = {}
        for (const key of allowed) {
          if (data[key] !== undefined) updateData[key] = data[key]
        }

        if (updateData.status && typeof updateData.status === 'string') {
          updateData.status = (updateData.status as string).toUpperCase()
        }

        // Validate status transitions
        if (updateData.status !== undefined && updateData.status !== existing.status) {
          const validTransitions: Record<string, string[]> = {
            DRAFT: ['PUBLISHED', 'ARCHIVED'],
            PUBLISHED: ['ARCHIVED'],
            ARCHIVED: ['DRAFT', 'PUBLISHED'],
          }
          const allowed = validTransitions[existing.status] || []
          if (!allowed.includes(updateData.status as string)) {
            return apiError(
              `বর্তমান স্ট্যাটাস "${existing.status}" থেকে "${updateData.status}"-এ পরিবর্তন অনুমোদিত নয়।`,
              400,
              'INVALID_STATUS_TRANSITION'
            )
          }
        }

        // Check for duplicate title within the same class
        if (updateData.title && typeof updateData.title === 'string' && updateData.title !== existing.title) {
          const classIdCheck = updateData.classId || existing.classId
          const duplicate = await db.cQExamPackage.findFirst({
            where: {
              title: updateData.title as string,
              classId: classIdCheck as string,
              id: { not: id },
              deletedAt: null,
            },
            select: { id: true },
          })
          if (duplicate) {
            return apiError('এই শ্রেণিতে একই নামের একটি প্যাকেজ ইতিমধ্যে বিদ্যমান।', 409, 'PACKAGE_NAME_EXISTS')
          }
        }

        if (updateData.subjectIds !== undefined) {
          updateData.subjectIds = JSON.stringify(updateData.subjectIds)
        }

        // Derive isPremium from price if price is being changed
        if (updateData.price !== undefined) {
          updateData.isPremium = deriveIsPremium(updateData.price)
        }

        // Validate classId exists if changed
        if (updateData.classId && updateData.classId !== existing.classId) {
          const classExists = await db.classCategory.findUnique({ where: { id: updateData.classId as string } })
          if (!classExists) return apiError('নির্বাচিত শ্রেণিটি খুঁজে পাওয়া যায়নি।', 400, 'CLASS_NOT_FOUND')
        }

        const ipAddress = getClientIP(request)
        const userAgent = request.headers.get('user-agent') || undefined

        const changedFields = Object.keys(updateData).filter(
          key => JSON.stringify(updateData[key]) !== JSON.stringify(existing[key as keyof typeof existing])
        )

        const pkg = await db.$transaction(async (tx) => {
          await createVersion(tx, 'cQExamPackage', id, { ...existing }, auth.user.id, changedFields, {
            ipAddress, userAgent,
          })
          const updated = await tx.cQExamPackage.update({ where: { id }, data: updateData as never })
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_PACKAGE_UPDATE, 'cq_exam_package', id, existing as Record<string, unknown>, data as Record<string, unknown>, tx as never)
          return updated
        }, { maxWait: 10000, timeout: 30000 })

        return apiResponse({ package: pkg })
      }

      // Update set
      case 'update-set': {
        const setId = body.id
        if (!setId) return apiError('Set ID is required', 400)

        const allowed = ['title', 'description', 'scheduledDate', 'startTime', 'endTime', 'duration', 'marksPerQ', 'instructions', 'allowRetake', 'order', 'status', 'answerMode', 'showAnnotatedImages', 'autoPublishResults', 'maxImagesPerAnswer', 'gradingDeadline', 'passMarks', 'showCorrectAnswers', 'enablePartialGrading', 'practiceMode', 'allowUnlimitedAttempts', 'maxAttempts', 'reviewAnswers', 'showExplanations']
        const updateData: Record<string, unknown> = {}
        for (const key of allowed) {
          if (body[key] !== undefined) updateData[key] = body[key]
        }

        if (updateData.status && typeof updateData.status === 'string') {
          updateData.status = (updateData.status as string).toUpperCase()
        }

        if (updateData.scheduledDate) updateData.scheduledDate = new Date(updateData.scheduledDate as string)
        if (updateData.gradingDeadline) updateData.gradingDeadline = new Date(updateData.gradingDeadline as string)
        if (updateData.gradingDeadline === null) updateData.gradingDeadline = null

        const set = await db.$transaction(async (tx) => {
          const updated = await tx.cQExamSet.update({ where: { id: setId }, data: updateData as never })
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_UPDATE, 'cq_exam_set', setId, undefined, updateData as Record<string, unknown>, tx as never)
          return updated
        })
        return apiResponse({ set })
      }

      // Remove question from set
      case 'remove-question': {
        const { setId, cqId, questionId } = body
        if (!setId || (!cqId && !questionId)) return apiError('Set ID and question/CQ ID are required', 400)

        let questionData: Record<string, unknown> = { setId }
        if (questionId) {
          const q = await db.cQExamSetQuestion.findUnique({ where: { id: questionId } })
          if (q) questionData = { setId, questionId, cqId: q.cqId, type: q.type }
          await db.cQExamSetQuestion.delete({ where: { id: questionId } })
        } else {
          questionData = { setId, cqId }
          await db.cQExamSetQuestion.delete({ where: { setId_cqId: { setId, cqId } } })
        }
        await recalculateSetTotals(setId)
        await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_QUESTIONS_REMOVE, 'cq_exam_set', setId, questionData, undefined, undefined)
        return apiResponse({ success: true })
      }

      // Reorder questions
      case 'reorder-questions': {
        const { setId, questionOrders } = body
        if (!setId || !questionOrders) return apiError('Set ID and orders are required', 400)
        const beforeOrders = await db.cQExamSetQuestion.findMany({
          where: { setId },
          select: { id: true, order: true },
        })
        await Promise.all(
          questionOrders.map((qo: { id: string; order: number }) =>
            db.cQExamSetQuestion.update({
              where: { id: qo.id },
              data: { order: qo.order },
            })
          )
        )
        await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_REORDER_QUESTIONS, 'cq_exam_set', setId, { orders: beforeOrders }, { orders: questionOrders }, undefined)
        return apiResponse({ success: true })
      }

      // Grade submission
      case 'grade-submission': {
        const { submissionId, answers } = body
        if (!submissionId || !answers?.length) return apiError('Submission ID and answers required', 400)

        // Fetch submission to get setId (outside transaction for early validation)
        const submission = await db.cQExamSubmission.findUnique({
          where: { id: submissionId },
          select: { setId: true, userId: true, obtainedMarks: true, status: true },
        })
        if (!submission) return apiError('Submission not found', 404)

        // Enforce grading deadline
        try { await checkGradingDeadline(submission.setId) } catch (e) { return apiError((e as Error).message, 403) }

        const updatedSubmission = await db.$transaction(async (tx) => {
          let totalObtained = 0
          for (const ans of answers) {
            if (ans.id) {
              const obtainedMarks = toDecimal(ans.obtainedMarks ?? 0)
              await tx.cQExamAnswer.update({
                where: { id: ans.id },
                data: { obtainedMarks, feedback: ans.feedback || null, gradedAt: new Date() },
              })
              totalObtained += obtainedMarks
            }
          }

          const examSet = await tx.cQExamSet.findUnique({
            where: { id: submission.setId },
            select: { autoPublishResults: true },
          })

          let newStatus: 'GRADED' | 'PUBLISHED' = 'GRADED'
          if (examSet?.autoPublishResults) {
            const pendingCount = await tx.cQExamSubmission.count({
              where: { setId: submission.setId, status: 'SUBMITTED' },
            })
            if (pendingCount === 0) {
              await tx.cQExamSubmission.updateMany({
                where: { setId: submission.setId, status: 'GRADED' },
                data: { status: 'PUBLISHED' },
              })
              newStatus = 'PUBLISHED'
            }
          }

          return tx.cQExamSubmission.update({
            where: { id: submissionId },
            data: { obtainedMarks: totalObtained, status: newStatus, gradedAt: new Date(), gradedBy: auth?.user?.id || null },
          })
        })

        await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SUBMISSION_GRADE, 'cq_exam_submission', submissionId, { obtainedMarks: submission.obtainedMarks, status: submission.status }, { obtainedMarks: updatedSubmission.obtainedMarks, status: updatedSubmission.status }, undefined)

        return apiResponse({ submission: updatedSubmission })
      }

      // Bulk grade all pending submissions for a set (batched, transactional)
      case 'bulk-grade': {
        const { setId, defaultMarks } = body
        if (!setId) return apiError('Set ID is required', 400)

        // Enforce grading deadline
        try { await checkGradingDeadline(setId) } catch (e) { return apiError((e as Error).message, 403) }

        const marks = typeof defaultMarks === 'number' && !isNaN(defaultMarks)
          ? Math.max(0, defaultMarks)
          : 0

        const result = await db.$transaction(async (tx) => {
          const pendingSubmissions = await tx.cQExamSubmission.findMany({
            where: { setId, status: 'SUBMITTED' },
            include: { answers: true },
          })

          if (pendingSubmissions.length === 0) {
            return { gradedCount: 0, defaultMarks: marks }
          }

          const answerUpdates: Array<{ id: string; obtainedMarks: number }> = []
          const submissionUpdates: Array<{ id: string; obtainedMarks: number }> = []

          for (const sub of pendingSubmissions) {
            let totalObtained = 0
            for (const ans of sub.answers) {
              const answerMarks = Math.min(marks, toDecimal(ans.maxMarks || 0))
              answerUpdates.push({ id: ans.id, obtainedMarks: answerMarks })
              totalObtained += answerMarks
            }
            submissionUpdates.push({ id: sub.id, obtainedMarks: totalObtained })
          }

          await Promise.all(
            answerUpdates.map(({ id, obtainedMarks }) =>
              tx.cQExamAnswer.update({ where: { id }, data: { obtainedMarks, gradedAt: new Date() } })
            )
          )

          await Promise.all(
            submissionUpdates.map(({ id, obtainedMarks }) =>
              tx.cQExamSubmission.update({
                where: { id },
                data: { obtainedMarks, status: 'GRADED', gradedAt: new Date(), gradedBy: auth?.user?.id || null },
              })
            )
          )

          const bulkExamSet = await tx.cQExamSet.findUnique({
            where: { id: setId },
            select: { autoPublishResults: true },
          })
          if (bulkExamSet?.autoPublishResults) {
            const remainingPending = await tx.cQExamSubmission.count({
              where: { setId, status: 'SUBMITTED' },
            })
            if (remainingPending === 0) {
              await tx.cQExamSubmission.updateMany({
                where: { setId, status: 'GRADED' },
                data: { status: 'PUBLISHED' },
              })
            }
          }

          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_BULK_GRADE, 'cq_exam_set', setId, { count: pendingSubmissions.length, defaultMarks: 0 }, { gradedCount: pendingSubmissions.length, defaultMarks: marks }, tx as never)

          return { gradedCount: pendingSubmissions.length, defaultMarks: marks }
        })

        return apiResponse(result)
      }

      // Save bulk grades by question — saves marks for all submissions' answers for one question (batched, transactional)
      case 'save-bulk-grades-by-question': {
        const { submissions: gradeUpdates } = body
        if (!gradeUpdates?.length) return apiError('Submissions data required', 400)

        // Get setId from first submission before transaction
        let firstSubSetId: string | null = null
        if (gradeUpdates[0]?.submissionId) {
          const firstSub = await db.cQExamSubmission.findUnique({
            where: { id: gradeUpdates[0].submissionId },
            select: { setId: true },
          })
          if (firstSub) {
            firstSubSetId = firstSub.setId
            try { await checkGradingDeadline(firstSub.setId) } catch (e) { return apiError((e as Error).message, 403) }
          }
        }

        // Collect all answer updates and submission totals
        const answerUpdates: Array<{ id: string; obtainedMarks: number }> = []
        const submissionTotals = new Map<string, number>()

        for (const item of gradeUpdates) {
          const { submissionId, answers } = item
          if (!submissionId || !answers?.length) continue

          let totalForSubmission = 0
          for (const ans of answers) {
            if (ans.id) {
              const obtainedMarks = ans.obtainedMarks ?? 0
              answerUpdates.push({ id: ans.id, obtainedMarks })
              totalForSubmission += obtainedMarks
            }
          }
          const existingTotal = submissionTotals.get(submissionId) || 0
          submissionTotals.set(submissionId, existingTotal + totalForSubmission)
        }

        await db.$transaction(async (tx) => {
          if (answerUpdates.length > 0) {
            await Promise.all(
              answerUpdates.map(({ id, obtainedMarks }) =>
                tx.cQExamAnswer.update({
                  where: { id },
                  data: { obtainedMarks, gradedAt: new Date() },
                })
              )
            )
          }

          await Promise.all(
            Array.from(submissionTotals.entries()).map(([submissionId, obtainedMarks]) =>
              tx.cQExamSubmission.update({
                where: { id: submissionId },
                data: {
                  obtainedMarks,
                  status: 'GRADED',
                  gradedAt: new Date(),
                  gradedBy: auth?.user?.id || null,
                },
              })
            )
          )

          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_BULK_GRADE, 'cq_exam_set', firstSubSetId || 'bulk', { submissionsUpdated: 0 }, { submissionsUpdated: submissionTotals.size }, tx as never)
        })

        // Check auto-publish
        if (firstSubSetId) {
          const bulkQExamSet = await db.cQExamSet.findUnique({
            where: { id: firstSubSetId },
            select: { autoPublishResults: true },
          })
          if (bulkQExamSet?.autoPublishResults) {
            const remainingPending = await db.cQExamSubmission.count({
              where: { setId: firstSubSetId, status: 'SUBMITTED' },
            })
            if (remainingPending === 0) {
              await db.cQExamSubmission.updateMany({
                where: { setId: firstSubSetId, status: 'GRADED' },
                data: { status: 'PUBLISHED' },
              })
            }
          }
        }

        return apiResponse({ updatedCount: submissionTotals.size })
      }

      // Publish results (transactional)
      case 'publish-results': {
        const { setId } = body
        if (!setId) return apiError('Set ID is required', 400)

        const result = await db.$transaction(async (tx) => {
          const cqSet = await tx.cQExamSet.findUnique({
            where: { id: setId },
            select: { title: true },
          })

          // Update all graded submissions to published
          await tx.cQExamSubmission.updateMany({
            where: { setId, status: 'GRADED' },
            data: { status: 'PUBLISHED' },
          })

          // Find all affected users to notify them
          const publishedSubmissions = await tx.cQExamSubmission.findMany({
            where: { setId, status: 'PUBLISHED' },
            select: { userId: true },
          })

          const userIds = [...new Set(publishedSubmissions.map(s => s.userId))]

          // Create notifications for each student
          if (userIds.length > 0) {
            await tx.notification.createMany({
              data: userIds.map(uid => ({
                userId: uid,
                title: 'ফলাফল প্রকাশিত',
                message: `"${cqSet?.title || ''}" পরীক্ষার ফলাফল প্রকাশিত হয়েছে। এখন আপনার প্রাপ্ত নম্বর ও উত্তর দেখতে পারেন।`,
                type: 'SUCCESS',
                link: null,
              })),
            })
          }

          // Audit log
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_RESULTS_PUBLISH, 'cq_exam_set', setId, { status: 'GRADED' }, { status: 'PUBLISHED', notifiedCount: userIds.length }, tx as never)

          return { notifiedCount: userIds.length }
        })

        return apiResponse({ success: true, ...result })
      }

      // Grant individual retake permission (always sets canRetake=true)
      case 'allow-retake': {
        const { submissionId, retake } = body
        if (!submissionId) return apiError('Submission ID is required', 400)

        const newCanRetake = retake !== undefined ? !!retake : true

        const submission = await db.cQExamSubmission.findUnique({
          where: { id: submissionId },
          select: { canRetake: true },
        })
        if (!submission) return apiError('Submission not found', 404)
        if (submission.canRetake === newCanRetake) {
          return apiResponse({ canRetake: newCanRetake })
        }

        const updated = await db.$transaction(async (tx) => {
          const res = await tx.cQExamSubmission.update({
            where: { id: submissionId },
            data: { canRetake: newCanRetake },
          })

          await auditFromRequest(request, auth.user.id, newCanRetake ? AuditActions.RETAKE_APPROVE : AuditActions.RETAKE_REJECT, 'cq_exam_submission', submissionId, { canRetake: submission.canRetake }, { canRetake: newCanRetake }, tx as never)

          return res
        })

        return apiResponse({ canRetake: updated.canRetake })
      }

      // List retake requests for a set
      case 'list-retake-requests': {
        const { setId } = body
        if (!setId) return apiError('Set ID is required', 400)

        const requests = await db.cQExamRetakeRequest.findMany({
          where: { setId },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true, classLevel: true } },
            set: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
        })

        return apiResponse({ requests })
      }

      // Approve or reject a retake request (transactional)
      case 'approve-retake-request': {
        const { requestId, approve } = body
        if (!requestId) return apiError('Request ID is required', 400)

        const existing = await db.cQExamRetakeRequest.findUnique({
          where: { id: requestId },
        })
        if (!existing) return apiError('Request not found', 404)

        const newStatus = approve ? 'APPROVED' : 'REJECTED'

        await db.$transaction(async (tx) => {
          await tx.cQExamRetakeRequest.update({
            where: { id: requestId },
            data: { status: newStatus, reviewedBy: auth?.user?.id || null, reviewedAt: new Date() },
          })

          if (approve) {
            const submission = await tx.cQExamSubmission.findFirst({
              where: { userId: existing.userId, setId: existing.setId },
              orderBy: { attemptNumber: 'desc' },
            })
            if (submission) {
              await tx.cQExamSubmission.update({
                where: { id: submission.id },
                data: { canRetake: true },
              })
            }

            const setInfo = await tx.cQExamSet.findUnique({
              where: { id: existing.setId },
              select: { title: true },
            })
            await tx.notification.create({
              data: {
                userId: existing.userId,
                title: 'পুনরায় পরীক্ষার অনুমতি',
                message: `"${setInfo?.title || ''}" পরীক্ষাটি পুনরায় দেওয়ার অনুমতি দেওয়া হয়েছে। আপনি এখন আবার পরীক্ষা দিতে পারবেন।`,
                type: 'SUCCESS',
                link: null,
              },
            })
          } else {
            const setInfo = await tx.cQExamSet.findUnique({
              where: { id: existing.setId },
              select: { title: true },
            })
            await tx.notification.create({
              data: {
                userId: existing.userId,
                title: 'পুনরায় পরীক্ষার অনুরোধ প্রত্যাখ্যান',
                message: `"${setInfo?.title || ''}" পরীক্ষাটি পুনরায় দেওয়ার অনুরোধ প্রত্যাখ্যান করা হয়েছে।`,
                type: 'ERROR',
                link: null,
              },
            })
          }
        })

        await auditFromRequest(request, auth.user.id, approve ? AuditActions.CQ_EXAM_RETAKE_APPROVE : AuditActions.RETAKE_REJECT, 'retake_request', requestId, { status: existing.status }, { status: newStatus }, undefined)

        return apiResponse({ success: true, status: newStatus })
      }

      // Update non-CQ question (mcq-single, mcq-multiple, fill-blanks, written)
      case 'update-non-cq-question': {
        const { questionId, stem, stemImage, config, marks } = body
        if (!questionId) return apiError('Question ID required', 400)

        if (config !== undefined && (typeof config !== 'object' || config === null || Array.isArray(config))) {
          return apiError('Config must be a valid JSON object', 400)
        }

        const existing = await db.cQExamSetQuestion.findUnique({ where: { id: questionId } })

        const updateData: Record<string, unknown> = {}
        if (stem !== undefined) updateData.stem = stem || null
        if (stemImage !== undefined) updateData.stemImage = stemImage || null
        if (config !== undefined) updateData.config = config || {}
        if (marks !== undefined) updateData.marks = parseFloat(marks) || 0

        const question = await db.cQExamSetQuestion.update({
          where: { id: questionId },
          data: updateData,
        })

        const setQ = await db.cQExamSetQuestion.findFirst({ where: { id: questionId } })
        if (setQ) {
          await recalculateSetTotals(setQ.setId)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_QUESTION_UPDATE, 'cq_exam_set', setQ.setId, existing || undefined, question, undefined)
        }

        return apiResponse({ question })
      }

      // Update a typed question's content
      case 'update-typed-question': {
        const { questionId, typedUddeepok, typedUddeepokImage, typedQuestion1, typedQuestion1Image, typedQuestion2, typedQuestion2Image, typedQuestion3, typedQuestion3Image, typedQuestion4, typedQuestion4Image, subMarks } = body
        if (!questionId || !typedQuestion1) return apiError('Question ID and question 1 are required', 400)

        const marksArr: number[] = Array.isArray(subMarks) && subMarks.length === 4
          ? subMarks
          : [1, 2, 3, 4]
        const totalMarks = marksArr.reduce((a, b) => a + b, 0)

        const existing = await db.cQExamSetQuestion.findUnique({ where: { id: questionId } })

        const question = await db.cQExamSetQuestion.update({
          where: { id: questionId },
          data: {
            marks: totalMarks,
            subMarks: JSON.stringify(marksArr),
            typedUddeepok: typedUddeepok || null,
            typedUddeepokImage: typedUddeepokImage || null,
            typedQuestion1,
            typedQuestion1Image: typedQuestion1Image || null,
            typedQuestion2: typedQuestion2 || null,
            typedQuestion2Image: typedQuestion2Image || null,
            typedQuestion3: typedQuestion3 || null,
            typedQuestion3Image: typedQuestion3Image || null,
            typedQuestion4: typedQuestion4 || null,
            typedQuestion4Image: typedQuestion4Image || null,
          },
        })

        const setQ = await db.cQExamSetQuestion.findFirst({ where: { id: questionId } })
        if (setQ) {
          await recalculateSetTotals(setQ.setId)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_QUESTION_UPDATE, 'cq_exam_set', setQ.setId, existing || undefined, question, undefined)
        }

        return apiResponse({ question })
      }

      // Update marks for a question (works for both typed and CQ-bank questions)
      case 'update-question-marks': {
        const { questionId, marks } = body
        if (!questionId || marks === undefined) return apiError('Question ID and marks are required', 400)

        const existing = await db.cQExamSetQuestion.findUnique({ where: { id: questionId } })
        const question = await db.cQExamSetQuestion.update({
          where: { id: questionId },
          data: { marks: parseFloat(marks) || 0 },
        })

        const setQ = await db.cQExamSetQuestion.findFirst({ where: { id: questionId } })
        if (setQ) {
          await recalculateSetTotals(setQ.setId)
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_QUESTION_UPDATE, 'cq_exam_set', setQ.setId, existing ? { marks: existing.marks } : undefined, { marks: question.marks }, undefined)
        }

        return apiResponse({ question })
      }

      // Reopen grading — revert a graded submission back to submitted for re-editing (transactional)
      case 'reopen-grading': {
        const { submissionId } = body
        if (!submissionId) return apiError('Submission ID is required', 400)

        await db.$transaction(async (tx) => {
          const submission = await tx.cQExamSubmission.findUnique({
            where: { id: submissionId },
            select: { setId: true, status: true, obtainedMarks: true },
          })

          await tx.cQExamSubmission.update({
            where: { id: submissionId },
            data: { status: 'SUBMITTED', obtainedMarks: 0, gradedAt: null, gradedBy: null },
          })

          const answers = await tx.cQExamAnswer.findMany({
            where: { submissionId },
            select: { id: true },
          })
          if (answers.length > 0) {
            await Promise.all(
              answers.map(ans =>
                tx.cQExamAnswer.update({
                  where: { id: ans.id },
                  data: { obtainedMarks: 0, feedback: null, gradedAt: null },
                })
              )
            )
          }

          if (submission) {
            await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_GRADING_REOPEN, 'cq_exam_set', submission.setId, { status: submission.status, obtainedMarks: submission.obtainedMarks }, { status: 'SUBMITTED', obtainedMarks: 0 }, tx as never)
          }
        })

        return apiResponse({ success: true })
      }

      // Save annotation on image — validate JSON format
      case 'save-annotation': {
        const { imageId, annotations } = body
        if (!imageId) return apiError('Image ID is required', 400)
        if (annotations !== undefined && annotations !== null) {
          try { JSON.parse(typeof annotations === 'string' ? annotations : JSON.stringify(annotations)) }
          catch { return apiError('Invalid JSON format for annotations', 400) }
        }
        await db.cQExamAnswerImage.update({
          where: { id: imageId },
          data: { annotations: annotations !== undefined ? (typeof annotations === 'string' ? annotations : JSON.stringify(annotations)) : null },
        })
        return apiResponse({ success: true })
      }

      default:
        return apiError('Unknown action', 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin CQ Exam PUT error')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'delete-package': {
        const id = searchParams.get('id')
        if (!id) return apiError('Package ID is required', 400)
        const guard = await guardDeleteDependencies('cq-exam-packages', id)
        if (!guard.ok) return guard.response
        await db.$transaction(async (tx) => {
          await tx.cQExamPackage.update({
            where: { id },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_PACKAGE_DELETE, 'cq_exam_package', id, undefined, undefined, tx as never)
        })
        return apiResponse({ success: true })
      }

      case 'delete-set': {
        const id = searchParams.get('id')
        const packageId = searchParams.get('packageId')
        if (!id) return apiError('Set ID is required', 400)
        await db.$transaction(async (tx) => {
          await tx.cQExamSet.update({
            where: { id },
            data: { status: 'ARCHIVED' },
          })
          if (packageId) {
            const count = await tx.cQExamSet.count({ where: { packageId } })
            await tx.cQExamPackage.update({
              where: { id: packageId },
              data: { totalSets: count },
            })
          }
          await auditFromRequest(request, auth.user.id, AuditActions.CQ_EXAM_SET_DELETE, 'cq_exam_set', id, undefined, undefined, tx as never)
        })
        return apiResponse({ success: true })
      }

      default: {
        // Try body-based delete (legacy)
        let id: string | null = null
        try {
          const body = await request.json()
          id = body.id
        } catch { /* no body */ }
        if (!id) return apiError('ID is required', 400)
        await softDelete(db, 'cqExamPackage', id, auth.user.id)
        return apiResponse({ success: true })
      }
    }
  } catch (error) {
    return handleApiError(error, 'Admin CQ Exam DELETE error')
  }
}
