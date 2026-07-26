/**
 * Smart Achievement System — Type definitions.
 *
 * Static achievement definitions + per-user achievement tracking types.
 * All achievement logic is server-side; the client receives processed results.
 */

// ─── Achievement Category ──────────────────────────────────────────

export type AchievementCategory =
  | 'streak'
  | 'learning'
  | 'mcq'
  | 'cq'
  | 'revision'
  | 'calendar'
  | 'analytics'
  | 'weakness'
  | 'recommendation'
  | 'focus'
  | 'special'

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'streak', 'learning', 'mcq', 'cq', 'revision',
  'calendar', 'analytics', 'weakness', 'recommendation', 'focus', 'special',
]

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: 'স্টাডি স্ট্রিক',
  learning: 'লার্নিং',
  mcq: 'MCQ',
  cq: 'CQ',
  revision: 'রিভিশন',
  calendar: 'ক্যালেন্ডার',
  analytics: 'এনালাইটিক্স',
  weakness: 'দুর্বলতা',
  recommendation: 'রেকমেন্ডেশন',
  focus: 'ফোকাস',
  special: 'বিশেষ',
}

// ─── Achievement Definition (static — not stored in DB) ────────────

export interface AchievementDefinition {
  /** Unique identifier (e.g. \"first-lecture\", \"streak-7\") */
  id: string
  /** Display category */
  category: AchievementCategory
  /** Bengali title */
  title: string
  /** Bengali description */
  description: string
  /** Icon component name (Lucide) */
  icon: string
  /** Target value to unlock (e.g. 7 for \"Read 7 lectures\") */
  target: number
  /** Achievement tier */
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  /** How to measure progress */
  measure: 'count' | 'streak' | 'percentage' | 'days' | 'hours' | 'boolean'
}

