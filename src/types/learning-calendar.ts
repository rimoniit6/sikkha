/**
 * Learning Calendar — GitHub-style activity heatmap types.
 *
 * Designed for lightweight CSS Grid rendering.
 * Reuses existing data sources via server-side aggregation.
 */

// ─── Activity Levels ───────────────────────────────────────────────

export type ActivityLevel = 0 | 1 | 2 | 3 | 4

export const ACTIVITY_LEVELS = {
  NONE: 0 as const,
  LIGHT: 1 as const,
  MEDIUM: 2 as const,
  HIGH: 3 as const,
  VERY_HIGH: 4 as const,
}

/** Thresholds for activity levels (based on study minutes) */
export const ACTIVITY_THRESHOLDS = {
  LIGHT: 1,       // 1–20 min
  MEDIUM: 21,     // 21–60 min
  HIGH: 61,       // 61–120 min
  VERY_HIGH: 120, // 120+ min
} as const

// ─── Calendar Day Data ─────────────────────────────────────────────

export interface CalendarDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** Activity level 0–4 for color coding */
  level: ActivityLevel
  /** Total study minutes this day */
  studyMinutes: number
  /** Number of MCQs solved */
  mcqCount: number
  /** Number of CQ submissions */
  cqCount: number
  /** Number of revision items completed */
  revisionCount: number
  /** Number of lectures viewed */
  lectureCount: number
  /** Whether this day is in the selected month (vs adjacent month spillover) */
  isCurrentMonth: boolean
  /** Whether this day is today */
  isToday: boolean
}

// ─── Month Data ────────────────────────────────────────────────────

export interface CalendarMonth {
  /** Year (e.g., 2026) */
  year: number
  /** Month (1–12) */
  month: number
  /** Month name in Bengali */
  monthName: string
  /** Total days in this month */
  totalDays: number
  /** First day of week (0 = Sunday, 1 = Monday, …, 6 = Saturday) */
  firstDayOfWeek: number
  /** Days in the month, including leading/trailing days from adjacent months */
  days: CalendarDay[]
  /** Summary stats for this month */
  summary: CalendarMonthSummary
}

export interface CalendarMonthSummary {
  totalStudyMinutes: number
  totalActiveDays: number
  totalMcqs: number
  totalCqs: number
  totalRevisions: number
  totalLectures: number
  currentStreak: number
  longestStreak: number
}

// ─── API Response ──────────────────────────────────────────────────

export interface LearningCalendarResponse {
  month: CalendarMonth
}

// ─── Month Names (Bengali) ─────────────────────────────────────────

export const BENGALI_MONTH_NAMES: Record<number, string> = {
  1: 'জানুয়ারি',
  2: 'ফেব্রুয়ারি',
  3: 'মার্চ',
  4: 'এপ্রিল',
  5: 'মে',
  6: 'জুন',
  7: 'জুলাই',
  8: 'আগস্ট',
  9: 'সেপ্টেম্বর',
  10: 'অক্টোবর',
  11: 'নভেম্বর',
  12: 'ডিসেম্বর',
}

export const WEEKDAY_LABELS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'] as const

// ─── Intensity Colors ──────────────────────────────────────────────

/** Tailwind classes for each activity level (dark-mode aware) */
export const LEVEL_CLASSES: Record<ActivityLevel, string> = {
  0: 'bg-muted/20 dark:bg-muted/10',
  1: 'bg-emerald-200 dark:bg-emerald-900/60',
  2: 'bg-emerald-400 dark:bg-emerald-700',
  3: 'bg-emerald-500 dark:bg-emerald-500',
  4: 'bg-emerald-700 dark:bg-emerald-400',
}
