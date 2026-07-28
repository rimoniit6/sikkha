'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ExamItem } from '@/hooks/use-chapter-content'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Clock, FileQuestion, Play } from 'lucide-react'
import { PurchaseStatusBadge } from '@/components/shared/PurchaseStatusBadge'
import type { AccessStatus } from '@/components/shared/PurchaseStatusBadge'

interface ExamCardProps {
  exam: ExamItem
  index: number
  isPurchased?: boolean
  pendingPayment?: boolean
  rejected?: boolean
  onUnlock?: () => void
  onStart?: () => void
}

function getAccessStatus(isPurchased: boolean, isLocked: boolean, pendingPayment: boolean, rejected: boolean): AccessStatus {
  if (isPurchased) return 'purchased'
  if (pendingPayment) return 'pending'
  if (rejected) return 'rejected'
  if (isLocked) return 'locked'
  return 'free'
}

export function ExamCard({ exam, index, isPurchased = false, pendingPayment = false, rejected = false, onUnlock, onStart }: ExamCardProps) {
  const isLocked = exam.isPremium && !isPurchased
  const accessStatus = getAccessStatus(isPurchased, isLocked, pendingPayment, rejected)
  const isFree = accessStatus === 'free'
  const isPending = accessStatus === 'pending'
  const isRejected = accessStatus === 'rejected'

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <Card className="border-border/50 hover:border-border/80 transition-all duration-300 overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground uppercase font-medium">
                  {exam.type}
                </span>
                <PurchaseStatusBadge state={accessStatus} size="sm" />
              </div>
              <h4 className="font-medium text-sm sm:text-base truncate">{exam.title}</h4>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileQuestion className="h-3 w-3" />
                  {toBengaliNumerals(exam.totalQuestions)} প্রশ্ন
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {exam.duration} মিনিট
                </span>
                {exam.totalMarks > 0 && (
                  <span>{toBengaliNumerals(exam.totalMarks)} নম্বর</span>
                )}
              </div>
            </div>

            <div className="shrink-0">
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
                <Button size="sm" onClick={onStart} className="rounded-lg text-xs h-8">
                  <Play className="h-3 w-3 mr-1" /> শুরু করুন
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
