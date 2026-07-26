'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface RecentLecture {
  id: string
  title: string
  subject: string
  chapter?: string
  progress: number
  viewedAt?: string
}

interface UseRecentLecturesResult {
  data: RecentLecture[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches the user's recently viewed lectures via React Query.
 * Uses a shared query key ['user', 'recent-lectures'] so that
 * ResumeLearningSection and UserDashboardPage share the same cached data.
 */
export function useRecentLectures(options: { enabled?: boolean } = {}): UseRecentLecturesResult {
  const { enabled = true } = options
  const user = useAuthUser()

  const { data, isLoading, error, refetch } = useQuery<RecentLecture[]>({
    queryKey: queryKeys.recentLectures(),
    queryFn: async ({ signal }) => {
      const response = await api.get<RecentLecture[]>('user/recent-lectures', undefined, { signal })
      return Array.isArray(response) ? response : []
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    data: data ?? [],
    loading: isLoading,
    error: error ? 'সাম্প্রতিক লেকচার লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
  }
}
