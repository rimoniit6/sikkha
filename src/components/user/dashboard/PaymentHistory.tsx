'use client'

import { memo } from 'react'
import { CreditCard, CheckCircle2, AlertCircle, XCircle, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useContentTypes } from '@/hooks/use-content-types'
import { useVirtualList } from '@/hooks/use-virtual-list'
import { DetailedPayment } from '@/types/user-dashboard'
import {
  categoryConfig,
  getPurchaseCategory,
  methodLabels,
} from './DashboardConstants'

interface PaymentHistoryProps {
  payments: DetailedPayment[]
  approvedPaymentsCount: number
  pendingPaymentsCount: number
  rejectedPaymentsCount: number
}

// ── Standalone memo'd payment card ───────────────────────────────────────────

interface PaymentCardProps {
  payment: DetailedPayment
}

const PaymentCard = memo(function PaymentCard({ payment }: PaymentCardProps) {
  const { getLabel, getIcon, getTextColor, getLightColor } = useContentTypes()

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <CheckCircle2 className="size-3.5 text-emerald-500" />
      case 'pending': return <AlertCircle className="size-3.5 text-amber-500" />
      case 'rejected': return <XCircle className="size-3.5 text-red-500" />
      default: return <AlertCircle className="size-3.5 text-muted-foreground" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'অনুমোদিত'
      case 'pending': return 'অপেক্ষমাণ'
      case 'rejected': return 'প্রত্যাখ্যাত'
      default: return status
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30'
      case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30'
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200/50 dark:border-red-800/30'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const ContentIcon = getIcon(payment.contentType)
  const category = getPurchaseCategory(payment.contentType)
  const config = categoryConfig[category]
  const CategoryIcon = config.icon

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg shrink-0', `${getLightColor(payment.contentType)} ${getTextColor(payment.contentType)}`)}>
            <ContentIcon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-1">{payment.contentTitle}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={cn('text-[9px] h-4.5 px-1.5 gap-0.5', config.badgeClass)}>
                <CategoryIcon className="size-2.5" />
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 font-medium">
                {getLabel(payment.contentType) || payment.contentType}
              </Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="size-2.5" />
                {formatDate(payment.createdAt)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {methodLabels[payment.method] || payment.method}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <p className="font-bold text-sm">৳{payment.amount}</p>
            <Badge className={cn('text-[9px] h-5 px-1.5 gap-0.5', getStatusBadgeClass(payment.status))}>
              {getStatusIcon(payment.status)}
              {getStatusLabel(payment.status)}
            </Badge>
          </div>
        </div>
        {payment.adminNote && (
          <p className="text-xs text-muted-foreground mt-2 pl-11 italic">
            📝 {payment.adminNote}
          </p>
        )}
      </CardContent>
    </Card>
  )
})

// ── Main PaymentHistory Component ────────────────────────────────────────────

export function PaymentHistory({
  payments,
  approvedPaymentsCount,
  pendingPaymentsCount,
  rejectedPaymentsCount,
}: PaymentHistoryProps) {
  // Virtualization for long payment lists
  const { containerRef, visibleItems, totalHeight, offsetY } = useVirtualList({
    items: payments,
    itemHeight: 140,
    overscan: 3,
  })

  const hasBadges = approvedPaymentsCount > 0 || pendingPaymentsCount > 0 || rejectedPaymentsCount > 0

  return (
    <div className="mt-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
            <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          পেমেন্ট ইতিহাস
        </h3>
        {hasBadges && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {approvedPaymentsCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 border-emerald-200/50 dark:border-emerald-800/30">
                <CheckCircle2 className="size-3" /> {approvedPaymentsCount}টি অনুমোদিত
              </Badge>
            )}
            {pendingPaymentsCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1 border-amber-200/50 dark:border-amber-800/30">
                <AlertCircle className="size-3" /> {pendingPaymentsCount}টি অপেক্ষমাণ
              </Badge>
            )}
            {rejectedPaymentsCount > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 gap-1 border-red-200/50 dark:border-red-800/30">
                <XCircle className="size-3" /> {rejectedPaymentsCount}টি প্রত্যাখ্যাত
              </Badge>
            )}
          </div>
        )}
      </div>

      {payments.length === 0 ? (
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-40" />
          <CardContent className="p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 flex items-center justify-center mb-4">
              <CreditCard className="size-8 text-emerald-400 dark:text-emerald-500" />
            </div>
            <p className="font-semibold text-lg">কোনো পেমেন্ট নেই</p>
            <p className="text-sm text-muted-foreground mt-1.5">কন্টেন্ট কিনলে এখানে দেখাবে</p>
          </CardContent>
        </Card>
      ) : (
        <div
          ref={containerRef}
          className="space-y-3 max-h-[600px] overflow-y-auto pr-1"
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleItems.map((payment) => (
                <div key={payment.id} className="mb-3">
                  <PaymentCard payment={payment} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
