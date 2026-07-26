'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { LearningDashboardData } from '@/types/user-dashboard'

interface UseLearningDashboardOptions {
  enabled?: boolean
}

interface UseLearningDashboardResult {
  data: LearningDashboardData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useLearningDashboard(options: UseLearningDashboardOptions = {}): UseLearningDashboardResult {
  const { enabled = true } = options
  const user = useAuthUser()

  const { data, isLoading, error, refetch } = useQuery<LearningDashboardData>({
    queryKey: queryKeys.student.learningDashboard(),
    queryFn: async ({ signal }) => {
      return api.get<LearningDashboardData>('user/learning-dashboard', undefined, { signal })
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? 'লার্নিং ড্যাশবোর্ড লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
