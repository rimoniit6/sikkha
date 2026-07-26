'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarDays, Flame, BookOpen,
  FileQuestion, BrainCircuit, GraduationCap, Sparkles,
  Trophy, BarChart3,
} from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLearningCalendar } from '@/hooks/user/use-learning-calendar'
import type {
  ActivityLevel,
  CalendarDay,
  CalendarMonth,
} from '@/types/learning-calendar'
import {
  WEEKDAY_LABELS,
  LEVEL_CLASSES,
  BENGALI_MONTH_NAMES,
} from '@/types/learning-calendar'

// ─── Constants ─────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']

const LEVEL_TOOLTIP_LABELS: Record<ActivityLevel, string> = {
  0: 'কোনো কার্যকলাপ নেই',
  1: 'সামান্য',
  2: 'মাঝারি',
  3: 'উচ্চ',
  4: 'অনেক বেশি',
}

const GRID_COLS = 'grid-cols-7'

// ─── Calendar Cell ─────────────────────────────────────────────────

function CalendarCell({
  day,
  isSelected,
  onSelect,
  onHover,
}: {
  day: CalendarDay
  isSelected: boolean
  onSelect: (day: CalendarDay) => void
  onHover: (day: CalendarDay | null) => void
}) {
  const { level, isCurrentMonth, isToday } = day
  const isFuture = new Date(day.date) > new Date()

  return (
    <button
      type="button"
      className={cn(
        'relative aspect-square w-full rounded-md transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
        'hover:scale-110 hover:z-10',
        LEVEL_CLASSES[level],
        !isCurrentMonth && 'opacity-25',
        isToday && 'ring-1 ring-emerald-400 ring-offset-1 dark:ring-offset-background',
        isSelected && 'ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-background scale-110 z-10',
        isFuture && 'opacity-20 pointer-events-none',
      )}
      onClick={() => onSelect(day)}
      onMouseEnter={() => onHover(day)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(day)}
      onBlur={() => onHover(null)}
      aria-label={`${day.date} — ${LEVEL_TOOLTIP_LABELS[level]}${isToday ? ' (আজ)' : ''}${isFuture ? ' (ভবিষ্যত)' : ''}`}
      tabIndex={isFuture ? -1 : 0}
    >
      {/* Show day number on very small screens */}
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-foreground/40 sm:hidden">
        {new Date(day.date).getDate()}
      </span>
    </button>
  )
}

// ─── Day Tooltip ───────────────────────────────────────────────────

function DayTooltip({ day }: { day: CalendarDay }) {
  const date = new Date(day.date)
  const dateLabel = date.toLocaleDateString('bn-BD', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const items = [
    { label: 'পড়ার সময়', value: `${toBengaliNumerals(Math.round(day.studyMinutes))} মিনিট`, icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'লেকচার', value: toBengaliNumerals(day.lectureCount), icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'MCQ', value: toBengaliNumerals(day.mcqCount), icon: FileQuestion, color: 'text-violet-600 dark:text-violet-400' },
    { label: 'CQ', value: toBengaliNumerals(day.cqCount), icon: BarChart3, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'রিভিশন', value: toBengaliNumerals(day.revisionCount), icon: BrainCircuit, color: 'text-sky-600 dark:text-sky-400' },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 border border-border/50 rounded-xl shadow-xl p-4 min-w-[200px] max-w-[260px] z-50">
      <p className="font-semibold text-sm mb-2">{dateLabel}</p>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <item.icon className={cn('size-3', item.color)} />
              {item.label}
            </span>
            <span className="font-mono font-medium">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">কার্যকলাপের মাত্রা</span>
          <span className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-medium',
            LEVEL_CLASSES[day.level],
          )}>
            {LEVEL_TOOLTIP_LABELS[day.level]}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Month Navigation ──────────────────────────────────────────────

function MonthNav({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onPrev}
          aria-label="পূর্ববর্তী মাস"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-semibold min-w-[100px] text-center">
          {BENGALI_MONTH_NAMES[month]} {toBengaliNumerals(year)}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onNext}
          aria-label="পরবর্তী মাস"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToday}
        >
          <CalendarDays className="size-3" />
          আজ
        </Button>
      )}
    </div>
  )
}

// ─── Legend ─────────────────────────────────────────────────────────

function CalendarLegend() {
  const levels: { level: ActivityLevel; label: string }[] = [
    { level: 0, label: 'না' },
    { level: 1, label: 'সামান্য' },
    { level: 2, label: 'মাঝারি' },
    { level: 3, label: 'উচ্চ' },
    { level: 4, label: 'অনেক' },
  ]

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>কম</span>
      {levels.map(l => (
        <span
          key={l.level}
          className={cn('size-3 rounded-sm', LEVEL_CLASSES[l.level])}
          aria-label={l.label}
        />
      ))}
      <span>বেশি</span>
    </div>
  )
}

// ─── Summary Stats ─────────────────────────────────────────────────

