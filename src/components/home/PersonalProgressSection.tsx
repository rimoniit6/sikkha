'use client'

import { useEffect, useState } from 'react'
import { BookOpen, BarChart3, Bookmark, TrendingUp, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthUser } from '@/store/auth'

interface DashboardStats {
  completedLectures: number
  totalLectures: number
  avgMcqScore: number
  savedQuestions: number
  isPremium: boolean
  premiumExpiry: string | null
}

interface DashboardData {
  stats: DashboardStats
  recentExams: unknown[]
}

interface StatCardProps {
  icon: React.ElementType
  value: string | number
  label: string
  color: string
  bgColor: string
}

function StatCard({ icon: Icon, value, label, color, bgColor }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3.5 transition-all duration-200 hover:shadow-sm">
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-none mb-0.5">
          {typeof value === 'number' ? (value > 0 ? value : '০') : value}
        </p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )
}

export default function PersonalProgressSection() {
  const user = useAuthUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    api.get<DashboardData>('user/dashboard')
      .then((data) => {
        if (!cancelled && data?.stats) {
          setStats(data.stats)
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id])

  if (loading) return null
  if (!stats) return null

  // Only show if at least one stat has meaningful data
  const hasData = stats.completedLectures > 0 || stats.totalLectures > 0 || stats.avgMcqScore > 0 || stats.savedQuestions > 0
  if (!hasData) return null

  const items: StatCardProps[] = [
    {
      icon: BookOpen,
      value: `${stats.completedLectures}/${stats.totalLectures || '—'}`,
      label: 'লেকচার সম্পন্ন',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
      icon: BarChart3,
      value: stats.avgMcqScore > 0 ? `${stats.avgMcqScore}%` : '—',
      label: 'গড় MCQ স্কোর',
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-100 dark:bg-sky-900/40',
    },
    {
      icon: Bookmark,
      value: stats.savedQuestions > 0 ? stats.savedQuestions : '—',
      label: 'সেভ করা প্রশ্ন',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    },
    {
      icon: TrendingUp,
      value: stats.totalLectures > 0 ? Math.round((stats.completedLectures / stats.totalLectures) * 100) + '%' : '—',
      label: 'অগ্রগতি',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/40',
    },
  ]

  return (
    <section className="py-4 bg-background" aria-label="ব্যক্তিগত অগ্রগতি">
      <div className="container-app">
        <h2 className="text-base sm:text-lg font-bold text-foreground mb-3">
          আপনার অগ্রগতি
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item, idx) => (
            <StatCard key={idx} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}
