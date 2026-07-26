'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { WeaknessData } from '@/types/user-dashboard'

interface UseWeaknessDetectionOptions {
  enabled?: boolean
}

interface UseWeaknessDetectionResult {
  data: WeaknessData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches personalized weakness detection data from the server.
 * Returns subjects/chapters where the student is struggling, sorted by severity.
 */
export function useWeaknessDetection(options: UseWeaknessDetectionOptions = {}): UseWeaknessDetectionResult {
  const { enabled = true } = options
  const user = useAuthUser()

  const { data, isLoading, error, refetch } = useQuery<WeaknessData>({
    queryKey: queryKeys.student.weaknesses(),
    queryFn: async ({ signal }) => {
      return api.get<WeaknessData>('user/weaknesses', undefined, { signal })
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? 'দুর্বলতা শনাক্ত করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
