export interface RecentLecture {
  id: string
  title: string
  subject: string
  chapter?: string
  progress: number
  viewedAt?: string
}

export interface ExamResultData {
  id: string
  subject: string
  score: number
  total: number
  date: string
}

export interface DetailedPayment {
  id: string
  contentType: string
  contentId: string
  contentTitle: string
  amount: number
  method: string
  transactionId: string
  status: string
  adminNote: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface BundleItemData {
  id: string
  contentType: string
  contentId: string
  contentTitle: string | null
  contentPrice: number
  order: number
}

export interface SubscriptionData {
  id: string
  packageId: string
  packageName: string
  packageThumbnail: string | null
  durationLabel: string
  classLevel: string
  classLabel: string
  startDate: string
  endDate: string
  isActive: boolean
  isExpired: boolean
  daysRemaining: number
  paymentId: string | null
}

export interface DashboardData {
  stats: {
    completedLectures: number
    totalLectures: number
    avgMcqScore: number
    savedQuestions: number
    isPremium: boolean
    premiumExpiry: string | null
  }
  recentExams: ExamResultData[]
}

export interface BookmarkData {
  id: string
  contentId: string
  contentType: string
  contentTitle: string
  createdAt: string
}

export interface RecentlyViewedItem {
  id: string
  contentId: string
  contentType: string
  title: string
  viewedAt: string
}

// ════════════════════════════════════════════
// Weakness Detection Types (Phase 6)
// ════════════════════════════════════════════

export interface WeaknessItem {
  /** Unique identifier (e.g. `subject-${subjectId}` or `chapter-${chapterId}`) */
  id: string
  subjectId: string
  chapterId?: string
  /** Topic-level identifier when available */
  topicId?: string
  subjectName: string
  chapterName?: string
  /** Topic name when available */
  topicName?: string
  /** Type of content the weakness relates to */
  contentType: 'mcq' | 'cq' | 'lecture'
  /** Number of attempted items */
  attemptCount: number
  /** Number of correct/submitted items */
  correctCount: number
  /** Number of wrong/low-quality items */
  wrongCount: number
  /** Accuracy percentage (0-100) */
  accuracy: number
  /** Severity level mapped from accuracy */
  severity: 'critical' | 'high' | 'medium' | 'healthy'
  /** Trend direction based on recent vs older performance */
  trend: 'improving' | 'declining' | 'stable'
  /** ISO date of last attempt */
  lastAttempt: string
  /** Confidence score combining accuracy, volume, and recency (0-100) */
  confidenceScore: number
  /** Bengali action text explaining what the student should do */
  recommendedAction: string
  /** Route name to navigate to */
  recommendedRoute: string
  /** Optional route params */
  recommendedRouteParams?: Record<string, string>
}

export interface WeaknessSummary {
  critical: number
  high: number
  medium: number
  healthy: number
}

export interface WeaknessAction {
  /** ID of the weakness item this action relates to */
  itemId: string
  /** Bengali action text */
  action: string
  /** Route name to navigate to */
  route: string
  /** Optional route params */
  routeParams?: Record<string, string>
}

export interface WeaknessData {
  summary: WeaknessSummary
  items: WeaknessItem[]
  /** Convenience array: items with subject-level critical/high/medium severity */
  weakSubjects: WeaknessItem[]
  /** Convenience array: items with chapter-level critical/high/medium severity */
  weakChapters: WeaknessItem[]
  /** Convenience array: items with topic-level granularity */
  weakTopics: WeaknessItem[]
  /** Flattened recommended actions for quick access */
  recommendedActions: WeaknessAction[]
}

// ════════════════════════════════════════════
// Learning Dashboard Types (Phase 1)
// ════════════════════════════════════════════

export interface StudyStreak {
  currentStreak: number
  longestStreak: number
  activeDates: string[] // ISO date strings for the last 7 days
  todayActive: boolean
}

export interface TodayProgress {
  completedLectures: number
  startedLectures: number
  mcqSolved: number
  cqWritten: number
  studyMinutes: number
  goalMinutes: number
}

export interface WeeklyProgress {
  weekStart: string
  weekEnd: string
  lecturesCompleted: number
  mcqSolved: number
  cqWritten: number
  studyMinutes: number
  previousWeek: {
    lecturesCompleted: number
    mcqSolved: number
    cqWritten: number
    studyMinutes: number
  }
}

export interface SubjectPerformance {
  subjectId: string
  subjectName: string
  averageScore: number
  totalExams: number
  totalCorrect: number
  totalQuestions: number
}

export interface UpcomingExam {
  id: string
  packageId: string
  packageTitle: string
  title: string
  type: 'mcq' | 'cq'
  scheduledDate: string
  duration: number
  totalMarks: number
}

// ════════════════════════════════════════════
// Recommendation Types (Phase 2)
// ════════════════════════════════════════════

export interface RecommendationItem {
  /** Unique identifier for the recommended content */
  id: string
  /** Content type: lecture, mcq-subject, exam, bookmark */
  type: 'lecture' | 'mcq' | 'exam' | 'bookmark'
  /** Display title */
  title: string
  /** Subject or chapter context */
  subtitle?: string
  /** Short Bengali reason badge text (e.g. "চালিয়ে যান", "দুর্বল বিষয়") */
  reason: string
  /** CSS class for the reason badge color */
  reasonColor: string
  /** URL or route params to navigate */
  route: string
  /** Route params for navigation */
  routeParams?: Record<string, string>
  /** Progress percentage (0-100) if applicable */
  progress?: number
  /** Thumbnail URL if available */
  thumbnail?: string | null
  /** Priority weight for ordering (higher = more important) */
  priority: number
}

export interface LearningDashboardData {
  streak: StudyStreak
  today: TodayProgress
  weekly: WeeklyProgress
  subjectPerformance: SubjectPerformance[]
  upcomingExams: UpcomingExam[]
}

// ════════════════════════════════════════════
// Revision Queue Types (Phase 8 — Smart Revision Engine)
// ════════════════════════════════════════════

export interface RevisionItem {
  id: string
  contentType: 'lecture' | 'mcq-chapter' | 'cq-chapter' | 'exam'
  contentId: string
  subjectId: string
  chapterId?: string
  title: string
  subtitle?: string
  /** Current SM-2 interval in days */
  intervalDays: number
  /** SM-2 ease factor */
  easeFactor: number
  /** Number of successful reviews completed */
  reviewCount: number
  /** Confidence score (0-100) */
  confidenceScore: number
  /** ISO date when this item is next due */
  nextReviewAt: string
  /** ISO date of last review, if any */
  lastReviewedAt?: string
  /** Whether review is completed for current cycle */
  isCompleted: boolean
  /** Route to navigate to for review */
  route: string
  /** Route params for navigation */
  routeParams?: Record<string, string>
  /** Priority score (higher = more urgent) */
  priority: number
  /** Estimated review time in minutes */
  reviewDuration: number
}

export interface RevisionSummary {
  /** Items due today */
  todayCount: number
  /** Items overdue (past due date) */
  overdueCount: number
  /** Items scheduled for future */
  upcomingCount: number
  /** Items completed this cycle */
  completedCount: number
  /** Total items in queue */
  totalCount: number
  /** Completion percentage */
  completionPercent: number
}

export interface RevisionData {
  items: RevisionItem[]
  summary: RevisionSummary
}

/** Request body for PATCH /api/user/revision */
export interface RevisionUpdateRequest {
  id: string
  /** How well the user performed: 0=forgot, 1=hard, 2=good, 3=easy */
  quality: 0 | 1 | 2 | 3
  /** Whether to skip this item */
  skip?: boolean
}
