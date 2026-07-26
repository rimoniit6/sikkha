import { verifyAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { apiError, applyRateLimit, withCsrf } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { submitExam, getUserResults, ExamError } from '@/services/exam-service'
import { handleApiError } from '@/lib/errors'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth?.user?.id) {
      return apiError('অনুগ্রহ করে লগইন করুন', 401)
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const data = await getUserResults(auth.user.id, page, limit)
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    return handleApiError(error, 'Get user results error:')
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const auth = await verifyAuth(request)
    if (!auth?.user?.id) {
      return apiError('অনুগ্রহ করে লগইন করুন', 401)
    }

    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const body = await request.json()
    const { examId, sessionId, timeTaken, answers, idempotencyKey } = body

    if (!examId) {
      return apiError('পরীক্ষার ID আবশ্যক', 400)
    }

    if (!sessionId) {
      return apiError('সেশন ID আবশ্যক', 400)
    }

    if (!answers || typeof answers !== 'object') {
      return apiError('উত্তর ডাটা আবশ্যক', 400)
    }

    const result = await submitExam(
      auth.user.id,
      examId,
      sessionId,
      timeTaken ?? 0,
      answers,
      idempotencyKey
    )

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof ExamError) {
      return apiError(error.message, error.statusCode)
    }
    logger.error('Save Exam Result error', error, { route: 'exams/results', method: 'POST' })
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return apiError('আপনি ইতিমধ্যে এই পরীক্ষাটি জমা দিয়েছেন', 409)
    }
    return apiError('পরীক্ষার ফলাফল সংরক্ষণ করতে সমস্যা হয়েছে', 500)
  }
}
