import { db } from '@/lib/db'
import { apiResponse, apiError, withAuth } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { resolveCourseAccess, getUserCourseAccessMap } from '@/lib/course-access-resolver'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'list': {
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
        let classId = searchParams.get('classId') || ''
        if (!classId) {
          const auth = await verifyAuth(request)
          if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
            const classCat = await db.classCategory.findUnique({ where: { slug: auth.user.classLevel }, select: { id: true } })
            if (classCat) classId = classCat.id
          }
        }
        const subjectId = searchParams.get('subjectId') || ''
        const q = (searchParams.get('q') || '').trim()
        const price = searchParams.get('price') || '' // free | paid | ''
        const difficulty = searchParams.get('difficulty') || '' // beginner | intermediate | advanced
        const sort = searchParams.get('sort') || 'newest'
        const idsParam = searchParams.get('ids') || ''

        const where: Record<string, unknown> = {}
        if (idsParam) where.id = { in: idsParam.split(',').filter(Boolean) }
        else where.status = 'PUBLISHED'
        if (classId) where.classId = classId
        if (subjectId) where.subjectId = subjectId
        if (difficulty) where.difficulty = difficulty
        if (price === 'free') where.isPremium = false
        else if (price === 'paid') where.isPremium = true
        if (q) {
          where.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ]
        }

        let orderBy: Record<string, unknown> = { createdAt: 'desc' }
        if (sort === 'popular') orderBy = { purchases: { _count: 'desc' } }
        else if (sort === 'price_asc') orderBy = { price: 'asc' }
        else if (sort === 'price_desc') orderBy = { price: 'desc' }

        const [courses, total] = await Promise.all([
          db.course.findMany({
            where,
            include: {
              classCategory: { select: { id: true, name: true, slug: true } },
              subject: { select: { id: true, name: true, slug: true, color: true, icon: true } },
              _count: { select: { lessons: true, purchases: true } },
            },
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.course.count({ where }),
        ])

        return apiResponse({ courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
      }

      case 'related': {
        const courseId = searchParams.get('courseId')
        if (!courseId) return apiError('courseId required', 400)

        const base = await db.course.findUnique({
          where: { id: courseId },
          select: { subjectId: true, classId: true },
        })
        if (!base) return apiError('Course not found', 404)

        const orConditions: Record<string, unknown>[] = []
        if (base.subjectId) orConditions.push({ subjectId: base.subjectId })
        if (base.classId) orConditions.push({ classId: base.classId })

        const related = await db.course.findMany({
          where: {
            status: 'PUBLISHED',
            id: { not: courseId },
            OR: orConditions.length ? orConditions : [{ id: courseId }],
          },
          include: {
            classCategory: { select: { id: true, name: true, slug: true } },
            subject: { select: { id: true, name: true, slug: true, color: true, icon: true } },
            _count: { select: { lessons: true, purchases: true } },
          },
          take: 4,
          orderBy: { createdAt: 'desc' },
        })

        return apiResponse({ courses: related })
      }

      case 'enrollments': {
        const auth = await withAuth(request)
        if (auth instanceof NextResponse) return auth

        const enrollments = await db.courseEnrollment.findMany({
          where: { userId: auth.user.id },
          orderBy: { enrolledAt: 'desc' },
          include: {
            course: {
              include: {
                classCategory: { select: { id: true, name: true, slug: true } },
                subject: { select: { id: true, name: true, slug: true, color: true, icon: true } },
                _count: { select: { lessons: true, purchases: true } },
                certificates: {
                  where: { userId: auth.user.id, deletedAt: null },
                  select: { id: true, serial: true },
                },
              },
            },
          },
        })

        const courseIds = enrollments.map((e) => e.courseId)
        const progressAgg = courseIds.length
          ? await db.lessonProgress.groupBy({
              by: ['courseId'],
              where: { userId: auth.user.id, courseId: { in: courseIds }, completed: true },
              _count: { _all: true },
            })
          : []
        const completedMap = new Map(progressAgg.map((p) => [p.courseId, p._count._all]))

        const items = enrollments.map((e) => {
          const total = e.course._count.lessons || 0
          const completed = completedMap.get(e.courseId) || 0
          const percent = total > 0 ? Math.round((completed / total) * 100) : e.status === 'COMPLETED' ? 100 : 0
          return {
            enrollment: { id: e.id, status: e.status, type: e.type, enrolledAt: e.enrolledAt, completedAt: e.completedAt },
            course: e.course,
            progress: { total, completed, percent },
            certificate: e.course.certificates[0] || null,
          }
        })

        return apiResponse({ enrollments: items })
      }

      case 'detail': {
        const slug = searchParams.get('slug')
        const id = searchParams.get('id')
        const identifier = slug || id
        if (!identifier) return apiError('Course slug or ID required', 400)

        const course = await db.course.findFirst({
          where: slug ? { slug } : { id: id! },
          include: {
            classCategory: { select: { id: true, name: true, slug: true } },
            subject: { select: { id: true, name: true, slug: true, color: true, icon: true } },
            lessons: {
              orderBy: { displayOrder: 'asc' },
              include: { exams: true, assignments: true, schedules: true, notes: true, resources: true },
            },
          },
        })

        if (!course) return apiError('Course not found', 404)

        let userId: string | null = null
        const authResult = await withAuth(request)
        if (!(authResult instanceof NextResponse)) {
          userId = authResult.user.id
        }

        let hasAccess = false
        let enrollment = null
        let accessSource: string | null = null

        if (userId) {
          const accessMap = await getUserCourseAccessMap(userId, course.id)
          hasAccess = accessMap.courseAccess
          accessSource = accessMap.source
          enrollment = accessMap.enrollment as typeof enrollment
        } else {
          hasAccess = false
        }

        let progress: Record<string, boolean> = {}
        if (userId) {
          const progressRecords = await db.lessonProgress.findMany({
            where: { userId, courseId: course.id },
            select: { lessonId: true, completed: true },
          })
          for (const p of progressRecords) {
            progress[p.lessonId] = p.completed
          }
        }

        // Strip sensitive lesson data when user has no access
        if (!hasAccess && course.lessons) {
          course.lessons = course.lessons.map(l => ({
            ...l,
            videoUrl: null,
            previewVideo: null,
            meetingLink: null,
            meetingId: null,
            password: null,
          }))
        }

        return apiResponse({ course, hasAccess, progress, enrollment })
      }

      case 'syllabus': {
        const courseId = searchParams.get('courseId')
        if (!courseId) return apiError('courseId required', 400)

        const course = await db.course.findUnique({
          where: { id: courseId },
          include: {
            lessons: {
              orderBy: { displayOrder: 'asc' },
              include: {
                exams: true,
                assignments: true,
                schedules: true,
                notes: true,
              },
            },
            examSchedules: true,
          },
        })
        if (!course) return apiError('Course not found', 404)

        // Collect package IDs from both LessonExam and CourseExamSchedule
        const lessonMcqIds = [...new Set(course.lessons.flatMap(l => l.exams.filter(e => e.examType === 'MCQ').map(e => e.packageId)))]
        const lessonCqIds = [...new Set(course.lessons.flatMap(l => l.exams.filter(e => e.examType === 'CQ').map(e => e.packageId)))]
        const schedMcqIds = [...new Set(course.examSchedules.filter(e => e.examType === 'MCQ').map(e => e.packageId))]
        const schedCqIds = [...new Set(course.examSchedules.filter(e => e.examType === 'CQ').map(e => e.packageId))]
        const mcqPackageIds = [...new Set([...lessonMcqIds, ...schedMcqIds])]
        const cqPackageIds = [...new Set([...lessonCqIds, ...schedCqIds])]

        // Fetch package names + exam sets (to match schedules to specific sets)
        const [mcqPackages, cqPackages, mcqSets, cqSets] = await Promise.all([
          mcqPackageIds.length ? db.mCQExamPackage.findMany({ where: { id: { in: mcqPackageIds }, status: 'PUBLISHED', isActive: true }, select: { id: true, title: true } }) : [],
          cqPackageIds.length ? db.cQExamPackage.findMany({ where: { id: { in: cqPackageIds }, status: 'PUBLISHED', isActive: true }, select: { id: true, title: true } }) : [],
          mcqPackageIds.length ? db.mCQExamSet.findMany({ where: { packageId: { in: mcqPackageIds }, status: 'PUBLISHED' }, select: { id: true, title: true, packageId: true, scheduledDate: true, startTime: true, endTime: true } }) : [],
          cqPackageIds.length ? db.cQExamSet.findMany({ where: { packageId: { in: cqPackageIds }, status: 'PUBLISHED' }, select: { id: true, title: true, packageId: true, scheduledDate: true, startTime: true, endTime: true } }) : [],
        ])
        const mcqPackageMap = new Map(mcqPackages.map(p => [p.id, p.title]))
        const cqPackageMap = new Map(cqPackages.map(p => [p.id, p.title]))

        // Build lookup: CourseExamSchedule id → matched exam set
        type SchedItem = { examType: string; packageId: string; examDate: Date; startTime: string | null; endTime: string | null }
        function matchSet(sched: SchedItem, sets: typeof mcqSets): { setId: string; setTitle: string } | null {
          const schedDate = sched.examDate.toISOString().split('T')[0]
          for (const s of sets) {
            if (s.packageId !== sched.packageId) continue
            const sDate = s.scheduledDate instanceof Date
              ? s.scheduledDate.toISOString().split('T')[0]
              : new Date(s.scheduledDate).toISOString().split('T')[0]
            if (sDate === schedDate && s.startTime === sched.startTime) {
              return { setId: s.id, setTitle: s.title }
            }
          }
          return null
        }

        // Build a master list of exam entries from CourseExamSchedule (course-level)
        const masterMcqExams = course.examSchedules
          .filter(e => e.examType === 'MCQ')
          .map(e => {
            const matched = matchSet(e, mcqSets)
            return {
              type: 'MCQ' as const,
              id: matched?.setId || e.id, // stable DB identifier: real set ID, or schedule ID
              packageId: e.packageId,
              packageName: mcqPackageMap.get(e.packageId) || null,
              setId: matched?.setId || '',
              setTitle: matched?.setTitle || mcqPackageMap.get(e.packageId) || '',
              setDate: e.examDate.toISOString(),
              setStartTime: e.startTime || null,
              setEndTime: e.endTime || null,
            }
          })

        const masterCqExams = course.examSchedules
          .filter(e => e.examType === 'CQ')
          .map(e => {
            const matched = matchSet(e, cqSets)
            return {
              type: 'CQ' as const,
              id: matched?.setId || e.id, // stable DB identifier: real set ID, or schedule ID
              packageId: e.packageId,
              packageName: cqPackageMap.get(e.packageId) || null,
              setId: matched?.setId || '',
              setTitle: matched?.setTitle || cqPackageMap.get(e.packageId) || '',
              setDate: e.examDate.toISOString(),
              setStartTime: e.startTime || null,
              setEndTime: e.endTime || null,
            }
          })

        let userId: string | null = null
        const authResult = await withAuth(request)
        if (!(authResult instanceof NextResponse)) userId = authResult.user.id

        let progressSet = new Set<string>()
        if (userId) {
          const records = await db.lessonProgress.findMany({
            where: { userId, courseId: course.id },
            select: { lessonId: true, completed: true },
          })
          for (const r of records) if (r.completed) progressSet.add(r.lessonId)
        }

        const rows = course.lessons.map(l => {
          const schedule = l.schedules?.[0]
          const dayOfWeek = schedule?.date ? new Date(schedule.date).getDay() : null
          // LessonExam-based entries (legacy — still included for backward compat)
          const mcqExams = l.exams.filter(e => e.examType === 'MCQ').map(e => ({
            id: e.id, // LessonExam's own stable DB identifier
            packageId: e.packageId,
            packageName: mcqPackageMap.get(e.packageId) || null,
            setId: '',
            setTitle: '',
            setDate: null,
            setStartTime: null,
            setEndTime: null,
          }))
          const cqExams = l.exams.filter(e => e.examType === 'CQ').map(e => ({
            id: e.id, // LessonExam's own stable DB identifier
            packageId: e.packageId,
            packageName: cqPackageMap.get(e.packageId) || null,
            setId: '',
            setTitle: '',
            setDate: null,
            setStartTime: null,
            setEndTime: null,
          }))
          const isCompleted = progressSet.has(l.id)
          return {
            contentId: l.id,
            title: l.title,
            lessonType: l.lessonType,
            dayOfWeek,
            date: schedule?.date?.toISOString() ?? null,
            startTime: schedule?.startTime || null,
            endTime: schedule?.endTime || null,
            mcqExams,
            cqExams,
            hasAssignments: l.assignments.length > 0,
            displayOrder: l.displayOrder,
            status: isCompleted ? 'completed' : 'not_started',
          }
        })

        const summary = {
          totalLessons: course.lessons.length,
          totalLiveClasses: course.lessons.filter(l => l.lessonType === 'LIVE').length,
          totalRecordedClasses: course.lessons.filter(l => l.lessonType === 'RECORDED').length,
          totalMcqExams: course.lessons.reduce((acc, l) => acc + l.exams.filter(e => e.examType === 'MCQ').length, 0) + masterMcqExams.length,
          totalCqExams: course.lessons.reduce((acc, l) => acc + l.exams.filter(e => e.examType === 'CQ').length, 0) + masterCqExams.length,
          totalAssignments: course.lessons.reduce((acc, l) => acc + l.assignments.length, 0),
          totalNotes: course.lessons.reduce((acc, l) => acc + l.notes.length, 0),
          totalResources: 0,
          teacherName: course.teacherName,
        }
        // Return both lesson-level rows and course-level exam calendar
        return apiResponse({ summary, rows, examCalendar: [...masterMcqExams, ...masterCqExams] })
      }

      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    return handleApiError(error, 'Course GET')
  }
}
