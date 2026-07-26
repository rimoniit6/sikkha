'use client'

import { memo } from 'react'
import { Sparkles,
  PlayCircle,
  HelpCircle,
  FileText,
  BookmarkCheck,
  ChevronRight,
} from 'lucide-react'
import type { RoutePath } from '@/store/router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useRouterStore } from '@/store/router'
import type { RecommendationItem } from '@/types/user-dashboard'

// ─── Props ───────────────────────────────────────────────────────────────────

interface RecommendationsSectionProps {
  items: RecommendationItem[]
  loading: boolean
}

// ─── Icon map ────────────────────────────────────────────────────────────────

const typeConfig: Record<
  RecommendationItem['type'],
  { icon: React.ElementType; label: string; gradient: string; iconBg: string }
> = {
  lecture: {
    icon: PlayCircle,
    label: 'লেকচার',
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
  },
  mcq: {
    icon: HelpCircle,
    label: 'MCQ',
    gradient: 'from-violet-500 to-purple-500',
    iconBg: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  },
  exam: {
    icon: FileText,
    label: 'পরীক্ষা',
    gradient: 'from-rose-500 to-pink-500',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
  },
  bookmark: {
    icon: BookmarkCheck,
    label: 'বুকমার্ক',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  },
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

interface RecommendationCardProps {
  item: RecommendationItem
  onNavigate: (route: string, params?: Record<string, string>) => void
}

const RecommendationCard = memo(function RecommendationCard({
  item,
  onNavigate,
}: RecommendationCardProps) {
  const config = typeConfig[item.type]
  const Icon = config.icon

  return (
    <Card
      className="group relative min-w-[260px] sm:min-w-[280px] w-[260px] sm:w-[280px] shrink-0 snap-start border-0 shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
      onClick={() => onNavigate(item.route, item.routeParams)}
    >
      {/* Top gradient strip */}
      <div className={cn('h-1.5 bg-gradient-to-r', config.gradient)} />

      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('p-2.5 rounded-xl shrink-0 shadow-sm', config.iconBg)}>
            <Icon className="size-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {item.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Bottom row: progress + reason */}
        <div className="flex items-center justify-between mt-3">
          {/* Reason badge */}
          <Badge className={cn('text-[10px] h-5 px-2 font-medium gap-1', item.reasonColor)}>
            <Sparkles className="size-2.5" />
            {item.reason}
          </Badge>

          {/* Progress indicator or action */}
          {item.progress !== undefined ? (
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {item.progress}%
              </span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(item.route, item.routeParams)
              }}
            >
              শুরু করুন
              <ChevronRight className="size-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-40" />
      <CardContent className="p-5 sm:p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-3">
          <Sparkles className="size-7 text-emerald-500 dark:text-emerald-400" />
        </div>
        <p className="font-semibold text-base">আপনি দারুণ চলছেন! 🎉</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
          আরও পড়াশোনা করলে আমরা আপনার পড়ার ধরন বুঝে কাস্টম রিকমেন্ডেশন দিতে পারব।
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="min-w-[260px] sm:min-w-[280px] w-[260px] sm:w-[280px] shrink-0 border-0 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-xl" />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

function RecommendationsSectionComponent({
  items,
  loading,
}: RecommendationsSectionProps) {
  const navigate = useRouterStore((s) => s.navigate)

  const handleNavigate = (route: string, params?: Record<string, string>) => {
    navigate(route as RoutePath, params)
  }

  return (
    <section className="mb-6 sm:mb-8" aria-labelledby="recommendations-title">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
          <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 id="recommendations-title" className="text-base sm:text-lg font-bold">
          আপনার জন্য সাজেশন
        </h2>
        {!loading && items.length > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {items.length}টি
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <SectionSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {items.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              onNavigate={handleNavigate}
            />
          ))}

          {/* Right padding for last card visibility */}
          <div className="w-2 shrink-0" />
        </div>
      )}
    </section>
  )
}

export const RecommendationsSection = memo(RecommendationsSectionComponent)
