import { db } from '@/lib/db'
import { apiError } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { toDecimal } from '@/lib/decimal'
import { getClassLevelForUserId } from '@/lib/class-filter'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return apiError('প্রমাণীকরণ প্রয়োজন।', 401, 'UNAUTHORIZED')
    }

    const userId = auth.user.id
    const classLevel = auth.user.classLevel && auth.user.learningMode === 'CLASS_BASED'
      ? auth.user.classLevel
      : await getClassLevelForUserId(userId)

    const lectureCountWhere: Record<string, unknown> = { isActive: true }
    if (classLevel) {
      lectureCountWhere.chapter = { subject: { class: { slug: classLevel } } }
    }

    const [
      premiumData,
      progress,
      totalLectures,
      examResults,
      savedQuestions,
    ] = await Promise.all([
      // premiumExpiry is not included in verifyAuth, fetch it separately
      db.user.findUnique({ where: { id: userId }, select: { premiumExpiry: true } }),
      db.progress.findMany({
        where: { userId },
        orderBy: { lastAccessed: 'desc' },
        take: 10,
        select: { contentType: true, progress: true },
      }),
      db.lecture.count({ where: lectureCountWhere }),
      db.examResult.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: { exam: { select: { title: true } } },
      }),
      db.bookmark.count({ where: { userId } }),
    ])

    // isPremium is already available from verifyAuth — no redundant user query needed

    const lectureProgress = progress.filter((p) => p.contentType === 'lecture')
    const completedLectures = lectureProgress.filter((p) => p.progress >= 100).length

    const mcqResults = examResults.filter((r) => toDecimal(r.totalMarks) > 0)
    const avgMcqScore =
      mcqResults.length > 0
        ? Math.round(mcqResults.reduce((sum, r) => sum + (toDecimal(r.score) / toDecimal(r.totalMarks)) * 100, 0) / mcqResults.length)
        : 0

    const recentExams = examResults.map((er) => ({
      id: er.id,
      subject: er.exam?.title || 'পরীক্ষা',
      score: Math.round(toDecimal(er.score)),
      total: Math.round(toDecimal(er.totalMarks)),
      date: new Date(er.completedAt).toLocaleDateString('bn-BD'),
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          completedLectures,
          totalLectures,
          avgMcqScore,
          savedQuestions,
          isPremium: auth.user.isPremium,
          premiumExpiry: premiumData?.premiumExpiry ? new Date(premiumData.premiumExpiry).toLocaleDateString('bn-BD') : null,
        },
        recentExams,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Get user dashboard error:')
  }
}