// ─── All Achievement Definitions ───────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ═══ STREAK ═══
  {
    id: 'first-day',
    category: 'streak',
    title: 'প্রথম দিন',
    description: 'প্রথমবারের মতো পড়াশোনা শুরু করুন',
    icon: 'Zap',
    target: 1,
    tier: 'bronze',
    measure: 'streak',
  },
  {
    id: 'streak-3',
    category: 'streak',
    title: '৩ দিনের স্ট্রিক',
    description: 'টানা ৩ দিন পড়াশোনা চালিয়ে যান',
    icon: 'Flame',
    target: 3,
    tier: 'bronze',
    measure: 'streak',
  },
  {
    id: 'streak-7',
    category: 'streak',
    title: '৭ দিনের স্ট্রিক',
    description: 'টানা ৭ দিন পড়াশোনা চালিয়ে যান',
    icon: 'Flame',
    target: 7,
    tier: 'silver',
    measure: 'streak',
  },
  {
    id: 'streak-30',
    category: 'streak',
    title: '৩০ দিনের স্ট্রিক',
    description: 'টানা ৩০ দিন পড়াশোনা চালিয়ে যান',
    icon: 'Award',
    target: 30,
    tier: 'gold',
    measure: 'streak',
  },
  {
    id: 'streak-100',
    category: 'streak',
    title: '১০০ দিনের স্ট্রিক',
    description: 'টানা ১০০ দিন পড়াশোনা চালিয়ে যান — অসাধারণ!',
    icon: 'Trophy',
    target: 100,
    tier: 'diamond',
    measure: 'streak',
  },

  // ═══ LEARNING ═══
  {
    id: 'first-lecture',
    category: 'learning',
    title: 'প্রথম লেকচার',
    description: 'প্রথম লেকচার সম্পন্ন করুন',
    icon: 'BookOpen',
    target: 1,
    tier: 'bronze',
    measure: 'count',
  },
  {
    id: 'lectures-10',
    category: 'learning',
    title: '১০ লেকচার',
    description: '১০টি লেকচার সম্পন্ন করুন',
    icon: 'BookOpen',
    target: 10,
    tier: 'bronze',
    measure: 'count',
  },
  {
    id: 'lectures-100',
    category: 'learning',
    title: '১০০ লেকচার',
    description: '১০০টি লেকচার সম্পন্ন করুন',
    icon: 'GraduationCap',
    target: 100,
    tier: 'silver',
    measure: 'count',
  },
  {
    id: 'lectures-500',
    category: 'learning',
    title: '৫০০ লেকচার',
    description: '৫০০টি লেকচার সম্পন্ন করুন — চমৎকার অধ্যবসায়!',
    icon: 'Library',
    target: 500,
    tier: 'gold',
    measure: 'count',
  },

  // ═══ MCQ ═══
  {
    id: 'first-mcq',
    category: 'mcq',
    title: 'প্রথম MCQ',
    description: 'প্রথম MCQ পরীক্ষা দিন',
    icon: 'FileQuestion',
    target: 1,
    tier: 'bronze',
    measure: 'count',
  },
  {
    id: 'mcq-100',
    category: 'mcq',
    title: '১০০ MCQ',
    description: '১০০টি MCQ সমাধান করুন',
    icon: 'FileQuestion',
    target: 100,
    tier: 'silver',
    measure: 'count',
  },
  {
    id: 'mcq-500',
    category: 'mcq',
    title: '৫০০ MCQ',
    description: '৫০০টি MCQ সমাধান করুন',
    icon: 'BrainCircuit',
    target: 500,
    tier: 'gold',
    measure: 'count',
  },
  {
    id: 'perfect-score',
    category: 'mcq',
    title: 'পারফেক্ট স্কোর',
    description: 'যেকোনো পরীক্ষায় ১০০% স্কোর অর্জন করুন',
    icon: 'Target',
    target: 100,
    tier: 'gold',
    measure: 'percentage',
  },
  {
    id: 'accuracy-90',
    category: 'mcq',
    title: '৯০%+ নির্ভুলতা',
    description: 'যেকোনো পরীক্ষায় ৯০% এর বেশি নির্ভুলতা অর্জন করুন',
    icon: 'Crosshair',
    target: 90,
    tier: 'silver',
    measure: 'percentage',
  },

  // ═══ CQ ═══
  {
    id: 'first-cq',
    category: 'cq',
    title: 'প্রথম CQ',
    description: 'প্রথম CQ জমা দিন',
    icon: 'FileText',
    target: 1,
    tier: 'bronze',
    measure: 'count',
  },
  {
    id: 'cq-50',
    category: 'cq',
    title: '৫০ CQ',
    description: '৫০টি CQ জমা দিন',
    icon: 'FileText',
    target: 50,
    tier: 'silver',
    measure: 'count',
  },

  // ═══ REVISION ═══
  {
    id: 'first-revision',
    category: 'revision',
    title: 'প্রথম রিভিশন',
    description: 'প্রথম রিভিশন সম্পন্ন করুন',
    icon: 'RefreshCw',
    target: 1,
    tier: 'bronze',
    measure: 'count',
  },
  {
    id: 'revision-25',
    category: 'revision',
    title: '২৫ রিভিশন',
    description: '২৫টি রিভিশন সম্পন্ন করুন',
    icon: 'RefreshCw',
    target: 25,
    tier: 'silver',
    measure: 'count',
  },
  {
    id: 'revision-100',
    category: 'revision',
    title: '১০০ রিভিশন',
    description: '১০০টি রিভিশন সম্পন্ন করুন',
    icon: 'BrainCircuit',
    target: 100,
    tier: 'gold',
    measure: 'count',
  },
  {
    id: 'never-miss-7',
    category: 'revision',
    title: '৭ দিন মিস নেই',
    description: 'টানা ৭ দিন প্রতিদিন রিভিশন সম্পন্ন করুন',
    icon: 'CalendarCheck',
    target: 7,
    tier: 'silver',
    measure: 'days',
  },

  // ═══ CALENDAR ═══
  {
    id: 'active-20',
    category: 'calendar',
    title: '২০ দিন সক্রিয়',
    description: 'এক মাসে ২০ দিন পড়াশোনা করুন',
    icon: 'CalendarDays',
    target: 20,
    tier: 'silver',
    measure: 'days',
  },
  {
    id: 'active-28',
    category: 'calendar',
    title: '২৮ দিন সক্রিয়',
    description: 'এক মাসে ২৮ দিন পড়াশোনা করুন',
    icon: 'CalendarDays',
    target: 28,
    tier: 'gold',
    measure: 'days',
  },

  // ═══ ANALYTICS ═══
  {
    id: 'hours-10',
    category: 'analytics',
    title: '১০ ঘণ্টা পড়া',
    description: 'মোট ১০ ঘণ্টা পড়াশোনা করুন',
    icon: 'Clock',
    target: 10,
    tier: 'bronze',
    measure: 'hours',
  },
  {
    id: 'hours-100',
    category: 'analytics',
    title: '১০০ ঘণ্টা পড়া',
    description: 'মোট ১০০ ঘণ্টা পড়াশোনা করুন',
    icon: 'Timer',
    target: 100,
    tier: 'gold',
    measure: 'hours',
  },

  // ═══ WEAKNESS ═══
  {
    id: 'recover-weak',
    category: 'weakness',
    title: 'দুর্বলতা কাটিয়ে ওঠা',
    description: 'একটি দুর্বল বিষয়ে উন্নতি করে ৫০% এর উপরে স্কোর আনুন',
    icon: 'TrendingUp',
    target: 50,
    tier: 'silver',
    measure: 'percentage',
  },
  {
    id: 'improve-chapter',
    category: 'weakness',
    title: 'অধ্যায়ে উন্নতি',
    description: 'যেকোনো অধ্যায়ে ২০% উন্নতি অর্জন করুন',
    icon: 'ArrowUp',
    target: 20,
    tier: 'bronze',
    measure: 'percentage',
  },

  // ═══ RECOMMENDATION ═══
  {
    id: 'first-recommendation',
    category: 'recommendation',
    title: 'প্রথম রেকমেন্ডেশন',
    description: 'একটি রেকমেন্ডেড লেকচার সম্পন্ন করুন',
    icon: 'Sparkles',
    target: 1,
    tier: 'bronze',
    measure: 'count',
  },

  // ═══ FOCUS ═══
  {
    id: 'focus-5hr',
    category: 'focus',
    title: '৫ ঘণ্টা ফোকাস',
    description: 'মোট ৫ ঘণ্টা ফোকাস মোডে পড়াশোনা করুন',
    icon: 'Target',
    target: 5,
    tier: 'bronze',
    measure: 'hours',
  },
  {
    id: 'focus-20hr',
    category: 'focus',
    title: '২০ ঘণ্টা ফোকাস',
    description: 'মোট ২০ ঘণ্টা ফোকাস মোডে পড়াশোনা করুন',
    icon: 'Crosshair',
    target: 20,
    tier: 'silver',
    measure: 'hours',
  },

  // ═══ SPECIAL ═══
  {
    id: 'early-bird',
    category: 'special',
    title: 'সকালের পাখি',
    description: 'সকাল ৬-৯টার মধ্যে পড়াশোনা করুন',
    icon: 'Sunrise',
    target: 1,
    tier: 'bronze',
    measure: 'boolean',
  },
  {
    id: 'night-owl',
    category: 'special',
    title: 'নাইট আউল',
    description: 'রাত ১০টার পরে পড়াশোনা করুন',
    icon: 'Moon',
    target: 1,
    tier: 'bronze',
    measure: 'boolean',
  },
  {
    id: 'weekend-warrior',
    category: 'special',
    title: 'উইকেন্ড ওয়ারিয়র',
    description: 'শুক্রবার বা শনিবার পড়াশোনা করুন',
    icon: 'CalendarDays',
    target: 1,
    tier: 'bronze',
    measure: 'boolean',
  },

  // ═══ ANALYTICS (additional) ═══
  {
    id: 'daily-goals-30',
    category: 'analytics',
    title: '৩০ দিনের লক্ষ্য',
    description: '৩০ দিন দৈনিক পড়ার লক্ষ্য পূরণ করুন',
    icon: 'CheckCheck',
    target: 30,
    tier: 'silver',
    measure: 'days',
  },
]

