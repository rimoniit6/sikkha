'use client'

import { BookOpen, HelpCircle, Video, TrendingUp, Zap } from 'lucide-react'
import { usePublicStats } from '@/hooks/use-metadata'

function formatBengali(num: number): string {
  if (num === 0) return '০'
  return new Intl.NumberFormat('bn-BD').format(num)
}

interface ProgressCardProps {
  icon: React.ElementType
  value: string
  label: string
  color: string
  bgColor: string
}

function ProgressCard({ icon: Icon, value, label, color, bgColor }: ProgressCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3.5 transition-all duration-200 hover:shadow-sm hover:border-emerald-200/50 dark:hover:border-emerald-800/30">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-none mb-0.5">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )
}

export default function DailyProgressSection() {
  const { stats, loading } = usePublicStats()
  // Don't render if no stats
  if (!loading && !stats) return null

  // Show loading skeleton
  if (loading || !stats) {
    return (
      <section className="py-4 bg-background">
        <div className="container-app">
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[60px] rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const progressItems: ProgressCardProps[] = [
    {
      icon: BookOpen,
      value: `${formatBengali(stats.lectures)}+`,
      label: 'লেকচার',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
      icon: HelpCircle,
      value: `${formatBengali(stats.mcqs)}+`,
      label: 'MCQ প্রশ্ন',
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-100 dark:bg-sky-900/40',
    },
    {
      icon: TrendingUp,
      value: `${formatBengali(stats.exams)}+`,
      label: 'পরীক্ষা',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    },
    {
      icon: Zap,
      value: `${formatBengali(stats.students)}+`,
      label: 'শিক্ষার্থী',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/40',
    },
  ]

  return (
    <section className="py-4 bg-background" aria-label="দৈনিক অগ্রগতি">
      <div className="container-app">
        <div className="grid grid-cols-2 gap-2.5">
          {progressItems.map((item, idx) => (
            <ProgressCard key={idx} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}
