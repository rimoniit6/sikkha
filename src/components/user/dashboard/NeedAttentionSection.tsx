'use client'

import { memo, useMemo } from 'react'
import {
  AlertTriangle, TrendingDown, TrendingUp, Minus, ArrowRight,
  BookOpen, HelpCircle, FileText, AlertCircle,
} from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn, toBengaliNumerals } from '@/lib/utils'
import type { WeaknessData, WeaknessItem } from '@/types/user-dashboard'

// ─── Severity → color mapping ───────────────────────────────────────

const severityConfig = {
  critical: {
    label: 'জরুরি',
    icon: AlertCircle,
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200/60 dark:border-rose-800/40',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    dot: 'bg-rose-500',
    bar: 'bg-gradient-to-r from-rose-500 to-red-500',
    text: 'text-rose-600 dark:text-rose-400',
    accent: 'text-rose-500 dark:text-rose-400',
  },
  high: {
    label: 'মনোযোগ প্রয়োজন',
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dot: 'bg-amber-500',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    text: 'text-amber-600 dark:text-amber-400',
    accent: 'text-amber-500 dark:text-amber-400',
  },
  medium: {
    label: 'উন্নতি করা যায়',
    icon: HelpCircle,
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200/60 dark:border-sky-800/40',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    dot: 'bg-sky-500',
    bar: 'bg-gradient-to-r from-sky-500 to-blue-500',
    text: 'text-sky-600 dark:text-sky-400',
    accent: 'text-sky-500 dark:text-sky-400',
  },
  healthy: {
    label: 'ভালো',
    icon: HelpCircle,
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    accent: 'text-emerald-500 dark:text-emerald-400',
  },
}

// ─── Trend icon ──────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: WeaknessItem['trend'] }) {
  const trendLabel =
    trend === 'improving' ? 'উন্নতিশীল' :
    trend === 'declining' ? 'পতনশীল' :
    'স্থিতিশীল'
  return (
    <span aria-label={`প্রবণতা: ${trendLabel}`}>
      {trend === 'improving' && <TrendingUp className="size-3.5 text-emerald-500" aria-hidden="true" />}
      {trend === 'declining' && <TrendingDown className="size-3.5 text-rose-500" aria-hidden="true" />}
      {trend === 'stable' && <Minus className="size-3.5 text-muted-foreground" aria-hidden="true" />}
    </span>
  )
}

// ─── Content type icon ───────────────────────────────────────────────

const contentTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  mcq: HelpCircle,
  cq: FileText,
  lecture: BookOpen,
}

// ─── Single weakness card ────────────────────────────────────────────

interface WeaknessCardProps {
  item: WeaknessItem
}

const WeaknessCard = memo(function WeaknessCard({ item }: WeaknessCardProps) {
  const navigate = useRouterStore((s) => s.navigate)
  const config = severityConfig[item.severity]
  const TypeIcon = contentTypeIcon[item.contentType] || HelpCircle

  const severityLabel =
    item.severity === 'critical' ? 'জরুরি' :
    item.severity === 'high' ? 'মনোযোগ প্রয়োজন' :
    item.severity === 'medium' ? 'উন্নতি করা যায়' :
    'ভালো'

  const cardTitle = item.topicName || item.chapterName || item.subjectName
  const cardSubtitle = item.topicName ? item.chapterName : undefined

  return (
    <Card
      className={cn(
        'group border-0 overflow-hidden transition-all duration-300 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        config.bg,
        config.border,
      )}
      role="region"
      aria-label={`${cardTitle} — ${severityLabel}, সঠিকতা ${item.accuracy}%`}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('p-1.5 rounded-lg shrink-0', config.bg)} aria-hidden="true">
              <TypeIcon className={cn('size-4', config.accent)} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {item.subjectName}
              </p>
              {cardSubtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {cardSubtitle}
                </p>
              )}
              {item.topicName && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                  বিষয়: {item.topicName}
                </p>
              )}
            </div>
          </div>
          <Badge className={cn('shrink-0 text-[10px] px-2 py-0.5 gap-1 border-0', config.badge)}>
            <config.icon className="size-3" aria-hidden="true" />
            {config.label}
          </Badge>
        </div>

        {/* Accuracy bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">সঠিকতা</span>
            <span className={cn('font-bold tabular-nums', config.text)}>
              {toBengaliNumerals(item.accuracy)}%
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-muted/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={item.accuracy}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`সঠিকতা ${item.accuracy}%`}
          >
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out', config.bar)}
              style={{ width: `${Math.min(item.accuracy, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span>
            {toBengaliNumerals(item.attemptCount)}টি প্রচেষ্টা
          </span>
          {item.correctCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {toBengaliNumerals(item.correctCount)}টি সঠিক
            </span>
          )}
          {item.wrongCount > 0 && (
            <span className="text-rose-600 dark:text-rose-400">
              {toBengaliNumerals(item.wrongCount)}টি ভুল
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <TrendIcon trend={item.trend} />
          </span>
        </div>

        {/* Action button */}
        <Button
          size="sm"
          className={cn(
            'w-full h-9 text-xs gap-1.5 transition-all duration-200',
            item.severity === 'critical' || item.severity === 'high'
              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40'
              : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20',
          )}
          variant="ghost"
          aria-label={`${item.recommendedAction} — এই আইটেমটির জন্য যান`}
          onClick={() => {
            if (item.recommendedRouteParams) {
              navigate(item.recommendedRoute as any, item.recommendedRouteParams)
            } else {
              navigate(item.recommendedRoute as any)
            }
          }}
        >
          {item.recommendedAction}
          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  )
})

