import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { getClassLevelForRequest } from '@/lib/class-filter'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const classLevel = await getClassLevelForRequest(request)
    const classFilter = classLevel ? { classLevel } : {}

    const [mcqs, cqs, lectures, suggestions] = await Promise.allSettled([
      db.mCQ.findMany({
        where: { isActive: true, question: { contains: q, mode: 'insensitive' }, ...classFilter },
        select: { id: true, question: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      db.cQ.findMany({
        where: { isActive: true, uddeepok: { contains: q, mode: 'insensitive' }, ...classFilter },
        select: { id: true, uddeepok: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      db.lecture.findMany({
        where: {
          isActive: true,
          title: { contains: q, mode: 'insensitive' },
          ...(classLevel
            ? { chapter: { subject: { class: { slug: classLevel } } } }
            : {}),
        },
        select: { id: true, title: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
      db.suggestion.findMany({
        where: { isActive: true, title: { contains: q, mode: 'insensitive' }, ...(classLevel ? { classId: classLevel } : {}) },
        select: { id: true, title: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const data: Array<{ text: string; type: string }> = []

    if (mcqs.status === 'fulfilled') {
      for (const m of mcqs.value) {
        data.push({ text: m.question.slice(0, 80), type: 'mcq' })
      }
    }
    if (cqs.status === 'fulfilled') {
      for (const c of cqs.value) {
        data.push({ text: c.uddeepok.slice(0, 80), type: 'cq' })
      }
    }
    if (lectures.status === 'fulfilled') {
      for (const l of lectures.value) {
        data.push({ text: l.title, type: 'lecture' })
      }
    }
    if (suggestions.status === 'fulfilled') {
      for (const s of suggestions.value) {
        data.push({ text: s.title, type: 'suggestion' })
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, 'Search suggestions error')
  }
}
