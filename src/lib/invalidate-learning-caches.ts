/**
 * Centralized learning cache invalidation.
 *
 * After any learning progress mutation — lecture progress, exam submission,
 * bookmark toggle, CQ submission — call this function to immediately
 * refresh all learning-related React Query caches.
 *
 * Usage:
 *   const queryClient = useQueryClient()
 *   await fetch('/api/progress', { method: 'POST', ... })
 *   invalidateLearningCaches(queryClient)
 *
 * Invalidated keys:
 *   ['user', 'dashboard']
 *   ['user', 'recent-lectures']
 *   ['user', 'personalized-continue-learning']
 *   ['student', 'learning-dashboard']
 *   ['student', 'recommendations']
 *   ['student', 'revision']
 *   ['student', 'weaknesses']
 *   ['student', 'achievements']
 */

import { queryKeys } from './query-keys'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalidate all learning-related React Query caches.
 * Pass the QueryClient from `useQueryClient()`.
 *
 * Only refetches active queries (default behavior of `invalidateQueries`).
 * Background queries are marked stale and refetch when their component mounts.
 */
export function invalidateLearningCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
  queryClient.invalidateQueries({ queryKey: queryKeys.recentLectures() })
  queryClient.invalidateQueries({ queryKey: queryKeys.personalizedContinueLearning() })
  queryClient.invalidateQueries({ queryKey: queryKeys.student.learningDashboard() })
  queryClient.invalidateQueries({ queryKey: queryKeys.student.recommendations() })
  queryClient.invalidateQueries({ queryKey: queryKeys.student.revision() })
  queryClient.invalidateQueries({ queryKey: queryKeys.student.weaknesses() })
  queryClient.invalidateQueries({ queryKey: queryKeys.student.achievements() })
}
