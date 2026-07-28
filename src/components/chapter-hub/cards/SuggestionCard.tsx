'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SuggestionItem } from '@/hooks/use-chapter-content'
import { cn } from '@/lib/utils'
import { EyeIcon, FileText } from 'lucide-react'
import { PurchaseStatusBadge } from '@/components/shared/PurchaseStatusBadge'
import type { AccessStatus } from '@/components/shared/PurchaseStatusBadge'

interface SuggestionCardProps {
  suggestion: SuggestionItem
  index: number
  isPurchased?: boolean
  pendingPayment?: boolean
  rejected?: boolean
  onUnlock?: () => void
  onView?: () => void
}

function getAccessStatus(isPurchased: boolean, isLocked: boolean, pendingPayment: boolean, rejected: boolean): AccessStatus {
  if (isPurchased) return 'purchased'
  if (pendingPayment) return 'pending'
  if (rejected) return 'rejected'
  if (isLocked) return 'locked'
  return 'free'
}

export function SuggestionCard({ suggestion, index, isPurchased = false, pendingPayment = false, rejected = false, onUnlock, onView }: SuggestionCardProps) {
  const isLocked = suggestion.isPremium && !isPurchased
  const accessStatus = getAccessStatus(isPurchased, isLocked, pendingPayment, rejected)
  const isFree = accessStatus === 'free'
  const isPending = accessStatus === 'pending'
  const isRejected = accessStatus === 'rejected'

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <Card
        className={cn(
          'border-border/50 transition-all duration-300 overflow-hidden',
          !isLocked && 'cursor-pointer hover:border-border/80',
        )}
        onClick={!isLocked ? onView : undefined}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                'p-2.5 rounded-xl shrink-0',
                isFree ? 'bg-indigo-50 dark:bg-indigo-950/30' :
                isRejected ? 'bg-rose-50 dark:bg-rose-950/30' :
                'bg-amber-50 dark:bg-amber-950/30',
              )}>
                <FileText className={cn(
                  'h-5 w-5',
                  isFree ? 'text-indigo-600 dark:text-indigo-400' :
                  isRejected ? 'text-rose-600 dark:text-rose-400' :
                  'text-amber-600 dark:text-amber-400',
                )} />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm sm:text-base truncate">{suggestion.title}</h4>
              </div>
            </div>

            <PurchaseStatusBadge state={accessStatus} size="sm" />
          </div>

          <div className="flex gap-2 mt-4">
            {accessStatus === 'locked' && (
              <Button size="sm" variant="outline" onClick={onUnlock} className="rounded-lg text-xs h-8">
                কিনুন
              </Button>
            )}
            {isPending && (
              <Button size="sm" variant="outline" disabled className="rounded-lg text-xs h-8">
                যাচাই চলছে
              </Button>
            )}
            {isRejected && (
              <Button size="sm" variant="outline" onClick={onUnlock} className="rounded-lg text-xs h-8">
                আবার পেমেন্ট করুন
              </Button>
            )}
            {(isFree || accessStatus === 'purchased') && (
              <Button size="sm" onClick={onView} className="rounded-lg text-xs h-8">
                <EyeIcon className="h-3 w-3 mr-1" /> দেখুন
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
