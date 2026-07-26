import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { verifyAuth } from '@/lib/auth'
import { FALLBACK_SLUG_GRADIENTS } from '@/lib/hierarchy-labels'

/**
 * GET /api/user/classes
 *
 * Returns classes personalized to the authenticated user:
 * - CLASS_BASED students: only their selected class
 * - GLOBAL students: all active classes
 * - Unauthenticated: all active classes
 *
 * This endpoint is for student-facing pages (class list, home page).
 * Use /api/classes for admin/tooling that needs the full catalog.
 */
export async function GET(request: Request) {
  try {
    if (!db) {
      return apiError('ডাটাবেজ সংযোগ পাওয়া যায়নি', 500, 'DB_CONNECTION_ERROR')
    }

    // Resolve user's class filter
    const auth = await verifyAuth(request)
    const isClassBased = auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel

    const where: Record<string, unknown> = { isActive: true }
    if (isClassBased && auth?.user?.classLevel) {
      where.slug = auth.user.classLevel
    }

    const classes = await db.classCategory.findMany({
      where,
      include: {
        subjects: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { id: true },
        },
      },
      orderBy: { order: 'asc' },
    })

    if (!Array.isArray(classes)) {
      return apiError('ক্লাসের তথ্য ফরম্যাট ত্রুটি', 500, 'INVALID_DATA_FORMAT')
    }

    const classMeta = classes.map((cls) => ({
      classId: cls.id,
      subjectIds: cls.subjects.map((s) => s.id),
    }))

    const allSubjectIds = classMeta.flatMap((c) => c.subjectIds)

    const [mcqCounts, cqCounts] = await Promise.all([
      allSubjectIds.length > 0
        ? db.$queryRaw<Array<{ subject_id: string; total: number; free: number; board: number; free_board: number }>>(
            Prisma.sql`
              SELECT "subjectId" AS subject_id,
                     COUNT(*) AS total,
                     SUM(CASE WHEN "isPremium" = false THEN 1 ELSE 0 END) AS free,
                     SUM(CASE WHEN "board" IS NOT NULL AND "year" IS NOT NULL THEN 1 ELSE 0 END) AS board,
                     SUM(CASE WHEN "board" IS NOT NULL AND "year" IS NOT NULL AND "isPremium" = false THEN 1 ELSE 0 END) AS free_board
              FROM "MCQ"
              WHERE "subjectId" IN (${Prisma.join(allSubjectIds)}) AND "isActive" = true AND "deletedAt" IS NULL
              GROUP BY "subjectId"
            `,
          )
        : Promise.resolve([]),
      allSubjectIds.length > 0
        ? db.$queryRaw<Array<{ subject_id: string; total: number; free: number; board: number; free_board: number }>>(
            Prisma.sql`
              SELECT "subjectId" AS subject_id,
                     COUNT(*) AS total,
                     SUM(CASE WHEN "isPremium" = false THEN 1 ELSE 0 END) AS free,
                     SUM(CASE WHEN "board" IS NOT NULL AND "year" IS NOT NULL THEN 1 ELSE 0 END) AS board,
                     SUM(CASE WHEN "board" IS NOT NULL AND "year" IS NOT NULL AND "isPremium" = false THEN 1 ELSE 0 END) AS free_board
              FROM "CQ"
              WHERE "subjectId" IN (${Prisma.join(allSubjectIds)}) AND "isActive" = true AND "deletedAt" IS NULL
              GROUP BY "subjectId"
            `,
          )
        : Promise.resolve([]),
    ])

    const mcqMap = new Map(mcqCounts.map((r) => [r.subject_id, r]))
    const cqMap = new Map(cqCounts.map((r) => [r.subject_id, r]))

    const transformedClasses = classes.map((cls) => {
      const subjectIds = cls.subjects.map((s) => s.id)

      let mcqs = 0, freeMcqs = 0, boardMcqs = 0, freeBoardMcqs = 0
      let cqs = 0, freeCqs = 0, boardCqs = 0, freeBoardCqs = 0

      for (const sid of subjectIds) {
        const m = mcqMap.get(sid)
        if (m) {
          mcqs += Number(m.total)
          freeMcqs += Number(m.free)
          boardMcqs += Number(m.board)
          freeBoardMcqs += Number(m.free_board)
        }
        const c = cqMap.get(sid)
        if (c) {
          cqs += Number(c.total)
          freeCqs += Number(c.free)
          boardCqs += Number(c.board)
          freeBoardCqs += Number(c.free_board)
        }
      }

      const boardQuestions = boardMcqs + boardCqs
      const freeBoardQuestions = freeBoardMcqs + freeBoardCqs
      const contentCounts = {
        lectures: 0, freeLectures: 0,
        mcqs, freeMcqs,
        cqs, freeCqs,
        boardQuestions, freeBoardQuestions,
      }
      const totalContent = mcqs + cqs + boardQuestions

      return {
        id: cls.id,
        name: cls.name,
        slug: cls.slug,
        subjectCount: cls.subjects.length,
        icon: cls.icon || 'BookOpen',
        gradient: cls.gradient || FALLBACK_SLUG_GRADIENTS[cls.slug] || 'from-emerald-400 to-teal-600',
        description: cls.description ?? null,
        color: cls.color ?? null,
        contentCounts,
        totalContent,
      }
    })

    return NextResponse.json(
      { success: true, data: { classes: transformedClasses } },
    )
  } catch (error) {
    return handleApiError(error, 'Get user classes error')
  }
}
