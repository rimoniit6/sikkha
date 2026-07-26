import { useState, useCallback } from 'react'
import { useAuthUser } from '@/store/auth'
import { useDashboardStats } from './use-dashboard-stats'
import { usePurchasedContent } from './use-purchased-content'
import { useDashboardBookmarks } from './use-dashboard-bookmarks'
import { useDashboardProfile } from './use-dashboard-profile'
import { useDashboardNavigation } from './use-dashboard-navigation'

/**
 * Composes all dashboard sub-hooks into a single return contract.
 * Preserves the original API for UserDashboardPage while keeping
 * each concern in its own focused hook.
 */
export function useUserDashboard() {
  const user = useAuthUser()
  const [activeTab, setActiveTab] = useState<string>('purchased')

  const stats = useDashboardStats()
  const purchases = usePurchasedContent()
  const bookmarks = useDashboardBookmarks()
  const profile = useDashboardProfile()
  const navigation = useDashboardNavigation()

  return {
    user,
    loading: stats.loading,
    dashboardData: stats.dashboardData,
    payments: purchases.payments,
    subscriptions: [], // subscriptions are inside purchases hook
    loadingPayments: purchases.loadingPayments,
    activeTab,
    setActiveTab,
    bundleDialogOpen: navigation.bundleDialogOpen,
    setBundleDialogOpen: navigation.setBundleDialogOpen,
    selectedBundleTitle: navigation.selectedBundleTitle,
    bundleItems: navigation.bundleItems,
    loadingBundleItems: navigation.loadingBundleItems,
    realBookmarks: bookmarks.realBookmarks,
    loadingBookmarks: bookmarks.loadingBookmarks,
    realRecentlyViewed: bookmarks.realRecentlyViewed,
    editProfileOpen: profile.editProfileOpen,
    setEditProfileOpen: profile.setEditProfileOpen,
    editName: profile.editName,
    setEditName: profile.setEditName,
    editMobile: profile.editMobile,
    setEditMobile: profile.setEditMobile,
    updatingProfile: profile.updatingProfile,
    navigateToContent: navigation.navigateToContent,
    handleEditProfile: profile.handleEditProfile,
    openEditProfile: profile.openEditProfile,
    deleteBookmark: bookmarks.deleteBookmark,
    approvedPayments: purchases.approvedPayments,
    subscriptionPayments: purchases.subscriptionPayments,
    bundlePayments: purchases.bundlePayments,
    individualPayments: purchases.individualPayments,
    pendingPayments: purchases.pendingPayments,
    rejectedPayments: purchases.rejectedPayments,
    activeSubscriptions: purchases.activeSubscriptions,
  }
}
