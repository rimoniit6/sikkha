'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { RecentlyViewedItem } from '@/types/user-dashboard'

interface UseRecentlyViewedOptions {
  limit?: number
  enabled?: boolean
}

interface UseRecentlyViewedResult {
  data: RecentlyViewedItem[]
  loading: boolean
  error: string | null
}

/**
 * Fetches recently viewed content via React Query.
 * Uses a shared query key ['user', 'recently-viewed'] so that
 * RecentActivitySection and any other component get the same cached data.
 */
export function useRecentlyViewed(options: UseRecentlyViewedOptions = {}): UseRecentlyViewedResult {
  const { limit = 10, enabled = true } = options
  const user = useAuthUser()

  const { data, isLoading, error } = useQuery<RecentlyViewedItem[]>({
    queryKey: queryKeys.recentlyViewed(),
    queryFn: async ({ signal }) => {
      const response = await api.get<{ items: RecentlyViewedItem[] }>(
        'recently-viewed',
        { limit: String(limit) },
        { signal },
      )
      return Array.isArray(response?.items) ? response.items.slice(0, limit) : []
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error ? 'সাম্প্রতিক কার্যকলাপ লোড করতে সমস্যা হয়েছে।' : null,
  }
}
