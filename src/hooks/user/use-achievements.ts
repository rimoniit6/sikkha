'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type {
  AchievementDashboardData,
  ClaimRewardResponse,
  CheckAchievementsResponse,
} from '@/types/achievements'

interface UseAchievementsOptions {
  enabled?: boolean
}

interface UseAchievementsResult {
  data: AchievementDashboardData | null
  loading: boolean
  error: string | null
  refetch: () => void
  claimReward: (achievementId: string) => Promise<ClaimRewardResponse>
  checkNow: () => Promise<CheckAchievementsResponse>
  claiming: boolean
  checking: boolean
}

/**
 * Hook for the Smart Achievement System.
 *
 * @example
 * ```tsx
 * const { data, loading, claimReward } = useAchievements()
 * ```
 */
export function useAchievements(options: UseAchievementsOptions = {}): UseAchievementsResult {
  const { enabled = true } = options
  const user = useAuthUser()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.student.achievements(),
    queryFn: () => api.get<AchievementDashboardData>('user/achievements'),
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
  })

  const claimMutation = useMutation({
    mutationFn: async (achievementId: string) => {
      return api.patch<ClaimRewardResponse>(`user/achievements/${achievementId}/claim`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.student.achievements() })
    },
  })

  const checkMutation = useMutation({
    mutationFn: async () => {
      return api.post<CheckAchievementsResponse>('user/achievements')
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.student.achievements() })
    },
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message || 'অর্জন লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
    claimReward: async (id: string) => {
      const result = await claimMutation.mutateAsync(id)
      return result
    },
    checkNow: async () => {
      const result = await checkMutation.mutateAsync()
      return result
    },
    claiming: claimMutation.isPending,
    checking: checkMutation.isPending,
  }
}
