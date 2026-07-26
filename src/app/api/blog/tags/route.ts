import { db } from '@/lib/db'
import { apiResponse, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const data = await db.blogTag.findMany({
      include: { _count: { select: { posts: { where: { post: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } } } } } } },
      orderBy: { name: 'asc' },
    })
    return apiResponse(data.filter(t => t._count.posts > 0))
  } catch (error) {
    return handleApiError(error, 'Get Blog Tags')
  }
}
