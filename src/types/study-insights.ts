/**
 * Study Insights & Learning Intelligence Types
 *
 * Generated algorithmically from existing platform data.
 * No AI API required — all insights are deterministic.
 */

// ─── Insight Categories ────────────────────────────────────────────

export type InsightCategory =
  | 'study-pattern'
  | 'performance'
  | 'revision'
  | 'behavior'
  | 'goal-tracking'
  | 'achievement'
  | 'recommendation'
  | 'calendar'
  | 'focus'

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  'study-pattern': 'পড়ার অভ্যাস',
  'performance': 'দক্ষতা',
  'revision': 'রিভিশন',
  'behavior': 'আচরণ',
  'goal-tracking': 'লক্ষ্য',
  'achievement': 'অর্জন',
  'recommendation': 'সাজেশন',
  'calendar': 'ক্যালেন্ডার',
  'focus': 'ফোকাস',
}

// ─── Impact Levels ─────────────────────────────────────────────────

export type InsightImpact = 'positive' | 'negative' | 'neutral' | 'achievement'

// ─── Single Insight ────────────────────────────────────────────────

export interface StudyInsight {
  id: string
  category: InsightCategory
  title: string
  message: string
  impact: InsightImpact
  /** Numeric value to display (optional) */
  value?: number
  /** Unit for the value (e.g., "%", "মি", "ঘ") */
  unit?: string
  /** Emoji/icon identifier */
  icon?: string
  /** Priority within category for sorting */
  priority: number
  /** Link to relevant section */
  actionUrl?: string
  /** Action label in Bengali */
  actionLabel?: string
}

// ─── Health Score ─────────────────────────────────────────────────

export interface HealthScoreComponent {
  name: string
  label: string
  score: number // 0-100
  weight: number // 0-1, sum of weights = 1
}

export interface LearningHealthScore {
  overall: number // 0-100
  components: HealthScoreComponent[]
  trend: 'improving' | 'declining' | 'stable'
}

// ─── Predictions ──────────────────────────────────────────────────

export type PredictionConfidence = 'high' | 'medium' | 'low'

export interface StudyPrediction {
  id: string
  title: string
  description: string
  confidence: PredictionConfidence
  /** Estimated days until event */
  estimatedDays: number
  category: InsightCategory
}

// ─── Trend Data ────────────────────────────────────────────────────

export interface TrendResult {
  direction: 'improving' | 'declining' | 'stable'
  changePercent: number
}

// ─── Consistency Score ─────────────────────────────────────────────

export interface ConsistencyScore {
  daily: number // 0-100
  weekly: number // 0-100
  monthly: number // 0-100
  overall: number // 0-100
}

// ─── Main Response ─────────────────────────────────────────────────

export interface StudyInsightsResponse {
  healthScore: LearningHealthScore
  insights: StudyInsight[]
  predictions: StudyPrediction[]
  consistency: ConsistencyScore
  generatedAt: string // ISO date
}

// ─── Period for Insight Generation ──────────────────────────────

export type InsightsPeriod = '7d' | '30d' | '90d' | 'all'