function CalendarSummary({ month }: { month: CalendarMonth }) {
  const s = month.summary
  const items = [
    {
      label: 'সক্রিয় দিন',
      value: toBengaliNumerals(s.totalActiveDays),
      sub: `${toBengaliNumerals(month.totalDays)} দিনের মধ্যে`,
      icon: CalendarDays,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'পড়ার সময়',
      value: `${toBengaliNumerals(Math.round(s.totalStudyMinutes / 60))} ঘণ্টা`,
      sub: `গড়ে ${toBengaliNumerals(Math.round(s.totalStudyMinutes / Math.max(s.totalActiveDays, 1)))} মিনিট/দিন`,
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'কারেন্ট স্ট্রিক',
      value: toBengaliNumerals(s.currentStreak),
      sub: `সর্বোচ্চ: ${toBengaliNumerals(s.longestStreak)} দিন`,
      icon: Flame,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'মোট কার্যকলাপ',
      value: toBengaliNumerals(s.totalMcqs + s.totalCqs + s.totalRevisions + s.totalLectures),
      sub: `${toBengaliNumerals(s.totalLectures)} লেকচার, ${toBengaliNumerals(s.totalMcqs)} MCQ`,
      icon: Trophy,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(item => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/30"
        >
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

// ─── Empty State ───────────────────────────────────────────────────

function EmptyCalendarState({ year, month }: { year: number; month: number }) {
  return (
    <div className="text-center py-8">
      <CalendarDays className="size-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm font-medium">এই মাসে কোনো কার্যকলাপ নেই</p>
      <p className="text-xs text-muted-foreground mt-1">
        {BENGALI_MONTH_NAMES[month]} {toBengaliNumerals(year)}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function LearningCalendarSection({ enabled = true }: { enabled?: boolean }) {
  const {
    year, month, data, loading, error,
    goToPrevMonth, goToNextMonth, goToToday, refetch,
  } = useLearningCalendar({ enabled })

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null)

  const hasAnyActivity = useMemo(() => {
    if (!data) return false
    return data.days.some(d => d.isCurrentMonth && d.level > 0)
  }, [data])

  const handleCellSelect = useCallback((day: CalendarDay) => {
    setSelectedDay(prev => prev?.date === day.date ? null : day)
  }, [])

  const handleCellHover = useCallback((day: CalendarDay | null) => {
    setHoveredDay(day)
  }, [])

  const activeDay = selectedDay || hoveredDay

  if (error && !loading) {
    return (
      <section className="mb-6 sm:mb-8" aria-labelledby="calendar-title">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="size-4 text-rose-500" />
          <h2 id="calendar-title" className="text-base sm:text-lg font-bold">লার্নিং ক্যালেন্ডার</h2>
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
      <section className="mb-6 sm:mb-8" aria-labelledby="calendar-title">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
            <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 id="calendar-title" className="text-base sm:text-lg font-bold">লার্নিং ক্যালেন্ডার</h2>
        </div>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="mb-6 sm:mb-8" aria-labelledby="calendar-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
            <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 id="calendar-title" className="text-base sm:text-lg font-bold">লার্নিং ক্যালেন্ডার</h2>
        </div>
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

      {!data ? (
        <EmptyCalendarState year={year} month={month} />
      ) : (
        <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 sm:p-6">
            {/* Month Navigation */}
            <MonthNav
              year={year}
              month={month}
              onPrev={goToPrevMonth}
              onNext={goToNextMonth}
              onToday={goToToday}
            />

            {/* Summary Stats */}
            <div className="mt-4">
              <CalendarSummary month={data} />
            </div>

            {/* Activity Heatmap Grid */}
            <div className="mt-5 overflow-x-auto -mx-2 px-2">
              {/* Weekday headers */}
              <div className={cn('grid', GRID_COLS, 'gap-1.5 mb-1.5')}>
                {WEEKDAYS_SHORT.map(day => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-medium text-muted-foreground/60 py-1"
                    aria-hidden="true"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div
                className={cn('grid', GRID_COLS, 'gap-1.5')}
                role="grid"
                aria-label={`${BENGALI_MONTH_NAMES[data.month]} ${data.year} ক্যালেন্ডার`}
              >
                {data.days.map(day => (
                  <CalendarCell
                    key={day.date}
                    day={day}
                    isSelected={selectedDay?.date === day.date}
                    onSelect={handleCellSelect}
                    onHover={handleCellHover}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between mt-3">
                <CalendarLegend />
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2.5 rounded-sm ring-1 ring-emerald-400 ring-offset-1 dark:ring-offset-background" />
                    আজ
                  </span>
                  {activeDay && (
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2.5 rounded-sm ring-2 ring-violet-400 ring-offset-1 dark:ring-offset-background" />
                      নির্বাচিত
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Day Details Panel */}
            {activeDay && (
              <div className="mt-4 relative">
                <DayTooltip day={activeDay} />
              </div>
            )}

            {/* No activity message */}
            {!hasAnyActivity && (
              <div className="mt-4 text-center py-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  {BENGALI_MONTH_NAMES[data.month]} মাসে এখনো কোনো পড়ার কার্যকলাপ রেকর্ড করা হয়নি।
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
