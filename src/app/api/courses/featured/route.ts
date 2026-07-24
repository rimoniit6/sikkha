import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'
import {
  getFeaturedRegistration,
  batchResolveFeaturedContent,
} from '@/lib/featured-content-registry'

export async function GET() {
  try {
    const featuredItems = await db.featuredContent.findMany({
      where: { section: 'homepage', isActive: true },
      orderBy: { order: 'asc' },
    })

    if (featuredItems.length === 0) {
      return NextResponse.json({ success: true, data: { items: [] } })
    }

    // Group by type for batch fetch
    const idsByType: Record<string, string[]> = {}
    const featuredMap: Record<string, Array<{ contentId: string; title: string | null; subtitle: string | null; thumbnail: string | null }>> = {}
    for (const f of featuredItems) {
      const ids = idsByType[f.contentType] || []
      ids.push(f.contentId)
      idsByType[f.contentType] = ids

      const list = featuredMap[f.contentType] || []
      list.push({ contentId: f.contentId, title: f.title, subtitle: f.subtitle, thumbnail: f.thumbnail })
      featuredMap[f.contentType] = list
    }

    // Batch-resolve all types in parallel using the registry
    const contentMaps = await Promise.all(
      Object.entries(idsByType).map(([type, ids]) =>
        batchResolveFeaturedContent(type, ids, db as never).then((map) => ({ type, map }))
      )
    )

    const contentLookup: Record<string, Record<string, Record<string, unknown>>> = {}
    for (const { type, map } of contentMaps) {
      contentLookup[type] = map
    }

    const items: Array<{
      id: string
      contentType: string
      title: string
      subtitle: string | null
      thumbnail: string | null
      isPremium: boolean
      extra: Record<string, unknown>
    }> = []

    for (const featured of featuredItems) {
      const entry = contentLookup[featured.contentType]?.[featured.contentId]
      if (!entry) continue

      const reg = getFeaturedRegistration(featured.contentType)
      if (!reg) continue

      const fList = featuredMap[featured.contentType]
      const f = Array.isArray(fList) ? fList.find((fi) => fi.contentId === featured.contentId) : undefined
      if (!f) continue

      items.push({
        id: entry.id as string,
        contentType: featured.contentType,
        title: f.title || reg.getTitle(entry),
        subtitle: f.subtitle || reg.getSubtitle(entry),
        thumbnail: f.thumbnail || reg.getThumbnail(entry),
        isPremium: reg.isPremium(entry),
        extra: reg.getSearchExtra?.(entry) || {},
      })
    }

    return NextResponse.json({ success: true, data: { items } })
  } catch (error) {
    return handleApiError(error, 'Get featured content error')
  }
}
