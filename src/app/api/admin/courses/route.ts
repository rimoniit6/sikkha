import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { auditFromRequest, AuditActions, getClientIP } from '@/lib/audit'
import { handleApiError } from '@/lib/errors'
import { deriveIsPremium } from '@/lib/premium'
import { NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import { z } from 'zod'
import { guardDeleteDependencies } from '@/lib/delete-guard'
import { transitionWorkflow } from '@/lib/workflow'
import { findSlugConflict, generateUniqueSlug } from '@/lib/slug-unique'

const COURSE_STATUSES = ['DRAFT', 'PUBLISHED'] as const

const courseSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    slug: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    classId: z.string().optional(),
    subjectId: z.string().optional(),
    isPremium: z.boolean().optional(),
    price: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    thumbnail: z.string().optional(),
    teacherName: z.string().optional(),
    features: z.string().optional(),
    requirements: z.string().optional(),
    targetStudents: z.string().optional(),
    hasCertificate: z.boolean().optional(),
    duration: z.number().int().min(0).optional(),
    language: z.string().optional(),
    difficulty: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
  })
  .passthrough()

function normalizeStatus(raw?: string): string {
  const s = (raw || 'DRAFT').toUpperCase()
  return COURSE_STATUSES.includes(s as any) ? s : 'DRAFT'
}

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'list': {
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const search = searchParams.get('search') || ''
        const status = searchParams.get('status') || ''
        const classId = searchParams.get('classId') || ''

        const where: Record<string, unknown> = {}
        if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }]
        if (status) where.status = status.toUpperCase()
        if (classId) where.classId = classId

        const [courses, total] = await Promise.all([
          db.course.findMany({
            where,
            include: {
              classCategory: { select: { id: true, name: true, slug: true } },
              subject: { select: { id: true, name: true, slug: true } },
              _count: { select: { lessons: true, purchases: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.course.count({ where }),
        ])

        return apiResponse({ courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
      }

      case 'detail': {
        const id = searchParams.get('id')
        if (!id) return apiError('Course ID required', 400)

        const course = await db.course.findUnique({
          where: { id },
          include: {
            classCategory: { select: { id: true, name: true, slug: true } },
            subject: { select: { id: true, name: true, slug: true } },
            lessons: {
              orderBy: { displayOrder: 'asc' },
              include: {
                exams: { orderBy: { displayOrder: 'asc' } },
                assignments: { orderBy: { displayOrder: 'asc' } },
                schedules: true,
                notes: { orderBy: { displayOrder: 'asc' } },
                resources: { orderBy: { displayOrder: 'asc' } },
              },
            },
            _count: { select: { purchases: true, lessons: true, certificates: true } },
          },
        })

        if (!course) return apiError('Course not found', 404)
        return apiResponse({ course })
      }

      case 'students': {
        const id = searchParams.get('id')
        if (!id) return apiError('Course ID required', 400)
        const [purchases, enrollments] = await Promise.all([
          db.coursePurchase.findMany({
            where: { courseId: id, isActive: true },
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { purchasedAt: 'desc' },
          }),
          db.courseEnrollment.findMany({
            where: { courseId: id, status: 'ACTIVE' },
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { enrolledAt: 'desc' },
          }),
        ])
        const seen = new Set<string>()
        const students = [
          ...purchases.map(p => ({ id: p.id, user: p.user, enrolledAt: p.purchasedAt, source: 'purchase', isActive: true })),
          ...enrollments.map(e => ({ id: e.id, user: e.user, enrolledAt: e.enrolledAt, source: e.type === 'FREE' ? 'free_enroll' : 'enrollment', isActive: true })),
        ].filter(s => {
          if (seen.has(s.user.id)) return false
          seen.add(s.user.id)
          return true
        })
        return apiResponse({ students })
      }

      case 'syllabus': {
        const id = searchParams.get('id')
        if (!id) return apiError('Course ID required', 400)
        const course = await db.course.findUnique({
          where: { id },
          include: {
            lessons: {
              orderBy: { displayOrder: 'asc' },
              include: {
                assignments: true,
                schedules: true,
                notes: true,
              },
            },
            examSchedules: true,
          },
        })
        if (!course) return apiError('Course not found', 404)

        const mcqPackageIds = [...new Set(course.examSchedules.filter(e => e.examType === 'MCQ').map(e => e.packageId))]
        const cqPackageIds = [...new Set(course.examSchedules.filter(e => e.examType === 'CQ').map(e => e.packageId))]
        const [mcqPackages, cqPackages] = await Promise.all([
          mcqPackageIds.length ? db.mCQExamPackage.findMany({ where: { id: { in: mcqPackageIds } }, select: { id: true, title: true } }) : [],
          cqPackageIds.length ? db.cQExamPackage.findMany({ where: { id: { in: cqPackageIds } }, select: { id: true, title: true } }) : [],
        ])
        const mcqPackageMap = new Map(mcqPackages.map(p => [p.id, p.title]))
        const cqPackageMap = new Map(cqPackages.map(p => [p.id, p.title]))

        const rows = course.lessons.map(l => {
          const schedule = l.schedules?.[0]
          const dayOfWeek = schedule?.date ? new Date(schedule.date).getDay() : null
          return {
            contentId: l.id,
            title: l.title,
            lessonType: l.lessonType,
            dayOfWeek,
            date: schedule?.date?.toISOString() ?? null,
            startTime: schedule?.startTime || null,
            endTime: schedule?.endTime || null,
            mcqExams: [],
            cqExams: [],
            hasAssignments: l.assignments.length > 0,
            displayOrder: l.displayOrder,
          }
        })

        const packageMap = new Map([...mcqPackageMap.entries(), ...cqPackageMap.entries()])

        const examCalendar = course.examSchedules
          .map(es => ({
            id: es.id,
            type: es.examType as 'MCQ' | 'CQ',
            examType: es.examType as 'MCQ' | 'CQ',
            packageId: es.packageId,
            packageName: packageMap.get(es.packageId) || null,
            examDate: es.examDate.toISOString(),
            scheduledDate: es.examDate.toISOString(),
            startTime: es.startTime,
            endTime: es.endTime,
            autoFilledFromPackage: es.autoFilledFromPackage,
            overrideAllowed: es.overrideAllowed,
          }))
          .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

        const summary = {
          totalLessons: course.lessons.length,
          totalLiveClasses: course.lessons.filter(l => l.lessonType === 'LIVE').length,
          totalRecordedClasses: course.lessons.filter(l => l.lessonType === 'RECORDED').length,
          totalMcqExams: course.examSchedules.filter(e => e.examType === 'MCQ').length,
          totalCqExams: course.examSchedules.filter(e => e.examType === 'CQ').length,
          totalAssignments: course.lessons.reduce((acc, l) => acc + l.assignments.length, 0),
          totalNotes: course.lessons.reduce((acc, l) => acc + l.notes.length, 0),
          totalResources: 0,
          teacherName: course.teacherName,
        }
        return apiResponse({ summary, rows, examCalendar })
      }

      case 'analytics': {
        const id = searchParams.get('id')
        if (!id) return apiError('Course ID required', 400)
        const [purchaseCount, enrollmentCount, lessons, revenueResult] = await Promise.all([
          db.coursePurchase.count({ where: { courseId: id, isActive: true } }),
          db.courseEnrollment.count({ where: { courseId: id, status: 'ACTIVE' } }),
          db.courseLesson.findMany({
            where: { courseId: id },
            select: { lessonType: true, _count: { select: { exams: true, assignments: true, notes: true } } },
          }),
          db.coursePurchase.findMany({
            where: { courseId: id, isActive: true, paymentId: { not: null } },
            select: { paymentId: true },
          }),
        ])

        const paymentIds = revenueResult.map(r => r.paymentId).filter((id): id is string => id !== null)
        let revenue = 0
        if (paymentIds.length > 0) {
          const payments = await           db.payment.findMany({
            where: { id: { in: paymentIds }, status: 'APPROVED' },
            select: { amount: true },
          })
          revenue = payments.reduce((sum, p) => sum + toDecimal(p.amount || 0), 0)
        }

        const totalLessons = lessons.length
        const liveClasses = lessons.filter(l => l.lessonType === 'LIVE').length
        const recordedClasses = lessons.filter(l => l.lessonType === 'RECORDED').length
        const totalExams = lessons.reduce((acc, l) => acc + l._count.exams, 0)
        const totalAssignments = lessons.reduce((acc, l) => acc + l._count.assignments, 0)

        const contentByType: Record<string, number> = {
          'লাইভ ক্লাস': liveClasses,
          'রেকর্ডেড ক্লাস': recordedClasses,
          'পরীক্ষা': totalExams,
          'অ্যাসাইনমেন্ট': totalAssignments,
        }

        return apiResponse({
          stats: {
            totalEnrollments: purchaseCount + enrollmentCount,
            revenue,
            contentCount: totalLessons + totalExams + totalAssignments,
            contentByType,
            totalLessons,
            liveClasses,
            recordedClasses,
            totalExams,
            totalAssignments,
          },
        })
      }

      case 'student-progress': {
        const courseId = searchParams.get('courseId')
        const userId = searchParams.get('userId')
        if (!courseId || !userId) return apiError('courseId and userId required', 400)
        const [user, enrollment, progressRecords, lessons, purchase, lessonExams, examSchedules] = await Promise.all([
          db.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, avatar: true, phone: true },
          }),
          db.courseEnrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
          }),
          db.lessonProgress.findMany({
            where: { userId, courseId },
            select: { lessonId: true, completed: true, completedAt: true },
          }),
          db.courseLesson.findMany({
            where: { courseId },
            select: { id: true, title: true, lessonType: true, displayOrder: true, _count: { select: { exams: true, assignments: true, notes: true } } },
            orderBy: { displayOrder: 'asc' },
          }),
          db.coursePurchase.findFirst({
            where: { userId, courseId, isActive: true },
            select: { purchasedAt: true, isActive: true },
          }),
          db.lessonExam.findMany({
            where: { lesson: { courseId } },
            select: { packageId: true, examType: true },
          }),
          db.courseExamSchedule.findMany({
            where: { courseId },
            select: { packageId: true, examType: true },
          }),
        ])
        if (!user) return apiError('User not found', 404)
        const completedSet = new Set(progressRecords.filter(p => p.completed).map(p => p.lessonId))
        const progress = lessons.map(l => ({
          contentId: l.id,
          title: l.title,
          contentType: l.lessonType,
          displayOrder: l.displayOrder,
          completed: completedSet.has(l.id),
          completedAt: progressRecords.find(p => p.lessonId === l.id)?.completedAt || null,
        }))

        // Activity-based breakdown
        const lessonMap = new Map(lessons.map(l => [l.id, l]))
        let completedLessons = 0
        let totalAssignments = 0
        const progressMap = new Map(progressRecords.map(p => [p.lessonId, p.completed]))
        for (const l of lessons) {
          if (progressMap.get(l.id)) completedLessons++
          totalAssignments += l._count.assignments
        }

        const [submissionCount, mcqPackageIds, cqPackageIds] = await Promise.all([
          db.assignmentSubmission.count({
            where: { userId, assignment: { lesson: { courseId } } },
          }),
          Promise.resolve([...new Set([...lessonExams.filter(e => e.examType === 'MCQ').map(e => e.packageId), ...examSchedules.filter(e => e.examType === 'MCQ').map(e => e.packageId)])]),
          Promise.resolve([...new Set([...lessonExams.filter(e => e.examType === 'CQ').map(e => e.packageId), ...examSchedules.filter(e => e.examType === 'CQ').map(e => e.packageId)])]),
        ])

        const [mcqSets, cqSets, completedMcqResults, completedCqSubmissions] = await Promise.all([
          mcqPackageIds.length ? db.mCQExamSet.findMany({ where: { packageId: { in: mcqPackageIds as string[] } }, select: { id: true } }) : [],
          cqPackageIds.length ? db.cQExamSet.findMany({ where: { packageId: { in: cqPackageIds as string[] } }, select: { id: true } }) : [],
          mcqPackageIds.length ? db.mCQExamSetResult.count({ where: { userId, set: { packageId: { in: mcqPackageIds as string[] } }, status: 'COMPLETED' as const } }) : 0,
          cqPackageIds.length ? db.cQExamSubmission.count({ where: { userId, set: { packageId: { in: cqPackageIds as string[] } }, status: { in: ['SUBMITTED', 'GRADED', 'PUBLISHED'] } } }) : 0,
        ])

        const totalMcqExams = mcqSets.length
        const totalCqExams = cqSets.length
        const totalActivities = lessons.length + totalAssignments + totalMcqExams + totalCqExams
        const completedActivities = completedLessons + submissionCount + completedMcqResults + completedCqSubmissions

        return apiResponse({
          user,
          enrollment: enrollment ? { status: enrollment.status, type: enrollment.type, enrolledAt: enrollment.enrolledAt, completedAt: enrollment.completedAt } : null,
          purchase: purchase ? { purchasedAt: purchase.purchasedAt, isActive: purchase.isActive } : null,
          progress,
          totalContents: lessons.length,
          completedCount: completedLessons,
          progressPercent: lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0,
          overallProgress: {
            total: totalActivities,
            completed: completedActivities,
            percent: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
          },
          breakdown: {
            lessons: { total: lessons.length, completed: completedLessons },
            assignments: { total: totalAssignments, completed: submissionCount },
            mcqExams: { total: totalMcqExams, completed: completedMcqResults },
            cqExams: { total: totalCqExams, completed: completedCqSubmissions },
          },
        })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin Course GET')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create': {
        const parsed = courseSchema.safeParse(body)
        if (!parsed.success) {
          return apiError(parsed.error.issues[0]?.message || 'Invalid course data', 400)
        }
        const b = parsed.data

        if (b.classId) {
          const cls = await db.classCategory.findUnique({ where: { id: b.classId } })
          if (!cls) return apiError('Invalid classId: class category not found', 400, 'INVALID_FOREIGN_KEY')
        }
        if (b.subjectId) {
          const subj = await db.subject.findUnique({ where: { id: b.subjectId } })
          if (!subj) return apiError('Invalid subjectId: subject not found', 400, 'INVALID_FOREIGN_KEY')
        }

        const baseSlug = (b.slug || b.title)
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
        const slug = await generateUniqueSlug('course', baseSlug)

        const course = await db.$transaction(async (tx) => {
          const created = await tx.course.create({
            data: {
              title: b.title,
              slug,
              description: b.description || null,
              status: normalizeStatus(b.status),
              isPremium: deriveIsPremium(b.price),
              price: b.price ?? 0,
              originalPrice: b.originalPrice ?? 0,
              thumbnail: b.thumbnail || null,
              teacherName: b.teacherName || null,
              features: b.features || null,
              requirements: b.requirements || null,
              targetStudents: b.targetStudents || null,
              hasCertificate: b.hasCertificate ?? false,
              duration: b.duration ?? null,
              language: b.language || null,
              difficulty: b.difficulty || null,
              classId: b.classId || null,
              subjectId: b.subjectId || null,
            },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.COURSE_CREATE, 'course', created.id, body, { title: created.title }, tx as never)
          return created
        })

        return apiResponse({ course }, 201)
      }

      case 'update': {
        const { id, ...data } = body
        if (!id) return apiError('Course ID required', 400)

        const existing = await db.course.findUnique({ where: { id } })
        if (!existing) return apiError('Course not found', 404)

        const updateData: Record<string, unknown> = {}
        const FK_FIELDS = ['classId', 'subjectId'] as const
        const fields = [
          'title', 'slug', 'description', 'thumbnail', 'teacherName',
          'isPremium', 'price', 'originalPrice', 'status', 'classId', 'subjectId',
          'features', 'requirements', 'targetStudents', 'hasCertificate',
          'duration', 'language', 'difficulty',
        ]
        for (const f of fields) {
          if (data[f] === undefined) continue
          if ((FK_FIELDS as readonly string[]).includes(f)) {
            // Empty string or null ⇒ clear the relation. Never persist "" into a FK column.
            if (data[f] === '' || data[f] === null) { updateData[f] = null; continue }
            updateData[f] = data[f]
            continue
          }
          updateData[f] = data[f]
        }
        if (updateData.status && typeof updateData.status === 'string') {
          updateData.status = updateData.status.toUpperCase()
        }

        // Derive isPremium from price if price is being changed
        if (updateData.price !== undefined) {
          updateData.isPremium = deriveIsPremium(updateData.price)
        }

        if (data.slug && data.slug !== existing.slug) {
          const slugConflict = await findSlugConflict('course', { slug: data.slug })
          if (slugConflict) return apiError('Slug already exists', 409)
        }

        // Validate foreign keys. Empty strings were already coerced to null above,
        // so any remaining non-null value must reference an existing row.
        if (updateData.classId) {
          const cls = await db.classCategory.findUnique({ where: { id: updateData.classId as string } })
          if (!cls) return apiError('Invalid class', 400, 'INVALID_FOREIGN_KEY')
        }
        if (updateData.subjectId) {
          const sub = await db.subject.findUnique({ where: { id: updateData.subjectId as string } })
          if (!sub) return apiError('Invalid subject', 400, 'INVALID_FOREIGN_KEY')
        }

        // Determine which fields actually changed
        const changedFields = Object.keys(updateData).filter(
          key => JSON.stringify(updateData[key]) !== JSON.stringify(existing[key as keyof typeof existing])
        )

        // Transition workflow + update content atomically
        const ipAddress = getClientIP(request)
        const userAgent = request.headers.get('user-agent') || undefined

        const workflow = await db.contentWorkflow.findFirst({ where: { entityType: 'course', entityId: id } })

        const result = await transitionWorkflow(db as never, {
          entityType: 'course',
          entityId: id,
          action: 'update_content',
          userId: auth.user.id,
          userRole: auth.user.role,
          expectedVersion: workflow?.version ?? 0,
          ipAddress,
          userAgent,
          changedFields,
          contentUpdate: { data: updateData },
        })

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: result.httpStatus })
        }

        await auditFromRequest(request, auth.user.id, AuditActions.COURSE_UPDATE, 'course', id, existing, updateData)
        return apiResponse({ course: result.contentRecord })
      }

      case 'delete': {
        const { id } = body
        if (!id) return apiError('Course ID required', 400)
        const guard = await guardDeleteDependencies('courses', id)
        if (!guard.ok) return guard.response
        await db.$transaction(async (tx) => {
          await tx.lessonProgress.deleteMany({ where: { courseId: id } })
          await tx.coursePurchase.deleteMany({ where: { courseId: id } })
          const lessons = await tx.courseLesson.findMany({ where: { courseId: id }, select: { id: true } })
          for (const lesson of lessons) {
            await tx.courseLesson.update({
              where: { id: lesson.id },
              data: { deletedAt: new Date(), deletedBy: auth.user.id },
            })
          }
          await tx.courseExamSchedule.deleteMany({ where: { courseId: id } })
          await tx.course.update({
            where: { id },
            data: { deletedAt: new Date(), deletedBy: auth.user.id },
          })
          await auditFromRequest(request, auth.user.id, AuditActions.COURSE_DELETE, 'course', id, undefined, undefined, tx as never)
        })
        return apiResponse({ success: true })
      }

      // ─── Exam Schedule CRUD ──────────────────────────────────────
      case 'add-exam-schedule': {
        const { courseId, examType, packageId, examDate, startTime, endTime, autoFilledFromPackage } = body
        if (!courseId || !examType || !packageId || !examDate || !startTime || !endTime) {
          return apiError('courseId, examType, packageId, examDate, startTime, endTime required', 400)
        }
        const schedule = await db.$transaction(async (tx) => {
          const created = await tx.courseExamSchedule.create({
            data: {
              courseId, examType, packageId,
              examDate: new Date(examDate).toISOString(),
              startTime, endTime,
              autoFilledFromPackage: autoFilledFromPackage ?? false,
              overrideAllowed: true,
            },
          })
          await auditFromRequest(request, auth.user.id, 'course_exam_schedule_create', 'course', courseId, body, created as Record<string, unknown>, tx as never)
          return created
        })
        return apiResponse({ schedule }, 201)
      }

      // Auto-create exam schedules from a package's exam sets
      case 'add-exam-schedules-from-package': {
        const { courseId, examType, packageId } = body
        if (!courseId || !examType || !packageId) {
          return apiError('courseId, examType, packageId required', 400)
        }
        const examSets = examType === 'MCQ'
          ? await db.mCQExamSet.findMany({ where: { packageId }, select: { id: true, title: true, scheduledDate: true, startTime: true, endTime: true } })
          : await db.cQExamSet.findMany({ where: { packageId }, select: { id: true, title: true, scheduledDate: true, startTime: true, endTime: true } })

        if (examSets.length === 0) return apiError('No exam sets found in this package', 404)

        const schedules = await db.$transaction(async (tx) => {
          const created = await Promise.all(examSets.map(set =>
            tx.courseExamSchedule.create({
              data: {
                courseId, examType, packageId,
                examDate: set.scheduledDate,
                startTime: set.startTime,
                endTime: set.endTime,
                autoFilledFromPackage: true,
                overrideAllowed: true,
              },
            })
          ))
          await auditFromRequest(request, auth.user.id, 'course_exam_schedules_bulk_create', 'course', courseId, body, { count: created.length }, tx as never)
          return created
        })
        return apiResponse({ schedules, count: schedules.length }, 201)
      }

      case 'update-exam-schedule': {
        const { id, examDate, startTime, endTime } = body
        if (!id) return apiError('Schedule ID required', 400)
        const existing = await db.courseExamSchedule.findUnique({ where: { id } })
        if (!existing) return apiError('Schedule not found', 404)
        if (!existing.overrideAllowed) return apiError('Override not allowed for this schedule', 403)

        const updateData: Record<string, unknown> = {}
        if (examDate !== undefined) updateData.examDate = new Date(examDate).toISOString()
        if (startTime !== undefined) updateData.startTime = startTime
        if (endTime !== undefined) updateData.endTime = endTime

        const schedule = await db.$transaction(async (tx) => {
          const updated = await tx.courseExamSchedule.update({ where: { id }, data: updateData as never })
          await auditFromRequest(request, auth.user.id, 'course_exam_schedule_update', 'course', existing.courseId, body, updated as Record<string, unknown>, tx as never)
          return updated
        })
        return apiResponse({ schedule })
      }

      case 'remove-exam-schedule': {
        const { id } = body
        if (!id) return apiError('Schedule ID required', 400)
        await db.$transaction(async (tx) => {
          await tx.courseExamSchedule.delete({ where: { id } })
          await auditFromRequest(request, auth.user.id, 'course_exam_schedule_delete', 'course', body.courseId, body, undefined, tx as never)
        })
        return apiResponse({ success: true })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Admin Course POST')
  }
}


