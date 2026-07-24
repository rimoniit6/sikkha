import { db } from '@/lib/db'
import { apiResponse, apiError, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if (rateCheck) return rateCheck

    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(10, Math.max(1, parseInt(searchParams.get('limit') || '3')))

    const post = await db.blogPost.findUnique({
      where: { slug },
      select: { id: true, categoryId: true },
    })

    if (!post) {
      return apiError('ব্লগ পোস্ট খুঁজে পাওয়া যায়নি', 404)
    }

    const data = await db.blogPost.findMany({
      where: {
        id: { not: post.id },
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
        publishedAt: { lte: new Date() },
        OR: post.categoryId
          ? [
              { categoryId: post.categoryId },
              { tags: { some: { post: { id: post.id } } } },
            ]
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
    })

    return apiResponse(data)
  } catch (error) {
    return handleApiError(error, 'Get Related Blog Posts')
  }
}
