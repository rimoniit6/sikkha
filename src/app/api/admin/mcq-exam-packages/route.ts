import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import logger from '@/lib/logger'
import { toBengaliNumerals } from '@/lib/utils'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { auditFromRequest, AuditActions, EntityTypes, getClientIP } from '@/lib/audit'
import { createVersion } from '@/lib/version-history'

const createMcqPackageSchema = z.object({
  action: z.literal('create-package'),
  title: z.string().min(1, 'শিরোনাম আবশ্যক'),
  classId: z.string().min(1, 'শ্রেণি আবশ্যক'),
  description: z.string().optional(),
  subjectIds: z.array(z.string()).optional(),
  price: z.coerce.number().min(0).default(0),
  originalPrice: z.coerce.number().min(0).default(0),
  isPremium: z.boolean().default(true),
  thumbnail: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  order: z.coerce.number().min(0).default(0),
})

const createSetSchema = z.object({
  action: z.literal('create-set'),
  packageId: z.string().min(1, 'প্যাকেজ ID আবশ্যক'),
  title: z.string().min(1, 'শিরোনাম আবশ্যক'),
  description: z.string().optional(),
  scheduledDate: z.string().min(1, 'তারিখ আবশ্যক'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.coerce.number().int().positive().default(30),
  marksPerQ: z.coerce.number().min(0).default(1),
  negativeMarks: z.coerce.number().min(0).default(0),
  instructions: z.string().nullable().optional(),
  allowRetake: z.boolean().default(false),
  order: z.coerce.number().min(0).default(0),
  practiceMode: z.boolean().default(true),
  allowUnlimitedAttempts: z.boolean().default(true),
  maxAttempts: z.coerce.number().int().min(0).default(0),
  reviewAnswers: z.boolean().default(true),
  showExplanations: z.boolean().default(true),
})

const addQuestionsSchema = z.object({
  action: z.literal('add-questions'),
  setId: z.string().min(1, 'সেট ID আবশ্যক'),
  mcqIds: z.array(z.string()).min(1, 'MCQ IDs আবশ্যক'),
})

const bulkCreateSetsSchema = z.object({
  action: z.literal('bulk-create-sets'),
  packageId: z.string().min(1, 'প্যাকেজ ID আবশ্যক'),
  prefix: z.string().min(1, 'প্রিফিক্স আবশ্যক'),
  startDate: z.string().min(1, 'শুরুর তারিখ আবশ্যক'),
  intervalDays: z.coerce.number().int().positive().default(7),
  count: z.coerce.number().int().positive().default(10),
  duration: z.coerce.number().int().positive().default(30),
  marksPerQ: z.coerce.number().min(0).default(1),
  negativeMarks: z.coerce.number().min(0).default(0),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  practiceMode: z.boolean().default(true),
  allowUnlimitedAttempts: z.boolean().default(true),
  maxAttempts: z.coerce.number().int().min(0).default(0),
  reviewAnswers: z.boolean().default(true),
  showExplanations: z.boolean().default(true),
})

// Helper: recalculate totalQuestions and totalMarks for an exam set
// When called inside $transaction, pass the tx client so queries run on the
// same connection and see uncommitted writes from the transaction.
async function recalculateSetTotals(setId: string, client: any = db) {
  const questions = await client.mCQExamSetQuestion.findMany({
    where: { setId },
  })

  const totalQuestions = questions.length
  const totalMarks = questions.reduce((sum: number, q: { marks: number }) => sum + toDecimal(q.marks), 0)

  await client.mCQExamSet.update({
    where: { id: setId },
    data: { totalQuestions, totalMarks },
  })

  return { totalQuestions, totalMarks }
}

// Helper: recalculate totalSets for a package
async function recalculatePackageTotalSets(packageId: string) {
  const count = await db.mCQExamSet.count({
    where: { packageId },
  })

  await db.mCQExamPackage.update({
    where: { id: packageId },
    data: { totalSets: count },
  })

  return count
}

// ============================================================
// GET handler
// ============================================================
export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      // 1. List packages with pagination
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
          db.mCQExamPackage.findMany({
            where,
            include: {
              class: { select: { id: true, name: true, slug: true } },
              _count: { select: { examSets: true, purchases: true } },
              ...(includeSets ? { examSets: { select: { id: true, title: true, scheduledDate: true, startTime: true, endTime: true, practiceMode: true, allowUnlimitedAttempts: true, maxAttempts: true, reviewAnswers: true, showExplanations: true }, orderBy: { scheduledDate: 'asc' } } } : {}),
            },
            orderBy: { order: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.mCQExamPackage.count({ where }),
        ])

        return apiResponse({
          packages,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      }

      // 2. Get single package detail
      case 'detail': {
        const id = searchParams.get('id')
        if (!id) return apiError('Package ID is required', 400)

        const pkg = await db.mCQExamPackage.findUnique({
          where: { id },
          include: {
            class: { select: { id: true, name: true, slug: true } },
            examSets: {
              orderBy: { scheduledDate: 'asc' },
              include: {
                _count: { select: { questions: true, results: true } },
              },
            },
            _count: { select: { purchases: true } },
          },
        })

        if (!pkg) return apiError('Package not found', 404)
        return apiResponse({ package: pkg })
      }

      // 3. Get single exam set detail with questions
      case 'set-detail': {
        const setId = searchParams.get('setId')
        if (!setId) return apiError('Set ID is required', 400)

        const examSet = await db.mCQExamSet.findUnique({
          where: { id: setId },
          include: {
            package: { select: { id: true, title: true } },
            questions: {
              orderBy: { order: 'asc' },
              include: {
                mcq: {
                  select: {
                    id: true,
                    question: true,
                    optionA: true,
                    optionB: true,
                    optionC: true,
                    optionD: true,
                    correctAnswer: true,
                    questionImage: true,
                    optionAImage: true,
                    optionBImage: true,
                    optionCImage: true,
                    optionDImage: true,
                    explanation: true,
                    difficulty: true,
                    classLevel: true,
                    subjectId: true,
                    chapterId: true,
                  },
                },
              },
            },
            _count: { select: { results: true } },
          },
        })

        if (!examSet) return apiError('Exam set not found', 404)
        return apiResponse({ set: examSet })
      }

      // 4. Get results for an exam set
      case 'results': {
        const setId = searchParams.get('setId')
        if (!setId) return apiError('Set ID is required', 400)

        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const skip = (page - 1) * limit

        const [results, total] = await Promise.all([
          db.mCQExamSetResult.findMany({
            where: { setId },
            skip,
            take: limit,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  classLevel: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          }),
          db.mCQExamSetResult.count({ where: { setId } }),
        ])

        return apiResponse({ results, total, page, limit, totalPages: Math.ceil(total / limit) })
      }

      // 5. Search MCQs for adding to a set
      case 'search-mcqs': {
        const classLevel = searchParams.get('classLevel') || ''
        const subjectId = searchParams.get('subjectId') || ''
        const chapterId = searchParams.get('chapterId') || ''
        const search = searchParams.get('search') || ''
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')

        const where: Prisma.MCQWhereInput = {
          isActive: true,
        }

        if (classLevel) where.classLevel = classLevel
        if (subjectId) where.subjectId = subjectId
        if (chapterId) where.chapterId = chapterId
        if (search) {
          where.OR = [
            { question: { contains: search, mode: 'insensitive' } },
            { explanation: { contains: search, mode: 'insensitive' } },
            { tags: { contains: search, mode: 'insensitive' } },
          ]
        }

        const [mcqs, total] = await Promise.all([
          db.mCQ.findMany({
            where,
            include: {
              chapter: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.mCQ.count({ where }),
        ])

        // Enrich with subject names
        const uniqueSubjectIds = [...new Set(mcqs.map(m => m.subjectId))]
        const subjects = await db.subject.findMany({
          where: { id: { in: uniqueSubjectIds } },
          select: { id: true, name: true },
        })
        const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]))

        const enrichedMcqs = mcqs.map(m => ({
          ...m,
          subjectName: subjectMap[m.subjectId] || null,
        }))

        return apiResponse({
          mcqs: enrichedMcqs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      }

      // 6. List retake requests for a set (read operation)
      case 'list-retake-requests': {
        const setId = searchParams.get('setId')
        if (!setId) return apiError('Set ID is required', 400)

        const requests = await db.mCQExamRetakeRequest.findMany({
          where: { setId },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true, classLevel: true } },
            set: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
        })

        return apiResponse({ requests })
      }

      // 7. Leaderboard for a specific exam set
      case 'leaderboard': {
        const setId = searchParams.get('setId')
        if (!setId) return apiError('Set ID is required', 400)

        // Validate set exists
        const setExists = await db.mCQExamSet.findUnique({ where: { id: setId } })
        if (!setExists) return apiError('Exam set not found', 404)

        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const skip = (page - 1) * limit

        const [results, total] = await Promise.all([
          db.mCQExamSetResult.findMany({
            where: { setId, status: 'COMPLETED' },
            skip,
            take: limit,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  classLevel: true,
                },
              },
            },
            orderBy: { marksObtained: 'desc' },
          }),
          db.mCQExamSetResult.count({ where: { setId, status: 'COMPLETED' } }),
        ])

        return apiResponse({ leaderboard: results, total, page, limit, totalPages: Math.ceil(total / limit) })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin MCQ Exam Package GET')
  }
}