// ─── Summary bar ─────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: WeaknessData['summary'] }) {
  const total = summary.critical + summary.high + summary.medium + summary.healthy
  if (total === 0) return null

  const segments = [
    { count: summary.critical, color: 'bg-rose-500', label: 'জরুরি' },
    { count: summary.high, color: 'bg-amber-500', label: 'মনোযোগ' },
    { count: summary.medium, color: 'bg-sky-500', label: 'উন্নতি' },
    { count: summary.healthy, color: 'bg-emerald-500', label: 'ভালো' },
  ] as const

  return (
    <div className="flex items-center gap-2.5 text-xs text-muted-foreground" role="list" aria-label="সারাংশ">
      {segments.map((seg) =>
        seg.count > 0 ? (
          <span key={seg.label} className="flex items-center gap-1" role="listitem">
            <span className={cn('size-2 rounded-full', seg.color)} aria-hidden="true" />
            {seg.label}: {toBengaliNumerals(seg.count)}
          </span>
        ) : null,
      )}
      {total > 0 && (
        <span className="text-muted-foreground/50 ml-auto">
          মোট {toBengaliNumerals(total)}টি বিষয়
        </span>
      )}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────

function WeaknessSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-2 rounded-full w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 rounded-lg w-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="border-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
      <CardContent className="p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <TrendingUp className="size-7 text-emerald-500" />
        </div>
        <h3 className="font-semibold text-base mb-1">কোনো দুর্বলতা নেই!</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          আপনি অসাধারণ! সব বিষয়ে আপনার পারফরম্যান্স ভালো আছে।
          আরও পড়াশোনা চালিয়ে যান এবং মাঝে মাঝে পুরোনো বিষয়গুলো রিভিশন দিতে ভুলবেন না।
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main component ──────────────────────────────────────────────────

interface NeedAttentionSectionProps {
  data: WeaknessData | null
  loading: boolean
}

const NeedAttentionSection = memo(function NeedAttentionSection({
  data,
  loading,
}: NeedAttentionSectionProps) {
  // Split into buckets for rendering
  const { critical, high, medium, healthy } = useMemo(() => {
    if (!data) return { critical: [], high: [], medium: [], healthy: [] }
    return {
      critical: data.items.filter(i => i.severity === 'critical'),
      high: data.items.filter(i => i.severity === 'high'),
      medium: data.items.filter(i => i.severity === 'medium'),
      healthy: data.items.filter(i => i.severity === 'healthy'),
    }
  }, [data])

  // Only show "need attention" items — hide healthy
  const needAttention = useMemo(
    () => [...critical, ...high, ...medium],
    [critical, high, medium],
  )

  if (loading) {
    return (
      <div className="mb-6 sm:mb-8" role="region" aria-label="দুর্বলতা শনাক্তকরণ লোড হচ্ছে">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <WeaknessSkeleton />
      </div>
    )
  }

  // Empty state — if no items at all or all are healthy
  if (!data || data.items.length === 0 || needAttention.length === 0) {
    return (
      <div className="mb-6 sm:mb-8" role="region" aria-label="দুর্বলতা শনাক্তকরণ">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/40 dark:to-amber-900/40">
              <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
            </div>
            দুর্বলতা শনাক্তকরণ
          </h2>
        </div>
        <EmptyState />
      </div>
    )
  }

  return (
    <div
      className="mb-6 sm:mb-8"
      role="region"
      aria-label="উন্নতি প্রয়োজন — দুর্বলতা শনাক্তকরণ"
      aria-live="polite"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/40 dark:to-amber-900/40">
            <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
          </div>
          উন্নতি প্রয়োজন
        </h2>
      </div>

      {/* Summary bar */}
      <div className="mb-3">
        <SummaryBar summary={data.summary} />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {needAttention.map((item) => (
          <WeaknessCard key={item.id} item={item} />
        ))}
      </div>

      {/* Healthy items (collapsed style) */}
      {healthy.length > 0 && (
        <details className="mt-3 group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {toBengaliNumerals(healthy.length)}টি বিষয়ে ভালো পারফরম্যান্স
            <ArrowRight className="size-3 group-open:rotate-90 transition-transform ml-auto" aria-hidden="true" />
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {healthy.map((item) => (
              <WeaknessCard key={item.id} item={item} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
})

export { NeedAttentionSection }
