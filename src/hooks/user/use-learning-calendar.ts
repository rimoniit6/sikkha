'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { LearningCalendarResponse } from '@/types/learning-calendar'

interface UseLearningCalendarOptions {
  year?: number
  month?: number
  enabled?: boolean
}

interface UseLearningCalendarResult {
  year: number
  month: number
  data: LearningCalendarResponse['month'] | null
  loading: boolean
  error: string | null
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToToday: () => void
  refetch: () => void
}

/**
 * Fetches a GitHub-style activity calendar for the requested month.
 * Supports month navigation via goToPrevMonth / goToNextMonth.
 *
 * @example
 * ```tsx
 * const { data, loading, goToPrevMonth, goToNextMonth } = useLearningCalendar()
 * ```
 */
export function useLearningCalendar(
  options: UseLearningCalendarOptions = {},
): UseLearningCalendarResult {
  const user = useAuthUser()
  const now = new Date()
  const [year, setYear] = useState(options.year ?? now.getFullYear())
  const [month, setMonth] = useState(options.month ?? now.getMonth() + 1)
  const { enabled = true } = options

  const queryKey = queryKeys.student.calendar(year, month)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      return api.get<LearningCalendarResponse>('user/learning-calendar', {
        year: String(year),
        month: String(month),
      })
    },
    enabled: !!user?.id && enabled,
    staleTime: 5 * 60 * 1000,
  })

  const goToPrevMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 1) {
        setYear(y => y - 1)
        return 12
      }
      return prev - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 12) {
        setYear(y => y + 1)
        return 1
      }
      return prev + 1
    })
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }, [])

  return {
    year,
    month,
    data: data?.month ?? null,
    loading: isLoading,
    error: error ? (error as Error).message || 'ক্যালেন্ডার লোড করতে সমস্যা হয়েছে।' : null,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    refetch,
  }
}
