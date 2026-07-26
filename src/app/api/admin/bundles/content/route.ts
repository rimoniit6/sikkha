import { db } from '@/lib/db'
import { apiError, withAdmin } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

// GET /api/admin/bundles/content — Search for content items to add to a bundle
export async function GET(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof Response) return auth
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // mcq, cq, lecture, exam
    const q = searchParams.get('q') || ''
    const classLevel = searchParams.get('classLevel')
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const isPremium = searchParams.get('isPremium')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!type) {
      return apiError('কন্টেন্ট টাইপ আবশ্যক (mcq, cq, lecture, exam)', 400)
    }

    let results: Array<{
      id: string
      title: string
      price: number
      isPremium: boolean
      classLevel?: string | null
      chapterId?: string | null
      chapterName?: string | null
    }> = []

    switch (type) {
      case 'mcq': {
        const mcqWhere: Record<string, unknown> = { isActive: true }
        if (q) mcqWhere.question = { contains: q, mode: 'insensitive' }
        if (classLevel) mcqWhere.classLevel = classLevel
        if (subjectId) mcqWhere.subjectId = subjectId
        if (chapterId) mcqWhere.chapterId = chapterId
        if (isPremium !== null && isPremium !== undefined) mcqWhere.isPremium = isPremium === 'true'

        const mcqs = await db.mCQ.findMany({
          where: mcqWhere,
          select: {
            id: true,
            question: true,
            price: true,
            isPremium: true,
            classLevel: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })

        results = mcqs.map((mcq) => ({
          id: mcq.id,
          title: mcq.question.length > 80
            ? mcq.question.substring(0, 80) + '...'
            : mcq.question,
          price: Number(mcq.price),
          isPremium: mcq.isPremium,
          classLevel: mcq.classLevel,
          chapterId: mcq.chapterId,
          chapterName: mcq.chapter?.name || null,
        }))
        break
      }

      case 'cq': {
        const cqWhere: Record<string, unknown> = { isActive: true }
        if (q) cqWhere.uddeepok = { contains: q, mode: 'insensitive' }
        if (classLevel) cqWhere.classLevel = classLevel
        if (subjectId) cqWhere.subjectId = subjectId
        if (chapterId) cqWhere.chapterId = chapterId
        if (isPremium !== null && isPremium !== undefined) cqWhere.isPremium = isPremium === 'true'

        const cqs = await db.cQ.findMany({
          where: cqWhere,
          select: {
            id: true,
            uddeepok: true,
            price: true,
            isPremium: true,
            classLevel: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })

        results = cqs.map((cq) => ({
          id: cq.id,
          title: cq.uddeepok.length > 80
            ? cq.uddeepok.substring(0, 80) + '...'
            : cq.uddeepok,
          price: Number(cq.price),
          isPremium: cq.isPremium,
          classLevel: cq.classLevel,
          chapterId: cq.chapterId,
          chapterName: cq.chapter?.name || null,
        }))
        break
      }

      case 'lecture': {
        const lectureWhere: Record<string, unknown> = { isActive: true }
        if (q) lectureWhere.title = { contains: q, mode: 'insensitive' }

        const lectures = await db.lecture.findMany({
          where: lectureWhere,
          select: {
            id: true,
            title: true,
            price: true,
            isPremium: true,
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })

        results = lectures.map((lecture) => ({
          id: lecture.id,
          title: lecture.title,
          price: Number(lecture.price),
          isPremium: lecture.isPremium,
        }))
        break
      }

      case 'exam': {
        const examWhere: Record<string, unknown> = { isActive: true }
        if (q) examWhere.title = { contains: q, mode: 'insensitive' }
        if (classLevel) examWhere.classLevel = classLevel

        const exams = await db.exam.findMany({
          where: examWhere,
          select: {
            id: true,
            title: true,
            price: true,
            isPremium: true,
            classLevel: true,
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })

        results = exams.map((exam) => ({
          id: exam.id,
          title: exam.title,
          price: Number(exam.price),
          isPremium: exam.isPremium,
          classLevel: exam.classLevel,
        }))
        break
      }

      default:
        return apiError('অবৈধ কন্টেন্ট টাইপ। সমর্থিত: mcq, cq, lecture, exam', 400)
    }

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    return handleApiError(error, 'Admin Bundle Content Search error:')
  }
}