// ─── Per-User Achievement State ────────────────────────────────────

export interface UserAchievementState {
  /** Achievement definition ID */
  achievementId: string
  /** Current progress (0-100) */
  progress: number
  /** Whether the achievement is unlocked */
  unlocked: boolean
  /** When unlocked */
  unlockedAt: string | null
  /** When claimed */
  claimedAt: string | null
  /** Optional JSON metadata */
  metadata: string | null
}

// ─── Dashboard Data ────────────────────────────────────────────────

export interface AchievementDashboardData {
  /** All achievements with user progress merged */
  achievements: AchievementCardData[]
  /** Summary statistics */
  summary: AchievementSummary
}

export interface AchievementCardData {
  /** Achievement definition */
  definition: AchievementDefinition
  /** User progress state (or null if not yet started) */
  userState: UserAchievementState | null
  /** Calculated progress percentage (0-100) */
  progressPercent: number
  /** Whether just unlocked (for animation) */
  isNewlyUnlocked: boolean
}

export interface AchievementSummary {
  /** Total achievements count */
  totalCount: number
  /** Unlocked count */
  unlockedCount: number
  /** Claimed count */
  claimedCount: number
  /** Overall completion percentage */
  completionPercent: number
  /** Recently unlocked (last 7 days) */
  recentUnlocks: AchievementCardData[]
}

// ─── API Types ─────────────────────────────────────────────────────

export interface ClaimRewardResponse {
  success: boolean
  claimedAt: string
}

export interface CheckAchievementsResponse {
  success: boolean
  newUnlocks: string[] // achievement IDs that were just unlocked
}
