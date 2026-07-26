'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { DashboardData } from '@/types/user-dashboard'

interface UseDashboardStatsResult {
  loading: boolean
  dashboardData: DashboardData | null
}

const FALLBACK_DATA: DashboardData = {
  stats: { completedLectures: 0, totalLectures: 0, avgMcqScore: 0, savedQuestions: 0, isPremium: false, premiumExpiry: null },
  recentExams: [],
}

/**
 * Fetches dashboard stats (completed lectures, exam scores, etc.) via React Query.
 * Uses a shared query key ['user', 'dashboard'] so that any component on any page
 * using this hook gets the same cached data — no duplicate network requests.
 */
export function useDashboardStats(): UseDashboardStatsResult {
  const user = useAuthUser()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: queryKeys.dashboard(),
    queryFn: async ({ signal }) => {
      return api.get<DashboardData>('user/dashboard', undefined, { signal })
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    loading: isLoading,
    dashboardData: data ?? FALLBACK_DATA,
  }
}
