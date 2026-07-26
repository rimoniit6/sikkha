import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { verifyAuth } from '@/lib/auth'
import { cacheHeaders } from '@/lib/cache-headers'
import { batchCheckContentAccess } from '@/lib/access-control'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error
    const { searchParams } = new URL(request.url)
    let classLevel = searchParams.get('classLevel')
    if (!classLevel) {
      const auth = await verifyAuth(request)
      if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
        classLevel = auth.user.classLevel
      }
    }
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const type = searchParams.get('type')
    const q = searchParams.get('q')
    const isActive = searchParams.get('isActive')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')

    const where: Record<string, unknown> = {}
    where.isActive = isActive === 'false' ? false : true
    where.status = (status || 'PUBLISHED').toUpperCase()

    if (classLevel) where.classLevel = classLevel
    if (subjectId) where.subjectId = subjectId
    if (chapterId) where.chapterIds = { contains: chapterId }
    if (type) where.type = type
    if (q?.trim()) where.title = { contains: q.trim(), mode: 'insensitive' }

    const [data, total] = await Promise.all([
      db.exam.findMany({
        where,
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.exam.count({ where }),
    ])

    // ── Access control: resolve premium exam access ──
    const auth = await verifyAuth(request)
    const userId = auth?.user.id
    const isAdmin = auth?.user && ['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)

    let accessiblePremiumIds = new Set<string>()
    if (!isAdmin && userId) {
      const premiumExamIds = data.filter((e) => e.isPremium).map((e) => e.id)
      if (premiumExamIds.length > 0) {
        const accessMap = await batchCheckContentAccess({
          userId,
          items: premiumExamIds.map((id) => ({ contentType: 'exam', contentId: id })),
        })
        for (const [id, result] of accessMap) {
          if (result.hasAccess) accessiblePremiumIds.add(id)
        }
      }
    } else if (isAdmin) {
      accessiblePremiumIds = new Set(data.filter((e) => e.isPremium).map((e) => e.id))
    }

    const exams = data.map((exam) => {
      const isPremiumLocked = exam.isPremium && !accessiblePremiumIds.has(exam.id)
      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        classLevel: exam.classLevel,
        type: exam.type,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        marksPerMcq: exam.marksPerMcq,
        negativeMarks: exam.negativeMarks,
        year: null,
        board: null,
        isPremium: exam.isPremium,
        price: exam.price,
        instructions: isPremiumLocked ? null : exam.instructions,
        totalQuestions: exam._count.questions,
        hasAccess: !isPremiumLocked,
      }
    })

    return NextResponse.json({
      success: true,
      data: exams,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: cacheHeaders.noCache })
  } catch (error) {
    return handleApiError(error, 'Public Get Exams error')
  }
}
