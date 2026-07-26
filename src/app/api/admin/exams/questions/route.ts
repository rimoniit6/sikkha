import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'

// Fetch available MCQ/CQ questions for adding to an exam
export async function GET(request: Request) {
  try {
    // Only authenticated admins may access the question bank
    const auth = await withAdmin(request)
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(request.url)
    const classLevel = searchParams.get('classLevel')
    const subjectId = searchParams.get('subjectId')
    const type = searchParams.get('type') // mcq, cq, or all
    const search = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '50')

    const result: { mcqs: unknown[]; cqs: unknown[] } = { mcqs: [], cqs: [] }

    // Fetch MCQs
    if (!type || type === 'mcq' || type === 'mixed') {
      const mcqWhere: Record<string, unknown> = { isActive: true }
      if (classLevel) mcqWhere.classLevel = classLevel
      if (subjectId && subjectId !== 'all') mcqWhere.subjectId = subjectId
      if (search) mcqWhere.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
      ]

      result.mcqs = await db.mCQ.findMany({
        where: mcqWhere,
        select: {
          id: true,
          question: true,
          correctAnswer: true,
          difficulty: true,
          classLevel: true,
          subjectId: true,
          topic: true,
          chapter: { select: { id: true, name: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Fetch CQs
    if (!type || type === 'cq' || type === 'mixed') {
      const cqWhere: Record<string, unknown> = { isActive: true }
      if (classLevel) cqWhere.classLevel = classLevel
      if (subjectId && subjectId !== 'all') cqWhere.subjectId = subjectId
      if (search) cqWhere.OR = [
        { uddeepok: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
      ]

      result.cqs = await db.cQ.findMany({
        where: cqWhere,
        select: {
          id: true,
          uddeepok: true,
          question1: true,
          question2: true,
          question3: true,
          question4: true,
          difficulty: true,
          classLevel: true,
          subjectId: true,
          topic: true,
          chapter: { select: { id: true, name: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'Fetch question bank error')
  }
}
