/**
 * Student-facing Personal Analytics Types
 *
 * Designed to be consumed by chart components and insights system.
 * Reuses patterns from admin analytics types.
 */

// ─── Period / Filter ───────────────────────────────────────────────

export type AnalyticsPeriod = 'today' | 'thisWeek' | '7d' | '30d' | '90d' | '1y' | 'custom'

export interface AnalyticsDateFilter {
  period: AnalyticsPeriod
  from?: string // ISO date
  to?: string   // ISO date
}

// ─── Time-Series Data Points ───────────────────────────────────────

export interface DailyDataPoint {
  date: string // YYYY-MM-DD
  value: number
}

export interface StudyTimeDataPoint {
  date: string
  minutes: number
  lectureMinutes: number
  examMinutes: number
}

export interface AccuracyDataPoint {
  date: string
  percentage: number
  totalQuestions: number
  correctAnswers: number
}

// ─── Summary Statistics ────────────────────────────────────────────

export interface StudentAnalyticsSummary {
  /** Total study time in minutes */
  totalStudyMinutes: number
  /** Average study time per day in selected period */
  avgDailyMinutes: number
  /** Total completed lectures */
  completedLectures: number
  /** Total MCQs solved */
  mcqSolved: number
  /** Total CQ submissions */
  cqWritten: number
  /** Total exams taken */
  examsTaken: number
  /** Average score across all exams (%) */
  averageScore: number
  /** Best performing subject */
  bestSubject: { name: string; score: number } | null
  /** Weakest subject */
  weakestSubject: { name: string; score: number } | null
  /** Total revision items completed */
  revisionCompleted: number
  /** Active study streak */
  currentStreak: number
}

// ─── Subject Performance ──────────────────────────────────────────

export interface SubjectAnalytics {
  subjectId: string
  subjectName: string
  averageScore: number
  totalExams: number
  totalCorrect: number
  totalQuestions: number
  studyMinutes: number
  trend: 'improving' | 'declining' | 'stable'
}

// ─── Chapter Performance ──────────────────────────────────────────

export interface ChapterAnalytics {
  chapterId: string
  chapterName: string
  subjectName: string
  averageScore: number
  attemptCount: number
  studyMinutes: number
}

// ─── Revision Analytics ──────────────────────────────────────────

export interface RevisionAnalytics {
  totalReviews: number
  completedReviews: number
  overdueItems: number
  averageConfidence: number
  reviewsByDay: DailyDataPoint[]
}

// ─── Main Analytics Response ─────────────────────────────────────

export interface StudentAnalytics {
  summary: StudentAnalyticsSummary
  /** Daily study time for the selected period */
  dailyStudyTime: StudyTimeDataPoint[]
  /** Weekly study time for the selected period */
  weeklyStudyTime: DailyDataPoint[]
  /** Monthly study time across all available data */
  monthlyStudyTime: DailyDataPoint[]
  /** MCQ accuracy trend over time */
  mcqAccuracyTrend: AccuracyDataPoint[]
  /** CQ activity over time */
  cqActivityTrend: DailyDataPoint[]
  /** Subject performance breakdown */
  subjectPerformance: SubjectAnalytics[]
  /** Chapter-level performance */
  chapterPerformance: ChapterAnalytics[]
  /** Revision analytics */
  revisionAnalytics: RevisionAnalytics
  /** Exam completion trend */
  examCompletionTrend: DailyDataPoint[]
  /** Study time distribution by subject */
  studyTimeBySubject: { subjectName: string; minutes: number }[]
}

// ─── Period Labels for UI ─────────────────────────────────────────

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  'today': 'আজ',
  'thisWeek': 'এই সপ্তাহ',
  '7d': 'শেষ ৭ দিন',
  '30d': 'শেষ ৩০ দিন',
  '90d': 'শেষ ৯০ দিন',
  '1y': 'শেষ ১ বছর',
  'custom': 'কাস্টম রেঞ্জ',
}

export const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'আজ' },
  { value: 'thisWeek', label: 'এই সপ্তাহ' },
  { value: '7d', label: '৭ দিন' },
  { value: '30d', label: '৩০ দিন' },
  { value: '90d', label: '৯০ দিন' },
  { value: '1y', label: '১ বছর' },
]
