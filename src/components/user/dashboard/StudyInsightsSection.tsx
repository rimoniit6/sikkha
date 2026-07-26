'use client'

import { useState, useMemo, memo } from 'react'
import {
  BrainCircuit, TrendingUp, TrendingDown, Minus, Target,
  Trophy, Sparkles, Clock, Zap, AlertCircle, CheckCircle,
  BookOpen, Flame, BarChart3, Lightbulb,
} from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useStudyInsights } from '@/hooks/user/use-study-insights'
import type {
  StudyInsightsResponse,
  StudyInsight,
  StudyPrediction,
  InsightCategory,
} from '@/types/study-insights'
import { INSIGHT_CATEGORY_LABELS } from '@/types/study-insights'

/** Direct color class mapping for health score breakdown bars. */
function getHealthBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/70'
  if (score >= 60) return 'bg-blue-500/70'
  if (score >= 40) return 'bg-amber-500/70'
  return 'bg-rose-500/70'
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '৭ দিন' },
  { value: '30d', label: '৩০ দিন' },
  { value: '90d', label: '৯০ দিন' },
]

// ─── Helpers ───────────────────────────────────────────────────────

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 60) return 'text-blue-500'
  if (score >= 40) return 'text-amber-500'
  return 'text-rose-500'
}

function getHealthBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/30'
  if (score >= 60) return 'bg-blue-500/10 border-blue-500/30'
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-rose-500/10 border-rose-500/30'
}

function getImpactIcon(impact: StudyInsight['impact']) {
  switch (impact) {
    case 'positive': return TrendingUp
    case 'negative': return TrendingDown
    case 'achievement': return Trophy
    default: return Minus
  }
}

function getImpactColor(impact: StudyInsight['impact']): string {
  switch (impact) {
    case 'positive': return 'text-emerald-500'
    case 'negative': return 'text-rose-500'
    case 'achievement': return 'text-amber-500'
    default: return 'text-muted-foreground'
  }
}

