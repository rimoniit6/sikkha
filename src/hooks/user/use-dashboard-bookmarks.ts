'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { bookmarkService, type BookmarkItem } from '@/services/api/bookmark.service'
import type { BookmarkData, RecentlyViewedItem } from '@/types/user-dashboard'

interface UseDashboardBookmarksResult {
  loadingBookmarks: boolean
  realBookmarks: BookmarkData[]
  realRecentlyViewed: RecentlyViewedItem[]
  deleteBookmark: (contentId: string, contentType: string) => Promise<void>
}

/**
 * Fetches bookmarks and recently viewed content.
 */
export function useDashboardBookmarks(): UseDashboardBookmarksResult {
  const user = useAuthUser()
  const [loadingBookmarks, setLoadingBookmarks] = useState(false)
  const [realBookmarks, setRealBookmarks] = useState<BookmarkData[]>([])
  const [realRecentlyViewed, setRealRecentlyViewed] = useState<RecentlyViewedItem[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const fetchBookmarksAndRecent = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return
    setLoadingBookmarks(true)
    try {
      const [bookmarksJson, recentJson] = await Promise.all([
        bookmarkService.list({ limit: 50 }),
        api.get<{ items: RecentlyViewedItem[] }>('recently-viewed', { limit: 10 }, { signal }),
      ])
      if (!signal?.aborted) {
        const rawBookmarks: BookmarkItem[] = bookmarksJson?.bookmarks || []
        setRealBookmarks(rawBookmarks.map((b) => ({
          id: b.id,
          contentId: b.contentId,
          contentType: b.contentType,
          contentTitle: b.title || '',
          createdAt: b.createdAt,
        })))
        setRealRecentlyViewed(recentJson.items || [])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('[useDashboardBookmarks] Failed to fetch:', err)
    } finally {
      if (!signal?.aborted) {
        setLoadingBookmarks(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    fetchBookmarksAndRecent(controller.signal)
    return () => { controller.abort() }
  }, [fetchBookmarksAndRecent])

  const deleteBookmark = useCallback(async (contentId: string, contentType: string) => {
    try {
      await bookmarkService.remove(contentId, contentType)
      setRealBookmarks(prev => prev.filter(b => !(b.contentId === contentId && b.contentType === contentType)))
    } catch { /* ignore */ }
  }, [])

  return { loadingBookmarks, realBookmarks, realRecentlyViewed, deleteBookmark }
}
