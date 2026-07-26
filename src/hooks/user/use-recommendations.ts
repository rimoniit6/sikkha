'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { RecommendationItem } from '@/types/user-dashboard'

interface UseRecommendationsOptions {
  enabled?: boolean
}

interface UseRecommendationsResult {
  data: RecommendationItem[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches personalized content recommendations from the server.
 * Returns an array of RecommendationItem (max 6), ordered by priority.
 */
export function useRecommendations(options: UseRecommendationsOptions = {}): UseRecommendationsResult {
  const { enabled = true } = options
  const user = useAuthUser()

  const { data, isLoading, error, refetch } = useQuery<RecommendationItem[]>({
    queryKey: queryKeys.student.recommendations(),
    queryFn: async ({ signal }) => {
      const response = await api.get<RecommendationItem[]>('user/recommendations', undefined, { signal })
      return Array.isArray(response) ? response : []
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error ? 'সাজেশন লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
