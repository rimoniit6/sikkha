import { db } from '@/lib/db'
import { paginatedApiResponse } from '@/lib/api-utils'
import { toDecimal } from '@/lib/decimal'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let classLevel = searchParams.get('classLevel')
    if (!classLevel) {
      const auth = await verifyAuth(request)
      if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
        classLevel = auth.user.classLevel
      }
    }
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isActive: true }

    if (classLevel) where.classLevel = classLevel
    if (type) where.type = type
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      db.contentBundle.findMany({
        where,
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.contentBundle.count({ where }),
    ])

    // Enrich items with content titles for display
    const enrichedData = await Promise.all(
      data.map(async (bundle) => {
        const mcqIds = bundle.items.filter((i) => i.contentType === 'MCQ').map((i) => i.contentId)
        const cqIds = bundle.items.filter((i) => i.contentType === 'CQ').map((i) => i.contentId)
        const lectureIds = bundle.items.filter((i) => i.contentType === 'lecture').map((i) => i.contentId)
        const suggestionIds = bundle.items.filter((i) => i.contentType === 'suggestion').map((i) => i.contentId)
        const examIds = bundle.items.filter((i) => i.contentType === 'exam').map((i) => i.contentId)

        const [mcqs, cqs, lectures, suggestions, exams] = await Promise.all([
          mcqIds.length > 0
            ? db.mCQ.findMany({ where: { id: { in: mcqIds } }, select: { id: true, question: true, price: true } })
            : [],
          cqIds.length > 0
            ? db.cQ.findMany({ where: { id: { in: cqIds } }, select: { id: true, uddeepok: true, price: true } })
            : [],
          lectureIds.length > 0
            ? db.lecture.findMany({ where: { id: { in: lectureIds } }, select: { id: true, title: true, price: true, thumbnail: true } })
            : [],
          suggestionIds.length > 0
            ? db.suggestion.findMany({ where: { id: { in: suggestionIds } }, select: { id: true, title: true, price: true, thumbnail: true } })
            : [],
          examIds.length > 0
            ? db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true, price: true } })
            : [],
        ])

        const contentMap = new Map<string, { title: string; price: number; thumbnail?: string | null }>()
        mcqs.forEach((m) => contentMap.set(m.id, { title: m.question.slice(0, 80), price: Number(m.price) }))
        cqs.forEach((c) => contentMap.set(c.id, { title: c.uddeepok.slice(0, 80), price: Number(c.price) }))
        lectures.forEach((l) => contentMap.set(l.id, { title: l.title, price: Number(l.price), thumbnail: l.thumbnail }))
        suggestions.forEach((s) => contentMap.set(s.id, { title: s.title, price: Number(s.price), thumbnail: s.thumbnail }))
        exams.forEach((e) => contentMap.set(e.id, { title: e.title, price: Number(e.price) }))

        const enrichedItems = bundle.items.map((item) => ({
          ...item,
          contentTitle: contentMap.get(item.contentId)?.title || null,
          contentPrice: contentMap.get(item.contentId)?.price || 0,
          contentThumbnail: contentMap.get(item.contentId)?.thumbnail || null,
        }))

        const discount =
          toDecimal(bundle.originalPrice) > 0
            ? Math.round(((toDecimal(bundle.originalPrice) - toDecimal(bundle.price)) / toDecimal(bundle.originalPrice)) * 100)
            : 0

        return {
          id: bundle.id,
          title: bundle.title,
          slug: bundle.slug,
          description: bundle.description,
          thumbnail: bundle.thumbnail,
          price: bundle.price,
          originalPrice: bundle.originalPrice,
          isPremium: toDecimal(bundle.price) > 0 || toDecimal(bundle.originalPrice) > 0,
          discount,
          classLevel: bundle.classLevel,
          board: bundle.board,
          year: bundle.year,
          type: bundle.type,
          itemCount: bundle._count.items,
          items: enrichedItems,
          order: bundle.order,
          createdAt: bundle.createdAt,
        }
      })
    )

    return paginatedApiResponse(enrichedData, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Get Bundles error')
  }
}
