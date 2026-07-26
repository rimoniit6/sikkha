'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouterStore } from '@/store/router'
import { api } from '@/lib/api-client'
import type { BundleItemData } from '@/types/user-dashboard'

interface UseDashboardNavigationResult {
  navigateToContent: (contentType: string, contentId: string) => void
  bundleDialogOpen: boolean
  setBundleDialogOpen: (open: boolean) => void
  selectedBundleTitle: string
  bundleItems: BundleItemData[]
  loadingBundleItems: boolean
}

/**
 * Handles content navigation and bundle dialog state.
 */
export function useDashboardNavigation(): UseDashboardNavigationResult {
  const navigate = useRouterStore((s) => s.navigate)
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false)
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)
  const [selectedBundleTitle, setSelectedBundleTitle] = useState('')
  const [bundleItems, setBundleItems] = useState<BundleItemData[]>([])
  const [loadingBundleItems, setLoadingBundleItems] = useState(false)

  const navigateToContent = useCallback((contentType: string, contentId: string) => {
    switch (contentType) {
      case 'mcq':
      case 'board-mcq':
        navigate('board-questions', { mcqId: contentId })
        break
      case 'cq':
      case 'board-cq':
        navigate('cq-viewer', { cqId: contentId })
        break
      case 'lecture':
        navigate('lecture-viewer', { lectureId: contentId })
        break
      case 'suggestion':
        navigate('suggestion-detail', { suggestionId: contentId })
        break
      case 'bundle':
        setSelectedBundleId(contentId)
        setSelectedBundleTitle('')
        setBundleDialogOpen(true)
        break
      case 'exam':
        navigate('exam-session', { examId: contentId })
        break
      case 'mcq-exam-package':
        navigate('mcq-exam-package-detail', { packageId: contentId })
        break
      default:
        if (contentId) navigate('home')
        break
    }
  }, [navigate])

  const fetchBundleItems = useCallback(async () => {
    if (!bundleDialogOpen || !selectedBundleId) return
    setLoadingBundleItems(true)
    try {
      const data = await api.get<{ items: BundleItemData[]; title: string }>(`bundles/${selectedBundleId}`)
      setSelectedBundleTitle(data.title || 'বান্ডেল')
      setBundleItems(data.items || [])
    } catch {
      setBundleItems([])
    } finally {
      setLoadingBundleItems(false)
    }
  }, [bundleDialogOpen, selectedBundleId])

  useEffect(() => { fetchBundleItems() }, [fetchBundleItems])

  return {
    navigateToContent,
    bundleDialogOpen,
    setBundleDialogOpen,
    selectedBundleTitle,
    bundleItems,
    loadingBundleItems,
  }
}