// ============================================================
// POST handler
// ============================================================
export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
    const { action } = body

    switch (action) {
      // 6. Create a new package
      case 'create-package': {
        const validation = validateBody(createMcqPackageSchema, body)
        if ('error' in validation) return validation.error
        const {
          title,
          description,
          classId,
          subjectIds,
          price,
          originalPrice,
          isPremium,
          thumbnail,
          isActive,
          order,
        } = validation.data

        // Validate class exists
        const classExists = await db.classCategory.findUnique({ where: { id: classId } })
        if (!classExists) return apiError('Class not found', 400)

        // Check for duplicate title within the same class
        const duplicateTitle = await db.mCQExamPackage.findFirst({
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
          const created = await tx.mCQExamPackage.create({
            data: {
              title,
              description: description || null,
              classId,
              subjectIds: subjectIds ? JSON.stringify(subjectIds) : '[]',
              price: price ?? 0,
              originalPrice: originalPrice ?? 0,
              isPremium: isPremium ?? deriveIsPremium(price),
              thumbnail: thumbnail || null,
              isActive: isActive ?? true,
              order: order ?? 0,
            },
            include: {
              class: { select: { id: true, name: true, slug: true } },
              _count: { select: { examSets: true, purchases: true } },
            },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_PACKAGE_CREATE, EntityTypes.MCQ_EXAM_PACKAGE, created.id, body, { title: created.title }, tx as never)
          return created
        })

        return apiResponse({ package: pkg }, 201)
      }

      // 9. Create an exam set within a package (transactional)
      case 'create-set': {
        const validation = validateBody(createSetSchema, body)
        if ('error' in validation) return validation.error
        const {
          packageId,
          title,
          description,
          scheduledDate,
          startTime,
          endTime,
          duration,
          marksPerQ,
          negativeMarks,
          instructions,
          allowRetake,
          order,
        } = validation.data

        // Validate package exists
        const pkgExists = await db.mCQExamPackage.findUnique({ where: { id: packageId } })
        if (!pkgExists) return apiError('Package not found', 404)

        const examSet = await db.$transaction(async (tx) => {
          const created = await tx.mCQExamSet.create({
            data: {
              packageId,
              title,
              description: description || null,
              scheduledDate: new Date(scheduledDate),
              startTime: startTime || '00:00',
              endTime: endTime || '23:59',
              duration: duration ?? 30,
              marksPerQ: marksPerQ ?? 1,
              negativeMarks: negativeMarks ?? 0,
              totalMarks: 0,
              totalQuestions: 0,
              instructions: instructions || null,
              allowRetake: allowRetake ?? false,
              order: order ?? 0,
              practiceMode: validation.data.practiceMode ?? true,
              allowUnlimitedAttempts: validation.data.allowUnlimitedAttempts ?? true,
              maxAttempts: validation.data.maxAttempts ?? 0,
              reviewAnswers: validation.data.reviewAnswers ?? true,
              showExplanations: validation.data.showExplanations ?? true,
            },
            include: { _count: { select: { questions: true, results: true } } },
          })

          // Update package totalSets + audit atomically
          const count = await tx.mCQExamSet.count({ where: { packageId } })
          await tx.mCQExamPackage.update({
            where: { id: packageId },
            data: { totalSets: count },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_CREATE, EntityTypes.MCQ_EXAM_SET, created.id, body, { title: created.title }, tx as never)

          return created
        })

        return apiResponse({ set: examSet }, 201)
      }

      // 12. Add MCQs to an exam set (transactional)
      case 'add-questions': {
        const validation = validateBody(addQuestionsSchema, body)
        if ('error' in validation) return validation.error
        const { setId, mcqIds } = validation.data

        const examSet = await db.mCQExamSet.findUnique({ where: { id: setId } })
        if (!examSet) return apiError('Exam set not found', 404)

        const mcqs = await db.mCQ.findMany({
          where: { id: { in: mcqIds } },
          select: { id: true },
        })
        const foundMcqIds = new Set(mcqs.map(m => m.id))
        const notFoundIds = mcqIds.filter((id: string) => !foundMcqIds.has(id))
        if (notFoundIds.length > 0) return apiError(`MCQs not found: ${notFoundIds.join(', ')}`, 400)

        const existingQuestions = await db.mCQExamSetQuestion.findMany({
          where: { setId },
          select: { mcqId: true },
        })
        const existingMcqIds = new Set(existingQuestions.map(q => q.mcqId))
        const newMcqIds = mcqIds.filter((id: string) => !existingMcqIds.has(id))

        if (newMcqIds.length === 0) return apiError('All provided MCQs already exist', 400)

        const maxOrderResult = await db.mCQExamSetQuestion.findFirst({
          where: { setId },
          orderBy: { order: 'desc' },
          select: { order: true },
        })
        const startOrder = (maxOrderResult?.order ?? -1) + 1

        // Atomic: create questions + recalculate totals + audit in one transaction
        await db.$transaction(async (tx) => {
          await tx.mCQExamSetQuestion.createMany({
            data: newMcqIds.map((mcqId: string, index: number) => ({
              setId,
              mcqId,
              marks: examSet.marksPerQ,
              order: startOrder + index,
            })),
          })

          await recalculateSetTotals(setId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_QUESTIONS_ADD, EntityTypes.MCQ_EXAM_SET, setId, undefined, { mcqIds: newMcqIds, count: newMcqIds.length }, tx as never)
        })

        const updatedSet = await db.mCQExamSet.findUnique({
          where: { id: setId },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                mcq: {
                  select: {
                    id: true,
                    question: true,
                    optionA: true,
                    optionB: true,
                    optionC: true,
                    optionD: true,
                    correctAnswer: true,
                  },
                },
              },
            },
          },
        })

        return apiResponse({ set: updatedSet })
      }

      case 'bulk-create-sets': {
        const validation = validateBody(bulkCreateSetsSchema, body)
        if ('error' in validation) return validation.error
        const {
          packageId,
          prefix,
          startDate,
          intervalDays,
          count,
          duration,
          marksPerQ,
          negativeMarks,
          startTime,
          endTime,
          practiceMode,
          allowUnlimitedAttempts,
          maxAttempts,
          reviewAnswers,
          showExplanations,
        } = validation.data

        const pkgExists = await db.mCQExamPackage.findUnique({ where: { id: packageId } })
        if (!pkgExists) return apiError('Package not found', 404)

        const setCount = count ?? 10
        const interval = intervalDays ?? 7
        const setDuration = duration ?? 30
        const setMarksPerQ = marksPerQ ?? 1
        const setNegativeMarks = negativeMarks ?? 0
        const setStartTime = startTime ?? '00:00'
        const setEndTime = endTime ?? '23:59'

        const maxOrderResult = await db.mCQExamSet.findFirst({
          where: { packageId },
          orderBy: { order: 'desc' },
          select: { order: true },
        })
        const startOrder = (maxOrderResult?.order ?? -1) + 1

        const baseDate = new Date(startDate)

        // Atomic: create all sets + update package total in a single transaction
        const createdSets: any[] = []
        await db.$transaction(async (tx) => {
          for (let i = 0; i < setCount; i++) {
            const scheduledDate = new Date(baseDate)
            scheduledDate.setDate(scheduledDate.getDate() + i * interval)
            const title = `${prefix} ${toBengaliNumerals(i + 1)}`

            const examSet = await tx.mCQExamSet.create({
              data: {
                packageId,
                title,
                scheduledDate,
                startTime: setStartTime,
                endTime: setEndTime,
                duration: setDuration,
                marksPerQ: setMarksPerQ,
                negativeMarks: setNegativeMarks,
                totalMarks: 0,
                totalQuestions: 0,
                order: startOrder + i,
                practiceMode: practiceMode ?? true,
                allowUnlimitedAttempts: allowUnlimitedAttempts ?? true,
                maxAttempts: maxAttempts ?? 0,
                reviewAnswers: reviewAnswers ?? true,
                showExplanations: showExplanations ?? true,
              },
            })
            createdSets.push(examSet)
          }

          // Update package totalSets inside the transaction
          const count = await tx.mCQExamSet.count({ where: { packageId } })
          await tx.mCQExamPackage.update({
            where: { id: packageId },
            data: { totalSets: count },
          })

          // Audit log inside the transaction
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_CREATE, EntityTypes.MCQ_EXAM_SET, packageId, undefined, { count: createdSets.length, prefix, startDate }, tx as never)
        }, {
          maxWait: 10000,
          timeout: 30000,
        })

        return apiResponse({ sets: createdSets, count: createdSets.length }, 201)
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(`[MCQ Exam Package POST] Prisma error ${error.code}: ${error.message}`, error, {
        context: `action: ${body?.action ?? 'unknown'}, prismaCode: ${error.code}`,
      })
    }
    return handleApiError(error, 'Admin MCQ Exam Package POST')
  }
}

