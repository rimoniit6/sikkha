import { db } from '@/lib/db'
import { apiError, withAdmin } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'
import {
  getFeaturedRegistration,
} from '@/lib/featured-content-registry'

export async function GET(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof Response) return auth
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'lecture'
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    interface ContentItem {
      id: string
      title: string
      subtitle?: string | null
      thumbnail?: string | null
      isPremium?: boolean
      extra?: Record<string, unknown>
    }

    const items: ContentItem[] = []

    const reg = getFeaturedRegistration(type)
    if (!reg) {
      return apiError(`অবৈধ কন্টেন্ট টাইপ: ${type}`, 400)
    }

    // Build the Prisma where clause from search fields
    const where: Record<string, unknown> = {}
    if (query) {
      where.OR = reg.searchFields.map((field) => ({ [field]: { contains: query, mode: 'insensitive' } }))
    }

    const model = (db as Record<string, unknown>)[reg.modelKey] as
      | { findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>> }
      | undefined

    if (!model) {
      return apiError(`কন্টেন্ট টাইপ ${type} এর জন্য মডেল পাওয়া যায়নি`, 500)
    }

    const results = await model.findMany({
      where,
      include: reg.include,
      take: limit,
      orderBy: { createdAt: 'desc' as const },
    })

    for (const entry of results) {
      items.push({
        id: entry.id as string,
        title: reg.getTitle(entry),
        subtitle: reg.getSearchSubtitle(entry),
        thumbnail: reg.getThumbnail(entry),
        isPremium: reg.isPremium(entry),
        extra: reg.getSearchExtra?.(entry),
      })
    }

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    return handleApiError(error, 'Admin Search Content error:')
  }
}
