'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type {
  StudentAnalytics,
  AnalyticsPeriod,
} from '@/types/student-analytics'

interface UseStudentAnalyticsOptions {
  period?: AnalyticsPeriod
  from?: string
  to?: string
  enabled?: boolean
}

interface UseStudentAnalyticsResult {
  data: StudentAnalytics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches comprehensive personal analytics for the current student.
 * Supports time range filtering with period presets or custom dates.
 *
 * @example
 * ```tsx
 * const { data, loading } = useStudentAnalytics({ period: '30d' })
 * // or custom range
 * const { data } = useStudentAnalytics({ from: '2026-01-01', to: '2026-01-31' })
 * ```
 */
export function useStudentAnalytics(
  options: UseStudentAnalyticsOptions = {},
): UseStudentAnalyticsResult {
  const user = useAuthUser()
  const { period = '30d', from, to, enabled = true } = options

  const queryKey = queryKeys.analytics.students({
    period,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string> = { period }
      if (from) params.from = from
      if (to) params.to = to
      return api.get<StudentAnalytics>('user/analytics', params)
    },
    enabled: !!user?.id && enabled,
    // Cache analytics for 5 minutes — data doesn't change rapidly
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message || 'এনালাইটিক্স লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