function getImpactBadge(impact: StudyInsight['impact']): string {
  switch (impact) {
    case 'positive': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'negative': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    case 'achievement': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getConfidenceColor(confidence: StudyPrediction['confidence']): string {
  switch (confidence) {
    case 'high': return 'text-emerald-500'
    case 'medium': return 'text-amber-500'
    case 'low': return 'text-muted-foreground'
  }
}

function getConfidenceLabel(confidence: StudyPrediction['confidence']): string {
  switch (confidence) {
    case 'high': return 'উচ্চ'
    case 'medium': return 'মাঝারি'
    case 'low': return 'কম'
  }
}

// ─── Health Score Gauge ────────────────────────────────────────────

function HealthScoreGauge({ score, trend }: { score: number; trend: string }) {
  const color = getHealthColor(score)
  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus
  const trendLabel = trend === 'improving' ? 'উন্নতি' : trend === 'declining' ? 'পতন' : 'স্থিতিশীল'

  return (
    <Card className={cn('border-0 shadow-md overflow-hidden', getHealthBg(score))}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">লার্নিং হেলথ স্কোর</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={cn('text-4xl sm:text-5xl font-black tracking-tight', color)}>
                {toBengaliNumerals(score)}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">/ ১০০</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <TrendIcon className={cn('size-3.5', color)} />
              <span className={cn('text-xs font-medium', color)}>{trendLabel}</span>
            </div>
          </div>
          <div className="relative size-20 sm:size-24">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
                className="text-muted/30" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${score * 0.97} ${100 - score * 0.97}`}
                strokeLinecap="round"
                className={cn(color, 'transition-all duration-1000 ease-out')}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <BrainCircuit className={cn('size-6 sm:size-7', color)} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Health Score Breakdown ────────────────────────────────────────

function HealthScoreBreakdown({ data }: { data: StudyInsightsResponse | null }) {
  if (!data?.healthScore.components) return null

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">স্কোর ব্রেকডাউন</h3>
        {data.healthScore.components.map((c) => (
          <div key={c.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{c.label}</span>
              <span className={cn('font-bold', getHealthColor(c.score))}>{toBengaliNumerals(c.score)}</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">              <div className={cn('h-full rounded-full transition-all duration-700', getHealthBarColor(c.score))}
                style={{ width: `${c.score}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Consistency Summary ───────────────────────────────────────────

function ConsistencySummary({ data }: { data: StudyInsightsResponse | null }) {
  if (!data?.consistency) return null
  const c = data.consistency

  return (
    <Card className="border-border/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="size-4 text-blue-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">ধারাবাহিকতা</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'দৈনিক', value: c.daily },
            { label: 'সাপ্তাহিক', value: c.weekly },
            { label: 'মাসিক', value: c.monthly },
            { label: 'সামগ্রিক', value: c.overall },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-lg bg-white/60 dark:bg-white/5">
              <p className={cn('text-lg font-bold', getHealthColor(item.value))}>{toBengaliNumerals(item.value)}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Single Insight Card ──────────────────────────────────────────

const InsightCard = memo(function InsightCard({ insight }: { insight: StudyInsight }) {
  const Icon = getImpactIcon(insight.impact)
  const categoryLabel = INSIGHT_CATEGORY_LABELS[insight.category] || insight.category

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all duration-200 hover:shadow-sm',
        insight.impact === 'positive' ? 'border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50/30 to-transparent dark:from-emerald-950/10' :
        insight.impact === 'negative' ? 'border-rose-100 dark:border-rose-900/30 bg-gradient-to-br from-rose-50/30 to-transparent dark:from-rose-950/10' :
        insight.impact === 'achievement' ? 'border-amber-100 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10' :
        'border-border/50',
      )}
    >
      <div className="flex items-start gap-3">
        {insight.icon ? (
          <span className="text-xl">{insight.icon}</span>
        ) : (
          <Icon className={cn('size-5 mt-0.5 shrink-0', getImpactColor(insight.impact))} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold">{insight.title}</p>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', getImpactBadge(insight.impact))}>
              {categoryLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{insight.message}</p>
          {insight.value !== undefined && (
            <p className="text-lg font-bold mt-1">
              {toBengaliNumerals(insight.value)}{insight.unit}
            </p>
          )}
          {insight.actionUrl && insight.actionLabel && (
            <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs text-blue-500" asChild>
              <a href={insight.actionUrl}>{insight.actionLabel} →</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})

// ─── Prediction Card ──────────────────────────────────────────────

const PredictionCard = memo(function PredictionCard({ prediction }: { prediction: StudyPrediction }) {
  return (
    <div className="p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-gradient-to-br from-purple-50/30 to-transparent dark:from-purple-950/10">
      <div className="flex items-start gap-3">
        <Sparkles className="size-4 text-purple-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium">{prediction.title}</p>
            <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', getConfidenceColor(prediction.confidence))}>
              {getConfidenceLabel(prediction.confidence)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{prediction.description}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            আনুমানিক {toBengaliNumerals(prediction.estimatedDays)} দিন
          </p>
        </div>      </div>
    </div>
  )
})// ─── Loading State ────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/20 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/20 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyInsightsState() {
  return (
    <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/30 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/20">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-3">
          <Lightbulb className="size-7 text-emerald-500 dark:text-emerald-400" />
        </div>
        <p className="font-semibold text-base">পড়াশোনা শুরু করুন</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          পড়াশোনা শুরু করলেই আপনার জন্য ব্যক্তিগত ইনসাইট তৈরি হবে। প্রতিদিন অন্তত একটি লেকচার শেষ করুন বা একটি পরীক্ষা দিন।
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Error State ──────────────────────────────────────────────────

function InsightsError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-0 bg-rose-50/50 dark:bg-rose-950/20">
      <CardContent className="p-6 text-center">
        <AlertCircle className="size-8 text-destructive mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          আবার চেষ্টা করুন
        </Button>
      </CardContent>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function StudyInsightsSection({ enabled = true }: { enabled?: boolean }) {
  const [period, setPeriod] = useState<string>('30d')
  const { data, loading, error, refetch } = useStudyInsights({ period, enabled })

  // Filter insights by impact for tabs
  const positiveInsights = useMemo(
    () => data?.insights.filter(i => i.impact === 'positive' || i.impact === 'achievement') || [],
    [data],
  )
  const negativeInsights = useMemo(
    () => data?.insights.filter(i => i.impact === 'negative') || [],
    [data],
  )
  const neutralInsights = useMemo(
    () => data?.insights.filter(i => i.impact === 'neutral') || [],
    [data],
  )

  const [activeTab, setActiveTab] = useState('all')

  const filteredInsights = useMemo(() => {
    if (!data) return []
    switch (activeTab) {
      case 'positive': return data.insights.filter(i => i.impact === 'positive' || i.impact === 'achievement')
      case 'negative': return data.insights.filter(i => i.impact === 'negative')
      case 'neutral': return data.insights.filter(i => i.impact === 'neutral')
      default: return data.insights
    }
  }, [data, activeTab])

  if (error && !loading) {
    return (
      <section className="mb-6 sm:mb-8" aria-labelledby="study-insights-title">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="size-4 text-rose-500" />
          <h2 id="study-insights-title" className="text-base sm:text-lg font-bold">স্টাডি ইনসাইট</h2>
        </div>
        <InsightsError error={error} onRetry={() => refetch()} />
      </section>
    )
  }

  if (!loading && !data) {
    return (
      <section className="mb-6 sm:mb-8" aria-labelledby="study-insights-title">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="size-4 text-emerald-500" />
          <h2 id="study-insights-title" className="text-base sm:text-lg font-bold">স্টাডি ইনসাইট</h2>
        </div>
        <EmptyInsightsState />
      </section>
    )
  }

  return (
    <section className="mb-6 sm:mb-8" aria-labelledby="study-insights-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40">
            <BrainCircuit className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 id="study-insights-title" className="text-base sm:text-lg font-bold">
            স্টাডি ইনসাইট
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v)}>
            <TabsList className="bg-muted/50 h-7">
              {PERIOD_OPTIONS.map((opt) => (
                <TabsTrigger
                  key={opt.value}
                  value={opt.value}
                  className="text-[10px] h-6 px-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
                >
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading ? (
        <InsightsSkeleton />
      ) : data ? (
        <>
          {/* Row 1: Health Score + Breakdown + Consistency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <HealthScoreGauge score={data.healthScore.overall} trend={data.healthScore.trend} />
            </div>
            <div className="md:col-span-1">
              <HealthScoreBreakdown data={data} />
            </div>
            <div className="md:col-span-1">
              <ConsistencySummary data={data} />
            </div>
          </div>

          {/* Row 2: Predictions */}
          {data.predictions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-3.5 text-purple-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ভবিষ্যদ্বাণী
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.predictions.map((p) => (
                  <PredictionCard key={p.id} prediction={p} />
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Insights Filter */}
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="size-3.5 text-amber-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ইনসাইট
            </h3>
            {positiveInsights.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                {toBengaliNumerals(positiveInsights.length)}টি পজিটিভ
              </Badge>
            )}
            {negativeInsights.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
                {toBengaliNumerals(negativeInsights.length)}টি নেগেটিভ
              </Badge>
            )}
          </div>

          {/* Insight Category Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3">
            <TabsList className="bg-muted/50 h-7">
              <TabsTrigger value="all" className="text-[10px] h-6 px-2.5">সব</TabsTrigger>
              <TabsTrigger value="positive" className="text-[10px] h-6 px-2.5">পজিটিভ</TabsTrigger>
              <TabsTrigger value="negative" className="text-[10px] h-6 px-2.5">নেগেটিভ</TabsTrigger>
              <TabsTrigger value="neutral" className="text-[10px] h-6 px-2.5">নিউট্রাল</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Insight Cards */}
          {filteredInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {activeTab === 'positive' ? 'কোনো পজিটিভ ইনসাইট নেই' :
               activeTab === 'negative' ? 'কোনো নেগেটিভ ইনসাইট নেই' :
               activeTab === 'neutral' ? 'কোনো নিউট্রাল ইনসাইট নেই' :
               'কোনো ইনসাইট নেই'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
