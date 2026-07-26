'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { StudyInsightsResponse } from '@/types/study-insights'

interface UseStudyInsightsOptions {
  period?: string
  enabled?: boolean
}

interface UseStudyInsightsResult {
  data: StudyInsightsResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches comprehensive study insights for the current student.
 *
 * @example
 * ```tsx
 * const { data, loading } = useStudyInsights({ period: '30d' })
 * ```
 */
export function useStudyInsights(
  options: UseStudyInsightsOptions = {},
): UseStudyInsightsResult {
  const user = useAuthUser()
  const { period = '30d', enabled = true } = options

  const queryKey = queryKeys.student.insights({ period })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      return api.get<StudyInsightsResponse>('user/study-insights', { period })
    },
    enabled: !!user?.id && enabled,
    // Cache insights for 5 minutes
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message || 'ইনসাইট লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
