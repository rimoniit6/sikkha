'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/fetch-json'
import { queryKeys } from '@/lib/query-keys'

// ─── Types ───

export interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  isRead: boolean
  link: string | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Hooks ───

/**
 * Fetch notifications for the current student.
 */
export function useNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true')

  const queryString = searchParams.toString()
  const url = `/api/student/notifications${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: async () => {
      const json = await fetchJSON<{ data: NotificationsResponse }>(url)
      return json.data
    },
  })
}

/**
 * Fetch only the unread count (lightweight polling).
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const json = await fetchJSON<{ data: { unreadCount: number } }>('/api/student/notifications?limit=1')
      return json.data.unreadCount
    },
    refetchInterval: 30000, // Poll every 30 seconds
  })
}

/**
 * Mark notification(s) as read.
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { ids?: string[]; markAll?: boolean }) => {
      const json = await fetchJSON<{ data: { marked: boolean | number } }>('/api/student/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      return json.data
    },
    onSuccess: () => {
      // Invalidate all notification queries to refetch
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] })
    },
  })
}
