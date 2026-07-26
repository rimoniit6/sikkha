'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
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
 * Fetches dashboard stats (completed lectures, exam scores, etc.).
 */
export function useDashboardStats(): UseDashboardStatsResult {
  const user = useAuthUser()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const response = await api.get<DashboardData>('user/dashboard', undefined, { signal })
      if (!signal?.aborted) {
        setDashboardData(response)
      }
    } catch {
      if (!signal?.aborted) {
        setDashboardData(FALLBACK_DATA)
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    fetchData(controller.signal)
    return () => { controller.abort() }
  }, [fetchData])

  return { loading, dashboardData }
}
