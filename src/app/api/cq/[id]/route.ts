import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { checkContentAccess } from '@/lib/access-control'
import { apiError, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { buildPremiumUpdatePayload } from '@/lib/premium'
import { cacheHeaders } from '@/lib/cache-headers'


function transformCQ(cq: {
  id: string
  uddeepok: string
  uddeepokImage?: string | null
  question1: string
  question1Image?: string | null
  question2: string
  question2Image?: string | null
  question3: string
  question3Image?: string | null
  question4: string
  question4Image?: string | null
  answer1: string
  answer1Image?: string | null
  answer2: string
  answer2Image?: string | null
  answer3: string
  answer3Image?: string | null
  answer4: string
  answer4Image?: string | null
  isPremium: boolean
  price: number
  difficulty: string
  board: string | null
  year: string | null
  chapterId: string
  chapter?: { id: string; name: string; slug: string; subject?: { id: string; name: string; slug: string; class?: { id: string; name: string; slug: string } } }
  [key: string]: unknown
}) {
  const BENGALI_LABELS = ['ক', 'খ', 'গ', 'ঘ']

  const questions: Array<{
    id: string
    label: string
    number: number
    text: string
    marks: number
    answer: string
    questionImage: string | null
    answerImage: string | null
  }> = []
  for (let i = 1; i <= 4; i++) {
    const text = cq[`question${i}` as keyof typeof cq] as string
    const answer = cq[`answer${i}` as keyof typeof cq] as string
    const questionImage = cq[`question${i}Image` as keyof typeof cq] as string | null | undefined
    const answerImage = cq[`answer${i}Image` as keyof typeof cq] as string | null | undefined
    if (text) {
      questions.push({
        id: `${cq.id}-q${i}`,
        label: BENGALI_LABELS[i - 1],
        number: i,
        text,
        marks: i,
        answer: answer || '',
        questionImage: questionImage || null,
        answerImage: answerImage || null,
      })
    }
  }

  return {
    id: cq.id,
    uddeepok: cq.uddeepok,
    uddeepokImage: cq.uddeepokImage || null,
    questions,
    chapterName: cq.chapter?.name || '',
    subjectName: cq.chapter?.subject?.name || '',
    className: cq.chapter?.subject?.class?.name || '',
    classSlug: cq.chapter?.subject?.class?.slug || '',
    subjectId: cq.chapter?.subject?.id || '',
    chapterId: cq.chapterId,
    isPremium: cq.isPremium,
    price: cq.price,
    year: cq.year || undefined,
    board: cq.board || undefined,
  }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params

    const cq = await db.cQ.findUnique({
      where: { id, isActive: true },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            slug: true,
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!cq) {
      return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    }

    if (cq.isPremium) {
      const auth = await verifyAuth()
      const userId = auth?.user.id

      // Anonymous users get preview metadata — never redirect to login
      if (!userId) {
        return NextResponse.json({
          success: true,
          data: {
            id: cq.id,
            uddeepok: cq.uddeepok,
            isPremium: true,
            price: cq.price,
            chapterId: cq.chapterId,
            chapterName: cq.chapter?.name || '',
            subjectName: cq.chapter?.subject?.name || '',
            className: cq.chapter?.subject?.class?.name || '',
            classSlug: cq.chapter?.subject?.class?.slug || '',
            hasAccess: false,
          },
        }, { headers: cacheHeaders.noCache })
      }

      const access = await checkContentAccess({
        userId,
        contentType: 'cq',
        contentId: id,
      })

      if (!access.hasAccess) {
    // Premium content without access — return metadata only
        return NextResponse.json({
          success: true,
          data: {
            id: cq.id,
            uddeepok: cq.uddeepok,
            isPremium: true,
            price: cq.price,
            chapterId: cq.chapterId,
            chapterName: cq.chapter?.name || '',
            subjectName: cq.chapter?.subject?.name || '',
            className: cq.chapter?.subject?.class?.name || '',
            classSlug: cq.chapter?.subject?.class?.slug || '',
            hasAccess: false,
            pendingPayment: access.pendingPayment,
          },
        }, { headers: cacheHeaders.noCache })
      }
    }

    return NextResponse.json({ success: true, data: transformCQ(cq as unknown as Parameters<typeof transformCQ>[0]) }, { headers: cacheHeaders.noCache })
  } catch (error) {
    return handleApiError(error, 'Get CQ detail error')
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const auth = await verifyAuth(request)
    if (!auth?.user || !['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)) {
      return apiError('CQ আপডেট করার অনুমতি নেই', 403)
    }

    const { id } = await props.params
    const body = await request.json()

    const existingCq = await db.cQ.findUnique({ where: { id } })

    if (!existingCq) {
      return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    }

    const cq = await db.cQ.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: buildPremiumUpdatePayload(body) as any,
    })

    return NextResponse.json({ success: true, data: { message: 'CQ আপডেট হয়েছে', cq } })
  } catch (error) {
    return handleApiError(error, 'Update CQ error')
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const auth = await verifyAuth(request)
    if (!auth?.user || !['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)) {
      return apiError('CQ মুছে ফেলার অনুমতি নেই', 403)
    }

    const { id } = await props.params

    const existingCq = await db.cQ.findUnique({ where: { id } })

    if (!existingCq) {
      return apiError('CQ খুঁজে পাওয়া যায়নি', 404)
    }

    await db.cQ.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, data: { message: 'CQ সফলভাবে মুছে ফেলা হয়েছে' } })
  } catch (error) {
    return handleApiError(error, 'Delete CQ error')
  }
}
