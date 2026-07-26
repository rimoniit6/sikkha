'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Award, Sparkles, Lock, CheckCircle2, Trophy, Filter,
  Medal,
} from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAchievements } from '@/hooks/user/use-achievements'
import { AchievementUnlockDialog } from './AchievementUnlockDialog'
import type {
  AchievementCardData,
  AchievementCategory,
  AchievementDefinition,
  UserAchievementState,
} from '@/types/achievements'
import {
  ACHIEVEMENT_CATEGORIES,
  CATEGORY_LABELS,
} from '@/types/achievements'

// ─── Icons ─────────────────────────────────────────────────────────

import {
  Zap, Flame, BookOpen, GraduationCap, Library,
  FileQuestion, BrainCircuit, Target, Crosshair, FileText,
  RefreshCw, CalendarCheck, CalendarDays, Clock, Timer,
  Sunrise, Moon, Swords,
} from 'lucide-react'

const CATEGORY_ICONS: Record<AchievementCategory, React.ElementType> = {
  streak: Flame,
  learning: BookOpen,
  mcq: FileQuestion,
  cq: FileText,
  revision: RefreshCw,
  calendar: CalendarDays,
  analytics: Clock,
  weakness: Swords,
  recommendation: Sparkles,
  focus: Target,
  special: Trophy,
}

// ─── Tier Colors ───────────────────────────────────────────────────

const TIER_BG: Record<string, string> = {
  bronze: 'bg-amber-100 dark:bg-amber-900/40',
  silver: 'bg-slate-200 dark:bg-slate-800',
  gold: 'bg-yellow-100 dark:bg-yellow-900/40',
  diamond: 'bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30',
}

const TIER_TEXT: Record<string, string> = {
  bronze: 'text-amber-700 dark:text-amber-300',
  silver: 'text-slate-700 dark:text-slate-300',
  gold: 'text-yellow-700 dark:text-yellow-300',
  diamond: 'text-cyan-700 dark:text-cyan-300',
}

const TIER_RING: Record<string, string> = {
  bronze: 'ring-amber-400',
  silver: 'ring-slate-400',
  gold: 'ring-yellow-400',
  diamond: 'ring-cyan-400',
}

// ─── Achievement Card ──────────────────────────────────────────────

