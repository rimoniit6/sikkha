'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { RevisionData, RevisionUpdateRequest } from '@/types/user-dashboard'

interface UseRevisionQueueOptions {
  enabled?: boolean
}

interface UseRevisionQueueResult {
  data: RevisionData | null
  loading: boolean
  error: string | null
  refetch: () => void
  /** Mark a revision item as reviewed with a quality score */
  completeRevision: (id: string, quality: 0 | 1 | 2 | 3) => Promise<boolean>
  /** Skip a revision item (move to tomorrow) */
  skipRevision: (id: string) => Promise<boolean>
}

/**
 * Fetches the student's spaced-repetition revision queue.
 * Provides actions to complete or skip revision items.
 */
export function useRevisionQueue(options: UseRevisionQueueOptions = {}): UseRevisionQueueResult {
  const { enabled = true } = options
  const user = useAuthUser()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<RevisionData>({
    queryKey: queryKeys.student.revision(),
    queryFn: async ({ signal }) => {
      return api.get<RevisionData>('user/revision', undefined, { signal })
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const completeMutation = useMutation({
    mutationFn: async ({ id, quality }: { id: string; quality: 0 | 1 | 2 | 3 }) => {
      return api.patch<{ updated: boolean }>('user/revision', { id, quality } as RevisionUpdateRequest)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.student.revision() })
    },
  })

  const skipMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return api.patch<{ updated: boolean }>('user/revision', { id, skip: true } as RevisionUpdateRequest)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.student.revision() })
    },
  })

  const completeRevision = async (id: string, quality: 0 | 1 | 2 | 3): Promise<boolean> => {
    try {
      await completeMutation.mutateAsync({ id, quality })
      return true
    } catch (err) {
      console.error('[useRevisionQueue] Failed to update:', err)
      return false
    }
  }

  const skipRevision = async (id: string): Promise<boolean> => {
    try {
      await skipMutation.mutateAsync({ id })
      return true
    } catch (err) {
      console.error('[useRevisionQueue] Failed to skip:', err)
      return false
    }
  }

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? 'রিভিশন কিউ লোড করতে সমস্যা হয়েছে।' : null,
    refetch,
    completeRevision,
    skipRevision,
  }
}
