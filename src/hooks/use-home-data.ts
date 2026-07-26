'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/fetch-json'
import { queryKeys } from '@/lib/query-keys'

export interface NoticeItem {
  id: string
  title: string
  isPinned: boolean
  type: string
}

export interface ClassListItem {
  id: string
  name: string
  slug: string
  subjectCount: number
  icon: string
  gradient: string
  description: string | null
  color: string | null
  contentCounts: {
    lectures: number
    freeLectures: number
    mcqs: number
    freeMcqs: number
    cqs: number
    freeCqs: number
    boardQuestions: number
    freeBoardQuestions: number
  }
  totalContent: number
}

export interface FeaturedItem {
  id: string
  contentType: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  isPremium: boolean
  extra: Record<string, unknown>
}

export interface BoardQuestionFilterData {
  classLevels: {
    id: string
    name: string
    slug: string
    order: number
    gradient: string | null
    mcqCount: number
    cqCount: number
    boardCount: number
  }[]
  boards: {
    id: string
    name: string
    slug: string
    color: string | null
    hasData?: boolean
  }[]
  years: string[]
  subjects: {
    id: string
    name: string
    slug: string
  }[]
}

export interface PremiumPrices {
  minContentPrice: number | null
  minBundlePrice: number | null
}

export function useNotices(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.notices, limit] as const,
    queryFn: async () => {
      const json = await fetchJSON<{ data?: NoticeItem[] }>(`/api/notices?limit=${limit}`)
      const data = Array.isArray(json.data) ? json.data : []
      return [...data].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return 0
      })
    },
    select: (data) => data,
  })
}

export function useClassList() {
  return useQuery({
    queryKey: queryKeys.classes,
    queryFn: async () => {
      const json = await fetchJSON<{ data?: { classes?: ClassListItem[] } }>('/api/user/classes')
      return json.data?.classes || []
    },
    select: (data) => data,
  })
}

export function useFeaturedCourses() {
  return useQuery({
    queryKey: queryKeys.featuredCourses,
    queryFn: async () => {
      const json = await fetchJSON<{ success?: boolean; data?: { items?: FeaturedItem[] } }>('/api/courses/featured')
      return json.data?.items || []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => data,
  })
}

export function useBoardQuestionFilters() {
  return useQuery({
    queryKey: queryKeys.boardQuestionFilters,
    queryFn: async () => {
      const res = await fetchJSON<{ success?: boolean; data?: BoardQuestionFilterData }>('/api/board-questions/filters')
      // Unwrap { success, data } envelope
      const data = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res as BoardQuestionFilterData
      return {
        classLevels: data.classLevels || [],
        boards: data.boards || [],
        years: data.years || [],
        subjects: data.subjects || [],
      }
    },
    select: (data) => data,
  })
}

export function usePremiumPrices() {
  return useQuery({
    queryKey: queryKeys.premiumPrices,
    queryFn: async (): Promise<PremiumPrices> => {
      const [packagesRes, bundlesRes] = await Promise.all([
        fetchJSON<{ packages?: { price: number }[] }>('/api/packages?limit=1').catch(() => ({ packages: [] })),
        fetchJSON<{ data?: { price: number }[] }>('/api/bundles?limit=1').catch(() => ({ data: [] })),
      ])

      const packages = packagesRes.packages || []
      const bundles = Array.isArray(bundlesRes.data) ? bundlesRes.data : []

      let minContentPrice: number | null = null
      let minBundlePrice: number | null = null

      if (packages.length > 0) {
        const minPkg = packages.reduce((min, p) => Math.min(min, p.price), Infinity)
        if (minPkg !== Infinity) minContentPrice = minPkg
      }
      if (bundles.length > 0) {
        const minBnd = bundles.reduce((min, b) => Math.min(min, b.price), Infinity)
        if (minBnd !== Infinity) minBundlePrice = minBnd
      }

      return { minContentPrice, minBundlePrice }
    },
    select: (data) => data,
  })
}
