import { db } from '@/lib/db'
import { apiResponse, apiError, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if (rateCheck) return rateCheck

    const { slug } = await params

    const data = await db.blogPost.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    })

    if (!data || data.status !== 'PUBLISHED' || data.deletedAt) {
      return apiError('ব্লগ পোস্ট খুঁজে পাওয়া যায়নি', 404)
    }

    // Fetch related posts separately (not in schema include)
    const relatedPosts = await (db as any).blogPostRelated.findMany({
      where: { blogPostId: data.id },
      include: {
        relatedPost: {
          select: {
            id: true, title: true, slug: true, excerpt: true,
            featuredImage: true, publishedAt: true, readingTime: true,
            author: { select: { id: true, name: true, avatar: true } },
            category: { select: { id: true, name: true, slug: true, color: true } },
          },
        },
      },
      take: 3,
    })

    // Increment view count asynchronously
    db.blogPost.update({
      where: { id: data.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {})

    return apiResponse({ ...data, relatedPosts })
  } catch (error) {
    return handleApiError(error, 'Get Blog Post')
  }
}
