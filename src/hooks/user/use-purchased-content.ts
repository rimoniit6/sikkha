'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'
import { getPurchaseCategory } from '@/components/user/dashboard/DashboardConstants'
import type { DetailedPayment, SubscriptionData } from '@/types/user-dashboard'

interface UsePurchasedContentResult {
  loadingPayments: boolean
  payments: DetailedPayment[]
  approvedPayments: DetailedPayment[]
  subscriptionPayments: DetailedPayment[]
  bundlePayments: DetailedPayment[]
  individualPayments: DetailedPayment[]
  pendingPayments: DetailedPayment[]
  rejectedPayments: DetailedPayment[]
  activeSubscriptions: SubscriptionData[]
}

/**
 * Fetches and categorizes payment + subscription data.
 */
export function usePurchasedContent(): UsePurchasedContentResult {
  const user = useAuthUser()
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [payments, setPayments] = useState<DetailedPayment[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const fetchPayments = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return
    setLoadingPayments(true)
    try {
      const [paymentsData, subsData] = await Promise.all([
        api.get<DetailedPayment[] | { payments?: DetailedPayment[] }>(
          'user/payments',
          undefined,
          { retries: 1, retryDelay: 1500, signal }
        ),
        api.get<{ subscriptions: SubscriptionData[]; activeCount: number; expiringSoon: { id: string; daysRemaining: number }[] }>('user/subscriptions', undefined, { signal }),
      ])
      if (!signal?.aborted) {
        setPayments(Array.isArray(paymentsData) ? paymentsData : paymentsData?.payments || [])
        setSubscriptions(subsData?.subscriptions || [])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('[usePurchasedContent] Failed to fetch:', err)
    } finally {
      if (!signal?.aborted) {
        setLoadingPayments(false)
      }
    }
  }, [user?.id])

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    fetchPayments(controller.signal)
    return () => { controller.abort() }
  }, [fetchPayments])

  const categorizedPayments = useMemo(() => {
    const approved = payments.filter(p => p.status?.toLowerCase() === 'approved')
    return {
      approvedPayments: approved,
      subscriptionPayments: approved.filter(p => getPurchaseCategory(p.contentType) === 'subscription'),
      bundlePayments: approved.filter(p => getPurchaseCategory(p.contentType) === 'bundle'),
      individualPayments: approved.filter(p => getPurchaseCategory(p.contentType) === 'individual'),
      pendingPayments: payments.filter(p => p.status?.toLowerCase() === 'pending'),
      rejectedPayments: payments.filter(p => p.status?.toLowerCase() === 'rejected'),
    }
  }, [payments])

  const activeSubscriptions = useMemo(
    () => subscriptions.filter(s => s.isActive && !s.isExpired),
    [subscriptions]
  )

  return {
    loadingPayments,
    payments,
    ...categorizedPayments,
    activeSubscriptions,
  }
}