function AchievementCard({
  data,
  onSelect,
}: {
  data: AchievementCardData
  onSelect: (data: AchievementCardData) => void
}) {
  const { definition, userState, progressPercent, isNewlyUnlocked } = data
  const unlocked = userState?.unlocked ?? false
  const claimed = userState?.claimedAt != null

  return (
    <button
      type="button"
      onClick={() => onSelect(data)}
      className={cn(
        'relative w-full text-left rounded-xl border border-border/50 p-4 transition-all duration-200',
        'hover:shadow-md hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        unlocked
          ? 'bg-gradient-to-br from-card to-emerald-50/30 dark:from-card dark:to-emerald-950/10'
          : 'bg-card opacity-80 hover:opacity-100',
        isNewlyUnlocked && 'ring-2 ring-emerald-400',
      )}
      aria-label={`${definition.title} — ${unlocked ? 'আনলকড' : 'লকড'} — ${progressPercent}%`}
    >
      {/* Progress ring indicator */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            unlocked ? TIER_BG[definition.tier] : 'bg-muted',
          )}>
            {unlocked ? (
              <Trophy className={cn('size-5', TIER_TEXT[definition.tier])} />
            ) : (
              <Lock className="size-4 text-muted-foreground/50" />
            )}
          </div>
          {isNewlyUnlocked && (
            <span className="absolute -top-1 -right-1 size-3 bg-emerald-500 rounded-full motion-safe:animate-pulse-soft" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{definition.title}</p>
            {claimed && (
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{definition.description}</p>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  unlocked ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={cn(
              'text-[10px] font-mono font-medium',
              unlocked ? TIER_TEXT[definition.tier] : 'text-muted-foreground/50',
            )}>
              {toBengaliNumerals(progressPercent)}%
            </span>
          </div>

          {/* Category + Tier badges */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
              {CATEGORY_LABELS[definition.category]}
            </Badge>
            <Badge className={cn('text-[9px] h-4 px-1.5 capitalize', TIER_BG[definition.tier], TIER_TEXT[definition.tier])}>
              {definition.tier}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Summary Bar ───────────────────────────────────────────────────

function SummaryBar({ data, loading }: { data: AchievementCardData[] | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const unlocked = data.filter(d => d.userState?.unlocked)
  const claimed = data.filter(d => d.userState?.claimedAt)
  const recent = data.filter(d => d.isNewlyUnlocked)

  const items = [
    {
      label: 'মোট',
      value: toBengaliNumerals(data.length),
      sub: 'অর্জন',
      icon: Award,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'আনলকড',
      value: toBengaliNumerals(unlocked.length),
      sub: `${toBengaliNumerals(Math.round((unlocked.length / data.length) * 100))}% সম্পন্ন`,
      icon: Trophy,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'দাবি করা হয়েছে',
      value: toBengaliNumerals(claimed.length),
      sub: `${toBengaliNumerals(unlocked.length - claimed.length)}টি বাকি`,
      icon: CheckCircle2,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      label: 'নতুন',
      value: toBengaliNumerals(recent.length),
      sub: 'সাম্প্রতিক',
      icon: Sparkles,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/30">
          <div className={cn('p-2 rounded-lg shrink-0', item.bg)}>
            <item.icon className={cn('size-4', item.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{item.value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
            <p className="text-[9px] text-muted-foreground/60 truncate">{item.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Category Filter ───────────────────────────────────────────────

function CategoryFilter({
  value,
  onChange,
  counts,
}: {
  value: AchievementCategory | 'all'
  onChange: (v: AchievementCategory | 'all') => void
  counts: Record<string, number>
}) {
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="flex gap-1.5 min-w-max">
        <Button
          variant={value === 'all' ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-7 text-xs gap-1',
            value === 'all' && 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
          )}
          onClick={() => onChange('all')}
        >
          <Filter className="size-3" />
          সব
          <span className="text-[10px] opacity-70">({toBengaliNumerals(counts.all || 0)})</span>
        </Button>
        {ACHIEVEMENT_CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat]
          const count = counts[cat] || 0
          if (count === 0) return null
          return (
            <Button
              key={cat}
              variant={value === cat ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-7 text-xs gap-1',
                value === cat && 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
              )}
              onClick={() => onChange(cat)}
            >
              <Icon className="size-3" />
              {CATEGORY_LABELS[cat]}
              <span className="text-[10px] opacity-70">({toBengaliNumerals(count)})</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function AchievementsSection({ enabled = true }: { enabled?: boolean }) {
  const { data, loading, error, refetch, claimReward, claiming } = useAchievements({ enabled })
  const [categoryFilter, setCategoryFilter] = useState<AchievementCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState<'progress' | 'recent' | 'tier'>('progress')
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementCardData | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data?.achievements.length ?? 0 }
    for (const cat of ACHIEVEMENT_CATEGORIES) {
      counts[cat] = data?.achievements.filter(a => a.definition.category === cat).length ?? 0
    }
    return counts
  }, [data])

  // Filter and sort achievements
  const filteredAchievements = useMemo(() => {
    if (!data) return []

    let items = data.achievements

    // Apply category filter
    if (categoryFilter !== 'all') {
      items = items.filter(a => a.definition.category === categoryFilter)
    }

    // Apply sorting
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          // Unlocked first, then by progress descending
          if (a.userState?.unlocked !== b.userState?.unlocked) {
            return a.userState?.unlocked ? -1 : 1
          }
          return b.progressPercent - a.progressPercent
        case 'recent':
          // Recently unlocked first
          if (a.isNewlyUnlocked !== b.isNewlyUnlocked) {
            return a.isNewlyUnlocked ? -1 : 1
          }
          if (a.userState?.unlocked !== b.userState?.unlocked) {
            return a.userState?.unlocked ? -1 : 1
          }
          return b.progressPercent - a.progressPercent
        case 'tier': {
          const tierOrder = { diamond: 0, gold: 1, silver: 2, bronze: 3 }
          return (tierOrder[a.definition.tier] ?? 99) - (tierOrder[b.definition.tier] ?? 99)
        }
        default:
          return 0
      }
    })
  }, [data, categoryFilter, sortBy])

  const handleSelect = useCallback((achievement: AchievementCardData) => {
    setSelectedAchievement(achievement)
    if (achievement.userState?.unlocked) {
      setDialogOpen(true)
    }
  }, [])

  const handleClaim = useCallback(async () => {
    if (!selectedAchievement) return
    try {
      await claimReward(selectedAchievement.definition.id)
      refetch()
    } catch {
      // Error handled by hook
    }
  }, [selectedAchievement, claimReward, refetch])

  if (error && !loading) {
    return (
      <section className="mb-6 sm:mb-8" aria-labelledby="achievements-title">
        <div className="flex items-center gap-2 mb-3">
          <Award className="size-4 text-rose-500" />
          <h2 id="achievements-title" className="text-base sm:text-lg font-bold">অর্জনসমূহ</h2>
        </div>
        <Card className="border-0 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              আবার চেষ্টা করুন
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="mb-6 sm:mb-8" aria-labelledby="achievements-title">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40">
            <Medal className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-base sm:text-lg font-bold">অর্জনসমূহ</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6 sm:mb-8" aria-labelledby="achievements-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40">
            <Medal className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 id="achievements-title" className="text-base sm:text-lg font-bold">অর্জনসমূহ</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => refetch()}
          >
            <Sparkles className="size-3 mr-1" />
            রিফ্রেশ
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary */}
          <SummaryBar data={data.achievements} loading={false} />

          {/* Sort Tabs */}
          <div className="flex items-center justify-between mt-4 mb-3">
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <TabsList className="bg-muted/50 h-7">
                <TabsTrigger value="progress" className="text-xs h-6 px-2.5">অগ্রগতি</TabsTrigger>
                <TabsTrigger value="recent" className="text-xs h-6 px-2.5">সাম্প্রতিক</TabsTrigger>
                <TabsTrigger value="tier" className="text-xs h-6 px-2.5">টিয়ার</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground">
              {toBengaliNumerals(filteredAchievements.length)}টি অর্জন
            </span>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <CategoryFilter
              value={categoryFilter}
              onChange={setCategoryFilter}
              counts={categoryCounts}
            />
          </div>

          {/* Achievement Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAchievements.map(ach => (
              <AchievementCard
                key={ach.definition.id}
                data={ach}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* Empty filter state */}
          {filteredAchievements.length === 0 && (
            <div className="text-center py-8">
              <Award className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">এই ক্যাটাগরিতে কোনো অর্জন নেই</p>
            </div>
          )}
        </>
      )}

      {/* Unlock Dialog */}
      {selectedAchievement?.userState?.unlocked && (
        <AchievementUnlockDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          definition={selectedAchievement.definition}
          userState={selectedAchievement.userState}
          onClaim={!selectedAchievement.userState.claimedAt ? handleClaim : undefined}
          claiming={claiming}
        />
      )}
    </section>
  )
}