// ============================================================
// PUT handler
// ============================================================
export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'update-package': {
        const { id, ...updateData } = body
        if (!id) return apiError('Package ID is required', 400)

        const existing = await db.mCQExamPackage.findUnique({ where: { id } })
        if (!existing) return apiError('Package not found', 404)

        // Check if package is soft-deleted
        if (existing.deletedAt) return apiError('এই প্যাকেজটি মুছে ফেলা হয়েছে। এটি সম্পাদনা করা যাবে না।', 400, 'PACKAGE_DELETED')

        const data: Record<string, unknown> = {}
        const allowedFields = [
          'title', 'description', 'classId', 'price', 'originalPrice',
          'isPremium', 'thumbnail', 'totalSets', 'status', 'isActive', 'order',
        ]

        for (const field of allowedFields) {
          if (updateData[field] !== undefined) data[field] = updateData[field]
        }

        if (updateData.status && typeof updateData.status === 'string') {
          updateData.status = updateData.status.toUpperCase()
          data.status = updateData.status
        }

        // Validate status transitions
        if (data.status !== undefined && data.status !== existing.status) {
          const validTransitions: Record<string, string[]> = {
            DRAFT: ['PUBLISHED', 'ARCHIVED'],
            PUBLISHED: ['ARCHIVED'],
            ARCHIVED: ['DRAFT', 'PUBLISHED'],
          }
          const allowed = validTransitions[existing.status] || []
          if (!allowed.includes(data.status as string)) {
            return apiError(
              `বর্তমান স্ট্যাটাস "${existing.status}" থেকে "${data.status}"-এ পরিবর্তন অনুমোদিত নয়।`,
              400,
              'INVALID_STATUS_TRANSITION'
            )
          }
        }

        // Check for duplicate title within the same class
        if (data.title && typeof data.title === 'string' && data.title !== existing.title) {
          const classIdCheck = data.classId || existing.classId
          const duplicate = await db.mCQExamPackage.findFirst({
            where: {
              title: data.title as string,
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

        if (updateData.subjectIds !== undefined)       data.subjectIds = JSON.stringify(updateData.subjectIds)

        // Derive isPremium from price if price is being changed and isPremium not explicitly set
        if (updateData.price !== undefined && updateData.isPremium === undefined) {
          data.isPremium = deriveIsPremium(updateData.price)
        }
        if (updateData.isPremium !== undefined) {
          data.isPremium = updateData.isPremium
        }

        // Validate classId exists if changed
        if (data.classId && data.classId !== existing.classId) {
          const classExists = await db.classCategory.findUnique({ where: { id: data.classId as string } })
          if (!classExists) return apiError('নির্বাচিত শ্রেণিটি খুঁজে পাওয়া যায়নি।', 400, 'CLASS_NOT_FOUND')
        }

        const ipAddress = getClientIP(request)
        const userAgent = request.headers.get('user-agent') || undefined

        const changedFields = Object.keys(data).filter(
          key => JSON.stringify(data[key]) !== JSON.stringify(existing[key as keyof typeof existing])
        )

        const updated = await db.$transaction(async (tx) => {
          await createVersion(tx, 'mCQExamPackage', id, { ...existing }, auth.user.id, changedFields, {
            ipAddress, userAgent,
          })
          const result = await tx.mCQExamPackage.update({
            where: { id },
            data,
            include: {
              class: { select: { id: true, name: true, slug: true } },
              _count: { select: { examSets: true, purchases: true } },
            },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_PACKAGE_UPDATE, EntityTypes.MCQ_EXAM_PACKAGE, id, existing, data, tx as never)
          return result
        }, { maxWait: 10000, timeout: 30000 })

        return apiResponse({ package: updated })
      }

      case 'update-set': {
        const { id, ...updateData } = body
        if (!id) return apiError('Set ID is required', 400)

        const existing = await db.mCQExamSet.findUnique({ where: { id } })
        if (!existing) return apiError('Exam set not found', 404)

        const data: Record<string, unknown> = {}
        const allowedFields = [
          'title', 'description', 'startTime', 'endTime',
          'duration', 'marksPerQ', 'negativeMarks', 'instructions',
          'status', 'order', 'allowRetake',
          'practiceMode', 'allowUnlimitedAttempts', 'maxAttempts',
          'reviewAnswers', 'showExplanations',
        ]

        for (const field of allowedFields) {
          if (updateData[field] !== undefined) data[field] = updateData[field]
        }

        if (updateData.status && typeof updateData.status === 'string') {
          updateData.status = updateData.status.toUpperCase()
          data.status = updateData.status
        }

        // Validate status transitions for sets
        if (data.status !== undefined && data.status !== existing.status) {
          const validTransitions: Record<string, string[]> = {
            DRAFT: ['PUBLISHED', 'ARCHIVED'],
            PUBLISHED: ['ARCHIVED'],
            ARCHIVED: ['DRAFT'],
          }
          const allowed = validTransitions[existing.status] || []
          if (!allowed.includes(data.status as string)) {
            return apiError(
              `বর্তমান স্ট্যাটাস "${existing.status}" থেকে "${data.status}"-এ পরিবর্তন অনুমোদিত নয়।`,
              400,
              'INVALID_STATUS_TRANSITION'
            )
          }
        }

        // Check for duplicate set title within the same package
        if (data.title && typeof data.title === 'string' && data.title !== existing.title) {
          const duplicate = await db.mCQExamSet.findFirst({
            where: {
              title: data.title as string,
              packageId: existing.packageId,
              id: { not: id },
            },
            select: { id: true },
          })
          if (duplicate) {
            return apiError('এই প্যাকেজে একই নামের একটি এক্সাম সেট ইতিমধ্যে বিদ্যমান।', 409, 'SET_NAME_EXISTS')
          }
        }

        if (updateData.scheduledDate !== undefined) data.scheduledDate = new Date(updateData.scheduledDate)

        // Atomic: update marks + set metadata + recalculate + audit in one transaction
        await db.$transaction(async (tx) => {
          if (updateData.marksPerQ !== undefined) {
            await tx.mCQExamSetQuestion.updateMany({
              where: { setId: id },
              data: { marks: updateData.marksPerQ },
            })
          }

          await tx.mCQExamSet.update({ where: { id }, data: data as never })
          await recalculateSetTotals(id, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_UPDATE, EntityTypes.MCQ_EXAM_SET, id, existing, data, tx as never)
        })

        const refreshedSet = await db.mCQExamSet.findUnique({
          where: { id },
          include: { _count: { select: { questions: true, results: true } } },
        })
        return apiResponse({ set: refreshedSet })
      }

      case 'reorder-questions': {
        const { setId, questionOrders } = body
        if (!setId || !questionOrders || !Array.isArray(questionOrders)) return apiError('SetId and questionOrders array required', 400)

        await db.$transaction(
          questionOrders.map((item: { id: string; order: number }) =>
            db.mCQExamSetQuestion.update({
              where: { id: item.id },
              data: { order: item.order },
            })
          )
        )
        return apiResponse({ message: 'Questions reordered' })
      }

      case 'update-total-sets': {
        const { packageId } = body
        if (!packageId) return apiError('PackageId is required', 400)
        const count = await recalculatePackageTotalSets(packageId)
        return apiResponse({ totalSets: count })
      }

      // Allow retake for a specific user's result (toggle)
      case 'allow-retake': {
        const { resultId } = body
        if (!resultId) return apiError('Result ID is required', 400)

        const result = await db.mCQExamSetResult.findUnique({
          where: { id: resultId },
          select: { canRetake: true, userId: true, setId: true },
        })
        if (!result) return apiError('Result not found', 404)

        const newCanRetake = !result.canRetake

        const updated = await db.$transaction(async (tx) => {
          const res = await tx.mCQExamSetResult.update({
            where: { id: resultId },
            data: { canRetake: newCanRetake },
          })
          // Audit log — use the correct constant
          const auditAction = newCanRetake ? AuditActions.RETAKE_APPROVE : AuditActions.RETAKE_REJECT
          await auditFromRequest(request, auth.user.id, auditAction, 'mcq_exam_set', result.setId, { resultId, previousCanRetake: result.canRetake }, { canRetake: newCanRetake }, tx as never)
          return res
        })

        return apiResponse({ canRetake: updated.canRetake })
      }

      // Approve or reject retake request
      case 'approve-retake-request': {
        const { requestId, approve } = body
        if (!requestId) return apiError('Request ID is required', 400)

        const existing = await db.mCQExamRetakeRequest.findUnique({
          where: { id: requestId },
        })
        if (!existing) return apiError('Request not found', 404)

        const newStatus = approve ? 'APPROVED' : 'REJECTED'

        await db.$transaction(async (tx) => {
          await tx.mCQExamRetakeRequest.update({
            where: { id: requestId },
            data: {
              status: newStatus,
              reviewedBy: auth?.user?.id || null,
              reviewedAt: new Date(),
            },
          })
          await auditFromRequest(request, auth.user.id, 'mcq_exam_retake_approve' as never, EntityTypes.MCQ_EXAM_SET, existing.setId, { requestId, previousStatus: existing.status }, { status: newStatus, approved: approve }, tx as never)
        })

        // If approved, set canRetake on the user's result
        if (approve) {
          const result = await db.mCQExamSetResult.findFirst({
            where: { userId: existing.userId, setId: existing.setId },
            orderBy: { attemptNumber: 'desc' },
          })
          if (result) {
            await db.mCQExamSetResult.update({
              where: { id: result.id },
              data: { canRetake: true },
            })
          }

          // Notify the student
          const setInfo = await db.mCQExamSet.findUnique({
            where: { id: existing.setId },
            select: { title: true },
          })
          await db.notification.create({
            data: {
              userId: existing.userId,
              title: 'পুনরায় পরীক্ষার অনুমতি',
              message: `"${setInfo?.title || ''}" পরীক্ষাটি পুনরায় দেওয়ার অনুমতি দেওয়া হয়েছে। আপনি এখন আবার পরীক্ষা দিতে পারবেন।`,
              type: 'SUCCESS',
              link: null,
            },
          })
        } else {
          const setInfo = await db.mCQExamSet.findUnique({
            where: { id: existing.setId },
            select: { title: true },
          })
          await db.notification.create({
            data: {
              userId: existing.userId,
              title: 'পুনরায় পরীক্ষার অনুরোধ প্রত্যাখ্যান',
              message: `"${setInfo?.title || ''}" পরীক্ষাটি পুনরায় দেওয়ার অনুরোধ প্রত্যাখ্যান করা হয়েছে।`,
              type: 'ERROR',
              link: null,
            },
          })
        }

        return apiResponse({ success: true, status: newStatus })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin MCQ Exam Package PUT')
  }
}

// ============================================================
// DELETE handler
// ============================================================
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
        if (!id) return apiError('Package ID required', 400)
        const guard = await guardDeleteDependencies('mcq-exam-packages', id)
        if (!guard.ok) return guard.response
        await db.$transaction(async (tx) => {
          await tx.mCQExamPackage.update({
            where: { id },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_PACKAGE_DELETE, EntityTypes.MCQ_EXAM_PACKAGE, id, undefined, undefined, tx as never)
        })
        return apiResponse({ message: 'Package deleted' })
      }

      case 'delete-set': {
        const id = searchParams.get('id')
        if (!id) return apiError('Set ID required', 400)
        const existing = await db.mCQExamSet.findUnique({ where: { id } })
        if (!existing) return apiError('Set not found', 404)

        const packageId = existing.packageId
        await db.$transaction(async (tx) => {
          await tx.mCQExamSet.update({
            where: { id },
            data: { status: 'ARCHIVED' },
          })
          const count = await tx.mCQExamSet.count({
            where: { packageId, status: { not: 'ARCHIVED' } },
          })
          await tx.mCQExamPackage.update({
            where: { id: packageId },
            data: { totalSets: count },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_DELETE, EntityTypes.MCQ_EXAM_SET, id, undefined, { status: 'ARCHIVED' }, tx as never)
        })
        return apiResponse({ message: 'Set archived' })
      }

      case 'remove-question': {
        const setId = searchParams.get('setId')
        const mcqId = searchParams.get('mcqId')
        if (!setId || !mcqId) return apiError('SetId and mcqId required', 400)

        const question = await db.mCQExamSetQuestion.findUnique({
          where: { setId_mcqId: { setId, mcqId } },
        })
        if (!question) return apiError('Question not found in set', 404)

        await db.$transaction(async (tx) => {
          await tx.mCQExamSetQuestion.delete({ where: { id: question.id } })
          await recalculateSetTotals(setId, tx)
          await auditFromRequest(request, auth.user.id, AuditActions.MCQ_EXAM_SET_QUESTIONS_REMOVE, EntityTypes.MCQ_EXAM_SET, setId, undefined, { mcqId }, tx as never)
        })
        return apiResponse({ message: 'Question removed' })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin MCQ Exam Package DELETE')
  }
}
