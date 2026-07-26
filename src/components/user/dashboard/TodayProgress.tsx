'use client'

import { memo } from 'react'
import { BookOpen, CheckCircle2, Clock, FileQuestion, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { TodayProgress as TodayProgressData } from '@/types/user-dashboard'

interface TodayProgressProps {
  today: TodayProgressData
}

function TodayProgressComponent({ today }: TodayProgressProps) {
  const goalProgress = today.goalMinutes > 0
    ? Math.min(Math.round((today.studyMinutes / today.goalMinutes) * 100), 100)
    : 0

  const items = [
    {
      icon: BookOpen,
      label: 'লেকচার শেষ',
      value: today.completedLectures,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: FileQuestion,
      label: 'MCQ সমাধান',
      value: today.mcqSolved,
      color: 'from-teal-400 to-cyan-500',
      bgColor: 'from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      icon: Clock,
      label: 'পড়ার সময়',
      value: `${today.studyMinutes}মি`,
      color: 'from-purple-400 to-violet-500',
      bgColor: 'from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ]

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 opacity-60" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-400/30">
            <Target className="size-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg">আজকের অগ্রগতি</h3>
            <p className="text-xs text-muted-foreground">
              {today.completedLectures > 0 || today.mcqSolved > 0 || today.cqWritten > 0
                ? 'চালিয়ে যান! ভালো করছেন।'
                : 'আজ এখনও পড়া শুরু করেননি'}
            </p>
          </div>
        </div>

        {/* Goal progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="size-3.5" />
              দৈনিক লক্ষ্য
            </span>
            <span className="text-xs font-semibold tabular-nums">
              {today.studyMinutes} / {today.goalMinutes} মিনিট
            </span>
          </div>
          <Progress
            value={goalProgress}
            className="h-2.5 rounded-full bg-muted/50 [&>div]:bg-gradient-to-r [&>div]:from-sky-400 [&>div]:to-blue-500 [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-500"
          />
          {goalProgress >= 100 && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              আজকের লক্ষ্য পূরণ হয়েছে!
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 dark:bg-muted/10"
            >
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${item.bgColor}`}>
                <item.icon className={`size-4 ${item.iconColor}`} />
              </div>
              <p className="text-base sm:text-lg font-bold tabular-nums">{item.value}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">{item.label}</p>
            </div>
          ))}
        </div>

        {today.cqWritten > 0 && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 dark:bg-muted/10 rounded-lg px-3 py-2">
            <FileQuestion className="size-3.5 text-violet-500 shrink-0" />
            <span>CQ লিখেছেন {today.cqWritten}টি</span>
          </div>
        )}

        {today.startedLectures > 0 && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 dark:bg-muted/10 rounded-lg px-3 py-2">
            <BookOpen className="size-3.5 text-amber-500 shrink-0" />
            <span>{today.startedLectures}টি লেকচার অসম্পূর্ণ</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const TodayProgress = memo(TodayProgressComponent)
