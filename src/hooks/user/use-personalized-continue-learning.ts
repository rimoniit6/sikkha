'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { FeaturedItem } from '@/hooks/use-home-data'

interface UsePersonalizedContinueLearningResult {
  items: FeaturedItem[]
  isLoading: boolean
  error: string | null
}

/**
 * Fetches personalized continue learning items for the authenticated user.
 * Uses a shared query key ['user', 'personalized-continue-learning'] so that
 * any component sharing this hook gets the same cached data.
 *
 * Fallback chain (server-side):
 *   1. Incomplete lectures (progress < 100%)
 *   2. Recently viewed lectures (not completed)
 *   3. Recommended content (same class + same subject)
 *   4. New lectures (last 14 days)
 *   5. Admin Featured content
 *   6. Random fallback (newest lectures)
 *
 * Max 10 items with daily seeded rotation for variety.
 */
export function usePersonalizedContinueLearning(): UsePersonalizedContinueLearningResult {
  const user = useAuthUser()

  const { data, isLoading, error } = useQuery<FeaturedItem[]>({
    queryKey: queryKeys.personalizedContinueLearning(),
    queryFn: async ({ signal }) => {
      const response = await api.get<{ success?: boolean; data?: { items?: FeaturedItem[] } }>(
        'user/personalized-continue-learning',
        undefined,
        { signal },
      )
      return response?.data?.items || []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    items: data ?? [],
    isLoading,
    error: error ? 'ব্যক্তিগতকৃত বিষয়বস্তু লোড করতে সমস্যা হয়েছে।' : null,
  }
}
