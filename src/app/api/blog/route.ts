import { db } from '@/lib/db'
import { apiResponse, apiError, paginatedApiResponse, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if (rateCheck) return rateCheck

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const author = searchParams.get('author')
    const search = searchParams.get('search')
    const featured = searchParams.get('featured')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      isActive: true,
      deletedAt: null,
      publishedAt: { lte: new Date() },
    }

    if (category) {
      where.category = { slug: category }
    }
    if (tag) {
      where.tags = { some: { tag: { slug: tag } } }
    }
    if (author) {
      where.authorId = author
    }
    if (featured === 'true') {
      where.isFeatured = true
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      db.blogPost.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.blogPost.count({ where }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Get Blog Posts')
  }
}
