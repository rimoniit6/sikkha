'use client'

import { memo, useMemo, useState } from 'react'
import {
  BookOpen, HelpCircle, FileText, Trophy, ArrowRight, Clock,
  CheckCircle2, SkipForward, AlertCircle, BrainCircuit, RotateCcw,
  Sparkles, ChevronDown,
} from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn, toBengaliNumerals } from '@/lib/utils'
import type { RevisionData, RevisionItem } from '@/types/user-dashboard'

// ─── Content type icon ───────────────────────────────────────────────

const contentTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  lecture: BookOpen,
  'mcq-chapter': HelpCircle,
  'cq-chapter': FileText,
  exam: Trophy,
}

const contentTypeLabel: Record<string, string> = {
  lecture: 'লেকচার',
  'mcq-chapter': 'MCQ',
  'cq-chapter': 'CQ',
  exam: 'পরীক্ষা',
}

// ─── Single revision card ────────────────────────────────────────────

interface RevisionCardProps {
  item: RevisionItem
  onComplete: (id: string, quality: 0 | 1 | 2 | 3) => void
  onSkip: (id: string) => void
}

const RevisionCard = memo(function RevisionCard({ item, onComplete, onSkip }: RevisionCardProps) {
  const [showQuality, setShowQuality] = useState(false)
  const navigate = useRouterStore((s) => s.navigate)
  const TypeIcon = contentTypeIcon[item.contentType] || BookOpen
  const label = contentTypeLabel[item.contentType] || 'কন্টেন্ট'

  const isDue = new Date(item.nextReviewAt) <= new Date()
  const daysUntilDue = Math.round(
    (new Date(item.nextReviewAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )

  const confidenceColor =
    item.confidenceScore >= 75 ? 'text-emerald-500' :
    item.confidenceScore >= 60 ? 'text-sky-500' :
    item.confidenceScore >= 40 ? 'text-amber-500' :
    'text-rose-500'

  const confidenceBarColor =
    item.confidenceScore >= 75 ? 'bg-emerald-500' :
    item.confidenceScore >= 60 ? 'bg-sky-500' :
    item.confidenceScore >= 40 ? 'bg-amber-500' :
    'bg-rose-500'

  return (
    <Card
      className={cn(
        'group border-0 overflow-hidden transition-all duration-300 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        item.isCompleted
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/30 dark:border-emerald-800/20'
          : isDue
            ? 'bg-gradient-to-br from-rose-50/80 to-amber-50/50 dark:from-rose-950/30 dark:to-amber-950/20'
            : 'bg-card',
      )}
      role="region"
      aria-label={`${item.title} — ${label}${isDue ? ', নির্ধারিত' : ''}`}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'p-1.5 rounded-lg shrink-0',
              item.isCompleted
                ? 'bg-emerald-100 dark:bg-emerald-900/40'
                : isDue
                  ? 'bg-rose-100 dark:bg-rose-900/40'
                  : 'bg-muted',
            )}>
              {item.isCompleted ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <TypeIcon className={cn(
                  'size-4',
                  isDue ? 'text-rose-500' : 'text-muted-foreground',
                )} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>
          <Badge
            className={cn(
              'shrink-0 text-[10px] px-2 py-0.5 gap-1 border-0',
              item.isCompleted
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : isDue
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {item.isCompleted ? 'সম্পন্ন' : isDue ? 'নির্ধারিত' : `${toBengaliNumerals(daysUntilDue)} দিন`}
          </Badge>
        </div>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">আত্মবিশ্বাস</span>
            <span className={cn('font-bold tabular-nums', confidenceColor)}>
              {toBengaliNumerals(item.confidenceScore)}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full bg-muted/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={item.confidenceScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`আত্মবিশ্বাস ${item.confidenceScore}%`}
          >
            <div
              className={cn('h-full rounded-full transition-all duration-500 ease-out', confidenceBarColor)}
              style={{ width: `${item.confidenceScore}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span>
            {toBengaliNumerals(item.reviewCount)}টি রিভিউ
          </span>
          <span>
            <Clock className="size-3 inline mr-0.5" />
            ~{toBengaliNumerals(item.reviewDuration)} মিনিট
          </span>
          <span>
            {toBengaliNumerals(item.intervalDays)} দিনের ব্যবধান
          </span>
          <span className="ml-auto">
            {isDue ? (
              <span className="text-rose-500 font-medium">এখনই করুন</span>
            ) : (
              `${toBengaliNumerals(daysUntilDue)} দিন বাকি`
            )}
          </span>
        </div>

        {/* Action buttons */}
        {!item.isCompleted && !showQuality && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 text-xs gap-1.5"
              onClick={() => {
                if (item.routeParams) {
                  navigate(item.route as any, item.routeParams)
                } else {
                  navigate(item.route as any)
                }
              }}
              aria-label={`${item.title} — রিভিউ শুরু করুন`}
            >
              <BrainCircuit className="size-3.5" />
              রিভিউ শুরু করুন
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowQuality(true)}
              aria-label={`${item.title} সম্পন্ন হিসাবে চিহ্নিত করুন`}
              title="সম্পন্ন"
            >
              <CheckCircle2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onSkip(item.id)}
              aria-label={`${item.title} এড়িয়ে যান`}
              title="এড়িয়ে যান"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>
        )}

        {/* Quality selection after clicking complete */}
        {!item.isCompleted && showQuality && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">কেমন মনে হয়েছে?</p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[10px] border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                onClick={() => { onComplete(item.id, 0); setShowQuality(false); }}
                aria-label="ভুলে গেছি"
              >
                ভুলে গেছি
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[10px] border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                onClick={() => { onComplete(item.id, 1); setShowQuality(false); }}
                aria-label="কঠিন ছিল"
              >
                কঠিন
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[10px] border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-700 dark:text-sky-300"
                onClick={() => { onComplete(item.id, 2); setShowQuality(false); }}
                aria-label="মোটামুটি"
              >
                মোটামুটি
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[10px] border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                onClick={() => { onComplete(item.id, 3); setShowQuality(false); }}
                aria-label="সহজ ছিল"
              >
                সহজ
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-6 text-[10px] text-muted-foreground"
              onClick={() => setShowQuality(false)}
            >
              বাতিল
            </Button>
          </div>
        )}

        {/* Completed state */}
        {item.isCompleted && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            এই সেশনের জন্য সম্পন্ন
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// ─── Summary bar ─────────────────────────────────────────────────────

function RevisionSummaryBar({ summary }: { summary: RevisionData['summary'] }) {
  if (summary.totalCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground" role="list" aria-label="রিভিশন সারাংশ">
      {summary.overdueCount > 0 && (
        <span className="flex items-center gap-1" role="listitem">
          <span className="size-2 rounded-full bg-rose-500" aria-hidden="true" />
          বাকি: {toBengaliNumerals(summary.overdueCount)}
        </span>
      )}
      {summary.todayCount > 0 && (
        <span className="flex items-center gap-1" role="listitem">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
          আজ: {toBengaliNumerals(summary.todayCount)}
        </span>
      )}
      {summary.upcomingCount > 0 && (
        <span className="flex items-center gap-1" role="listitem">
          <span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />
          আসছে: {toBengaliNumerals(summary.upcomingCount)}
        </span>
      )}
      {summary.completedCount > 0 && (
        <span className="flex items-center gap-1" role="listitem">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          সম্পন্ন: {toBengaliNumerals(summary.completedCount)}
        </span>
      )}
    </div>
  )
}

// ─── Completion progress bar ────────────────────────────────────────

function RevisionProgress({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Progress value={percent} className="h-2" aria-label={`${percent}% সম্পন্ন`} />
      <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
        {toBengaliNumerals(percent)}%
      </span>
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────

function RevisionSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-1.5 rounded-full w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-9 rounded-lg w-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyRevisionState() {
  return (
    <Card className="border-0 bg-gradient-to-br from-sky-50/50 to-indigo-50/30 dark:from-sky-950/20 dark:to-indigo-950/10">
      <CardContent className="p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-sky-100 dark:bg-sky-900/30 mb-4">
          <Sparkles className="size-7 text-sky-500" />
        </div>
        <h3 className="font-semibold text-base mb-1">কোনো রিভিউ বাকি নেই!</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          আপনি সব বিষয় রিভিউ করে ফেলেছেন! নতুন কন্টেন্ট পড়া শুরু করলে
          রিভিউ তালিকা আপডেট হবে।
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main section component ──────────────────────────────────────────

interface RevisionSectionProps {
  data: RevisionData | null
  loading: boolean
  error?: string | null
  onComplete: (id: string, quality: 0 | 1 | 2 | 3) => void
  onSkip: (id: string) => void
}

const RevisionSection = memo(function RevisionSection({
  data,
  loading,
  error,
  onComplete,
  onSkip,
}: RevisionSectionProps) {
  const { dueItems, completedItems } = useMemo(() => {
    if (!data) return { dueItems: [], completedItems: [] }
    return {
      dueItems: data.items.filter(i => !i.isCompleted),
      completedItems: data.items.filter(i => i.isCompleted),
    }
  }, [data])

  if (error) {
    return (
      <div className="mb-6 sm:mb-8" role="alert" aria-live="assertive">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/40 dark:to-indigo-900/40">
              <RotateCcw className="size-4 text-sky-600 dark:text-sky-400" />
            </div>
            স্মার্ট রিভিশন
          </h2>
        </div>
        <Card className="border-0 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="size-8 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mb-6 sm:mb-8" role="region" aria-label="রিভিশন কিউ লোড হচ্ছে">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-36" />
        </div>
        <RevisionSkeleton />
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="mb-6 sm:mb-8" role="region" aria-label="স্মার্ট রিভিশন">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/40 dark:to-indigo-900/40">
              <RotateCcw className="size-4 text-sky-600 dark:text-sky-400" />
            </div>
            স্মার্ট রিভিশন
          </h2>
        </div>
        <EmptyRevisionState />
      </div>
    )
  }

  return (
    <div
      className="mb-6 sm:mb-8"
      role="region"
      aria-label="স্মার্ট রিভিশন — স্পেসড রিপিটিশন"
      aria-live="polite"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/40 dark:to-indigo-900/40">
            <RotateCcw className="size-4 text-sky-600 dark:text-sky-400" />
          </div>
          স্মার্ট রিভিশন
        </h2>
      </div>

      {/* Summary + Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <RevisionSummaryBar summary={data.summary} />
        <RevisionProgress percent={data.summary.completionPercent} />
      </div>

      {/* Due items */}
      {dueItems.length > 0 && (
        <div className="mb-3">
          {data.summary.overdueCount > 0 && (
            <p className="text-xs text-rose-500 mb-2 flex items-center gap-1.5">
              <AlertCircle className="size-3" />
              {toBengaliNumerals(data.summary.overdueCount)}টি আইটেমের সময় শেষ!
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dueItems.map((item) => (
              <RevisionCard
                key={item.id}
                item={item}
                onComplete={onComplete}
                onSkip={onSkip}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed items (collapsed) */}
      {completedItems.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
            <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
            {toBengaliNumerals(completedItems.length)}টি আইটেম সম্পন্ন
            <ChevronDown className="size-3 group-open:rotate-180 transition-transform ml-auto" aria-hidden="true" />
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {completedItems.map((item) => (
              <RevisionCard
                key={item.id}
                item={item}
                onComplete={onComplete}
                onSkip={onSkip}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
})

export { RevisionSection }
