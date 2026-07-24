import { db } from '@/lib/db'
import { apiResponse, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if (rateCheck) return rateCheck

    const data = await db.blogCategory.findMany({
      where: { isActive: true, deletedAt: null },
      include: { _count: { select: { posts: { where: { status: 'PUBLISHED', deletedAt: null } } } } },
      orderBy: { order: 'asc' },
    })
    return apiResponse(data.filter(c => c._count.posts > 0))
  } catch (error) {
    return handleApiError(error, 'Get Blog Categories')
  }
}
