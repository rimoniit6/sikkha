'use client'

import { useState, useMemo } from 'react'
import {
  BarChart3, Clock, TrendingUp, BrainCircuit, Target, BookOpen,
  Trophy, Zap, AlertCircle, Sparkles,
} from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useStudentAnalytics } from '@/hooks/user/use-student-analytics'
import type { AnalyticsPeriod, StudentAnalytics } from '@/types/student-analytics'

// ─── Reuse existing chart components ──────────────────────────────
import ChartCard from '@/components/analytics/ChartCard'
import AreaChart from '@/components/analytics/charts/AreaChart'
import BarChartComponent from '@/components/analytics/charts/BarChart'
import DonutChart from '@/components/analytics/charts/DonutChart'
import { PERIOD_OPTIONS } from '@/types/student-analytics'

// ─── Color palette ────────────────────────────────────────────────

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  rose: '#ef4444',
  violet: '#8b5cf6',
  teal: '#14b8a6',
  sky: '#06b6d4',
  orange: '#f97316',
}

const SUBJECT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6']

// ─── KPI Cards Data (manual rendering, avoids KpiCard Bengali numeral animation bug) ───

function KpiCards({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const s = data?.summary
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse border-muted/50">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  if (!s) return null

  const kpis = [
    {
      title: 'পড়ার সময়',
      value: `${toBengaliNumerals(Math.round(s.totalStudyMinutes / 60))} ঘণ্টা`,
      subtitle: `গড়ে ${toBengaliNumerals(s.avgDailyMinutes)} মিনিট/দিন`,
      icon: Clock,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'লেকচার সম্পন্ন',
      value: toBengaliNumerals(s.completedLectures),
      subtitle: `${toBengaliNumerals(s.mcqSolved)} MCQ সমাধান`,
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'গড় স্কোর',
      value: `${toBengaliNumerals(s.averageScore)}%`,
      subtitle: `${toBengaliNumerals(s.examsTaken)}টি পরীক্ষা`,
      icon: Target,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      title: 'স্ট্রিক',
      value: toBengaliNumerals(s.currentStreak),
      subtitle: `${toBengaliNumerals(s.revisionCompleted)}টি রিভিউ`,
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="hover:shadow-md transition-all duration-300 border-border/50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">{kpi.title}</p>
                <p className="text-2xl md:text-3xl font-bold tracking-tight">{kpi.value}</p>
                {kpi.subtitle && <p className="text-xs text-muted-foreground truncate">{kpi.subtitle}</p>}
              </div>
              {kpi.icon && (
                <div className={cn('p-3 rounded-xl shrink-0', kpi.bg)}>
                  <kpi.icon className={cn('h-5 w-5', kpi.color)} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Period Filter ────────────────────────────────────────────────

function PeriodFilter({
  value,
  onChange,
}: {
  value: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as AnalyticsPeriod)}>
      <TabsList className="bg-muted/50 h-8">
        {PERIOD_OPTIONS.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className="text-xs h-7 px-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white"
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

// ─── Subject Performance Badges ───────────────────────────────────

function SubjectBadges({ subjects }: { subjects: StudentAnalytics['subjectPerformance'] }) {
  if (subjects.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {subjects.slice(0, 4).map((s, i) => (
        <Badge
          key={s.subjectId}
          variant="outline"
          className={cn(
            'gap-1.5 px-2.5 py-1 text-xs font-normal',
            s.averageScore >= 70
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
              : s.averageScore >= 40
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
                : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              s.averageScore >= 70 ? 'bg-emerald-500' : s.averageScore >= 40 ? 'bg-amber-500' : 'bg-rose-500',
            )}
          />
          {s.subjectName}
          <span className="tabular-nums opacity-70">{s.averageScore}%</span>
        </Badge>
      ))}
    </div>
  )
}

// ─── Study Time Chart ─────────────────────────────────────────────

function StudyTimeChart({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.dailyStudyTime.slice(-14).map(d => ({
      date: new Date(d.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
      minutes: d.minutes,
      lecture: d.lectureMinutes,
      exam: d.examMinutes,
    }))
  }, [data])

  if (loading) {
    return <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
  }

  return (
    <ChartCard title="দৈনিক অধ্যয়ন সময়" description="গত ১৪ দিন">
      <AreaChart
        data={chartData}
        xKey="date"
        series={[
          { key: 'minutes', name: 'মোট সময়', color: COLORS.emerald },
        ]}
        height={250}
        formatY={(v) => `${v} মি`}
      />
    </ChartCard>
  )
}

// ─── MCQ Accuracy Chart ───────────────────────────────────────────

function McqAccuracyChart({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.mcqAccuracyTrend.slice(-14).map(d => {
      const date = new Date(d.date)
      return {
        date: date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
        accuracy: d.percentage,
        questions: d.totalQuestions,
      }
    })
  }, [data])

  if (loading) {
    return <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
  }

  if (chartData.length === 0) return null

  return (
    <ChartCard title="MCQ নির্ভুলতা" description="পরীক্ষার ফলাফলের ভিত্তিতে">
      <AreaChart
        data={chartData}
        xKey="date"
        series={[
          { key: 'accuracy', name: 'নির্ভুলতা', color: COLORS.violet },
        ]}
        height={250}
        formatY={(v) => `${v}%`}
      />
    </ChartCard>
  )
}

// ─── Subject Distribution Donut ───────────────────────────────────

function SubjectDistribution({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.studyTimeBySubject.slice(0, 6).map((s, i) => ({
      name: s.subjectName,
      value: s.minutes,
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
    }))
  }, [data])

  if (loading) {
    return <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
  }

  if (chartData.length === 0) return null

  return (
    <ChartCard title="বিষয় অনুযায়ী সময়" description="পড়ার সময় বণ্টন">
      <DonutChart
        data={chartData}
        height={250}
        innerRadius={55}
        outerRadius={90}
        formatValue={(v) => `${Math.round(v / 60)}ঘ`}
      />
    </ChartCard>
  )
}

// ─── Weekly Study Bar ─────────────────────────────────────────────

function WeeklyStudyBar({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.weeklyStudyTime.slice(-8).map(w => {
      const date = new Date(w.date)
      const label = `সপ্তাহ ${date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}`
      return { week: label, minutes: w.value }
    })
  }, [data])

  if (loading) {
    return <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
  }

  if (chartData.length === 0) return null

  return (
    <ChartCard title="সাপ্তাহিক অগ্রগতি" description="সপ্তাহ অনুযায়ী পড়ার সময়">
      <BarChartComponent
        data={chartData}
        xKey="week"
        series={[{ key: 'minutes', name: 'সময়', color: COLORS.teal }]}
        height={250}
        formatY={(v) => `${Math.round(v / 60)}ঘ`}
      />
    </ChartCard>
  )
}

// ─── Best & Weakest Subjects ──────────────────────────────────────

function BestWeakestSubjects({ data }: { data: StudentAnalytics | null }) {
  if (!data?.summary.bestSubject && !data?.summary.weakestSubject) return null

  return (
    <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-40" />
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-4 text-emerald-500" />
          <h3 className="text-sm font-semibold">বিষয়ভিত্তিক পারফরম্যান্স</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.summary.bestSubject && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-emerald-100 dark:border-emerald-900/30">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">সেরা বিষয়</p>
                <p className="font-semibold text-sm truncate">{data.summary.bestSubject.name}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{data.summary.bestSubject.score}%</p>
              </div>
            </div>
          )}
          {data.summary.weakestSubject && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-amber-100 dark:border-amber-900/30">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">উন্নতি প্রয়োজন</p>
                <p className="font-semibold text-sm truncate">{data.summary.weakestSubject.name}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{data.summary.weakestSubject.score}%</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Exam Completion Trend ────────────────────────────────────────

function ExamCompletionChart({ data, loading }: { data: StudentAnalytics | null; loading: boolean }) {
  const chartData = useMemo(() => {
    if (!data) return []
    return data.examCompletionTrend.slice(-14).map(d => ({
      date: new Date(d.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
      exams: d.value,
    }))
  }, [data])

  if (loading) return <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
  if (chartData.length === 0) return null

  return (
    <ChartCard title="পরীক্ষা প্রবণতা" description="দৈনিক পরীক্ষা সমাপ্তি">
      <BarChartComponent
        data={chartData}
        xKey="date"
        series={[{ key: 'exams', name: 'পরীক্ষা', color: COLORS.blue }]}
        height={200}
        formatY={(v) => `${v}টি`}
        barSize={24}
      />
    </ChartCard>
  )
}

// ─── Revision Progress ────────────────────────────────────────────

function RevisionProgressCard({ data }: { data: StudentAnalytics | null }) {
  if (!data?.revisionAnalytics) return null
  const r = data.revisionAnalytics

  return (
    <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-sky-50/50 to-indigo-50/30 dark:from-sky-950/20 dark:to-indigo-950/10">
      <div className="h-1 bg-gradient-to-r from-sky-400 to-indigo-400 opacity-40" />
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="size-4 text-sky-500" />
          <h3 className="text-sm font-semibold">রিভিশন অগ্রগতি</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5">
            <p className="text-xl font-bold text-sky-600 dark:text-sky-400">{toBengaliNumerals(r.totalReviews)}</p>
            <p className="text-[10px] text-muted-foreground">মোট আইটেম</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{toBengaliNumerals(r.completedReviews)}</p>
            <p className="text-[10px] text-muted-foreground">সম্পন্ন</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{toBengaliNumerals(r.averageConfidence)}%</p>
            <p className="text-[10px] text-muted-foreground">আত্মবিশ্বাস</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/60 dark:bg-white/5">
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{toBengaliNumerals(r.overdueItems)}</p>
            <p className="text-[10px] text-muted-foreground">বাকি</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyAnalyticsState() {
  return (
    <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-3">
          <BarChart3 className="size-7 text-emerald-500 dark:text-emerald-400" />
        </div>
        <p className="font-semibold text-base">কোনো ডেটা নেই</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          পড়াশোনা শুরু করুন এবং আপনার অগ্রগতি এখানে দেখা যাবে।
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export default function StudentAnalyticsSection({ enabled = true }: { enabled?: boolean }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const { data, loading, error, refetch } = useStudentAnalytics({ period, enabled })

  if (error && !loading) {
    return (
      <section className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="size-4 text-rose-500" />
          <h2 className="text-base sm:text-lg font-bold">পার্সোনাল এনালাইটিক্স</h2>
        </div>
        <Card className="border-0 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="size-8 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              আবার চেষ্টা করুন
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!loading && !data) {
    return <EmptyAnalyticsState />
  }

  return (
    <section className="mb-6 sm:mb-8" aria-labelledby="student-analytics-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
            <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 id="student-analytics-title" className="text-base sm:text-lg font-bold">
            পার্সোনাল এনালাইটিক্স
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => refetch()}
            disabled={loading}
          >
            <Sparkles className="size-3 mr-1" />
            রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* KPI Cards */}
      <KpiCards data={data} loading={loading} />

      {/* Subject Badges */}
      {data && data.subjectPerformance.length > 0 && (
        <div className="mt-3">
          <SubjectBadges subjects={data.subjectPerformance} />
        </div>
      )}

      {/* Charts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
        </div>
      ) : data ? (
        <>
          {/* Row 1: Study Time + MCQ Accuracy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <StudyTimeChart data={data} loading={false} />
            <McqAccuracyChart data={data} loading={false} />
          </div>

          {/* Row 2: Weekly + Subject Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <WeeklyStudyBar data={data} loading={false} />
            <SubjectDistribution data={data} loading={false} />
          </div>

          {/* Row 3: Best/Worst Subjects + Revision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <BestWeakestSubjects data={data} />
            <RevisionProgressCard data={data} />
          </div>

          {/* Row 4: Exam Completion */}
          <div className="mt-4">
            <ExamCompletionChart data={data} loading={false} />
          </div>
        </>
      ) : null}
    </section>
  )
}
