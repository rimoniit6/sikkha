'use client'

import { memo } from 'react'
import { BarChart3, BookOpen, FileQuestion, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { WeeklyProgress as WeeklyProgressData } from '@/types/user-dashboard'

interface WeeklyProgressProps {
  weekly: WeeklyProgressData
}

function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return <Minus className="size-3.5 text-muted-foreground" />
  }
  if (previous === 0) {
    return <TrendingUp className="size-3.5 text-emerald-500" />
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct > 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="size-3" />
        +{pct}%
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
        <TrendingDown className="size-3" />
        {pct}%
      </span>
    )
  }
  return <Minus className="size-3.5 text-muted-foreground" />
}

function WeeklyProgressComponent({ weekly }: WeeklyProgressProps) {
  const stats = [
    {
      icon: BookOpen,
      label: 'লেকচার',
      current: weekly.lecturesCompleted,
      previous: weekly.previousWeek.lecturesCompleted,
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: FileQuestion,
      label: 'MCQ',
      current: weekly.mcqSolved,
      previous: weekly.previousWeek.mcqSolved,
      color: 'from-teal-400 to-cyan-500',
      bgColor: 'from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      icon: FileQuestion,
      label: 'CQ',
      current: weekly.cqWritten,
      previous: weekly.previousWeek.cqWritten,
      color: 'from-violet-400 to-purple-500',
      bgColor: 'from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      icon: Clock,
      label: 'সময় (মি)',
      current: weekly.studyMinutes,
      previous: weekly.previousWeek.studyMinutes,
      color: 'from-sky-400 to-blue-500',
      bgColor: 'from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40',
      iconColor: 'text-sky-600 dark:text-sky-400',
    },
  ]

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-teal-400 via-emerald-400 to-green-400 opacity-60" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-md shadow-teal-400/30">
            <BarChart3 className="size-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg">সাপ্তাহিক অগ্রগতি</h3>
            <p className="text-xs text-muted-foreground">
              গত সপ্তাহের তুলনায় অগ্রগতি
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-xl bg-muted/30 dark:bg-muted/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stat.bgColor}`}>
                  <stat.icon className={`size-3.5 ${stat.iconColor}`} />
                </div>
                <ComparisonBadge current={stat.current} previous={stat.previous} />
              </div>
              <p className="text-lg font-bold tabular-nums">{stat.current}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>গত সপ্তাহ: {stat.previous}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const WeeklyProgress = memo(WeeklyProgressComponent)
