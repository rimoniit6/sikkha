'use client'

import { useState, type ReactNode, type RefObject } from 'react'
import {
  Clock, Crown, Package, ShoppingBag, Sparkles, Timer, CreditCard, MessageSquareText, Settings2, LayoutDashboard,
  GraduationCap, FileCheck, Heart, Target, ChevronRight
} from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useUserDashboard } from '@/hooks/user/use-user-dashboard'
import { useLearningDashboard } from '@/hooks/user/use-learning-dashboard'
import { useRecentLectures } from '@/hooks/user/use-recent-lectures'

// Import sub-components
import { StatCards } from './dashboard/StatCards'
import { PurchasedContent } from './dashboard/PurchasedContent'
import { LearningSection } from './dashboard/LearningSection'
import { ExamsSection } from './dashboard/ExamsSection'
import { BookmarksSection } from './dashboard/BookmarksSection'
import { PaymentHistory } from './dashboard/PaymentHistory'
import { BundleDetailDialog } from './dashboard/BundleDetailDialog'
import { EditProfileDialog } from './dashboard/EditProfileDialog'
import CustomExamHistory from './dashboard/CustomExamHistory'
import FeedbackSection from './dashboard/FeedbackSection'
import LearningPreferences from './learning/LearningPreferences'
import { StudyStreak } from './dashboard/StudyStreak'
import { TodayProgress } from './dashboard/TodayProgress'
import { WeeklyProgress } from './dashboard/WeeklyProgress'
import { UpcomingExams } from './dashboard/UpcomingExams'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { useRecommendations } from '@/hooks/user/use-recommendations'
import { RecommendationsSection } from './dashboard/RecommendationsSection'
import { useWeaknessDetection } from '@/hooks/user/use-weakness-detection'
import { NeedAttentionSection } from './dashboard/NeedAttentionSection'
import { NeedAttentionErrorBoundary } from './dashboard/NeedAttentionErrorBoundary'
import { SectionErrorBoundary } from './dashboard/SectionErrorBoundary'
import { useRevisionQueue } from '@/hooks/user/use-revision-queue'
import { RevisionSection } from './dashboard/RevisionSection'
import { useGenerateNotifications } from '@/hooks/user/use-generate-notifications'
import StudentAnalyticsSection from './dashboard/StudentAnalyticsSection'
import LearningCalendarSection from './dashboard/LearningCalendarSection'
import StudyInsightsSection from './dashboard/StudyInsightsSection'
import AchievementsSection from './dashboard/AchievementsSection'
import type { SubjectPerformance } from '@/types/user-dashboard'

function SubjectPerformanceBadges({ subjects }: { subjects: SubjectPerformance[] }) {
  const top = subjects.filter(s => s.averageScore >= 70).slice(0, 3)
  const weak = subjects.filter(s => s.averageScore < 50).slice(0, 3)
  if (top.length === 0 && weak.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {top.map(s => (
        <div
          key={s.subjectId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 text-xs"
        >
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300">{s.subjectName}</span>
          <span className="text-emerald-500 dark:text-emerald-400 tabular-nums">{s.averageScore}%</span>
        </div>
      ))}
      {weak.length > 0 && top.length > 0 && (
        <span className="text-muted-foreground/40 self-center">•</span>
      )}
      {weak.map(s => (
        <div
          key={s.subjectId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 text-xs"
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-700 dark:text-amber-300">{s.subjectName}</span>
          <span className="text-amber-500 dark:text-amber-400 tabular-nums">{s.averageScore}%</span>
        </div>
      ))}
    </div>
  )
}

/** Lightweight lazy-loading wrapper: only renders children when the element enters the viewport */
function LazySection({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: '200px', triggerOnce: true })
  return (
    <div ref={ref as unknown as RefObject<HTMLDivElement>} className={className}>
      {isIntersecting ? children : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      )}
    </div>
  )
}

export default function UserDashboardPage() {
  const navigate = useRouterStore((s) => s.navigate)
  const {
    user,
    loading,
    dashboardData,
    activeTab,
    setActiveTab,
    bundleDialogOpen,
    setBundleDialogOpen,
    selectedBundleTitle,
    bundleItems,
    loadingBundleItems,
    realBookmarks,
    editProfileOpen,
    setEditProfileOpen,
    editName,
    setEditName,
    editMobile,
    setEditMobile,
    updatingProfile,
    navigateToContent,
    handleEditProfile,
    openEditProfile,
    deleteBookmark,
    approvedPayments,
    subscriptionPayments,
    bundlePayments,
    individualPayments,
    pendingPayments,
    rejectedPayments,
    activeSubscriptions,
    loadingPayments,
    payments,
  } = useUserDashboard()

  const { data: recentLectures } = useRecentLectures()
  const isDashboardLoaded = !!dashboardData
  const { data: learningData, loading: learningLoading } = useLearningDashboard({ enabled: isDashboardLoaded })
  const { data: recommendations, loading: recsLoading } = useRecommendations({ enabled: isDashboardLoaded })
  const { data: weaknessData, loading: weaknessLoading } = useWeaknessDetection({ enabled: isDashboardLoaded })
  const { data: revisionData, loading: revisionLoading, error: revisionError, completeRevision, skipRevision } = useRevisionQueue({ enabled: isDashboardLoaded })
  useGenerateNotifications() // Generate intelligent notifications on dashboard load
  const [showLearningDashboard, setShowLearningDashboard] = useState(true)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 dark:to-background">
        <div className="h-32 sm:h-36 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
        <div className="max-w-5xl mx-auto px-4 -mt-16 sm:-mt-20">
          <Skeleton className="h-24 sm:h-28 rounded-2xl mb-6 bg-white/80 dark:bg-white/5 backdrop-blur-sm" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 sm:h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!dashboardData) return null

  const { stats, recentExams } = dashboardData
  const bookmarkedQuestions = realBookmarks.map(b => ({
    id: b.id,
    contentId: b.contentId,
    text: b.contentTitle,
    type: b.contentType,
  }))

  const userName = user?.name || 'শিক্ষার্থী'
  const userInitials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 to-background dark:from-emerald-950/10 dark:to-background">
      {/* ═══════════════════ Hero Profile Section ═══════════════════ */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-400/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="absolute -inset-1.5 bg-white/20 rounded-full blur-md" />
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-3 border-white/40 relative backdrop-blur-sm">
                <AvatarFallback className="bg-white/25 text-white text-xl sm:text-2xl font-bold backdrop-blur-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-300 rounded-full border-2 border-white/50 shadow-lg shadow-emerald-400/50" />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight animate-fade-in">
                স্বাগতম, {userName}!
              </h1>
              <p className="text-emerald-100/80 text-xs sm:text-sm mt-0.5 flex items-center gap-2 animate-fade-in">
                আপনার শিক্ষা যাত্রা চলুক
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  onClick={openEditProfile}
                >
                  <Sparkles className="size-3 mr-1" />
                  এডিট
                </Button>
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap animate-fade-in-up">
                {activeSubscriptions.length > 0 && (
                  <Badge className="bg-purple-500/30 text-purple-100 gap-1 border-purple-400/20 backdrop-blur-sm text-[10px] sm:text-xs">
                    <Crown className="size-3" />
                    {activeSubscriptions.length}টি সাবস্ক্রিপশন
                  </Badge>
                )}
                {bundlePayments.length > 0 && (
                  <Badge className="bg-teal-500/30 text-teal-100 gap-1 border-teal-400/20 backdrop-blur-sm text-[10px] sm:text-xs">
                    <Package className="size-3" />
                    {bundlePayments.length}টি বান্ডেল
                  </Badge>
                )}
                {individualPayments.length > 0 && (
                  <Badge className="bg-white/20 text-white gap-1 border-white/20 backdrop-blur-sm text-[10px] sm:text-xs">
                    <ShoppingBag className="size-3" />
                    {individualPayments.length}টি কেনা
                  </Badge>
                )}
                {pendingPayments.length > 0 && (
                  <Badge className="bg-amber-500/30 text-amber-100 gap-1 border-amber-400/20 backdrop-blur-sm text-[10px] sm:text-xs">
                    <Clock className="size-3" />
                    {pendingPayments.length}টি অপেক্ষমাণ
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 40V20C240 0 480 0 720 20C960 40 1200 40 1440 20V40H0Z" className="fill-emerald-50/30 dark:fill-emerald-950/10" />
          </svg>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-4 relative z-20 pb-10">
        <StatCards
          stats={stats}
          approvedPaymentsCount={approvedPayments.length}
          onPurchasedClick={() => setActiveTab('purchased')}
        />

        {/* ═══════════════ Quick Access Card Grid ═══════════════ */}
        {(() => {
          const sections = [
            { id: 'purchased' as const, title: 'কেনা কন্টেন্ট', subtitle: 'Purchased Content', icon: ShoppingBag, gradient: 'from-emerald-500 to-teal-600', iconColor: 'text-emerald-600 dark:text-emerald-400', glowColor: 'shadow-emerald-500/25', badge: approvedPayments.length || undefined },
            { id: 'learning' as const, title: 'লেখাপড়া', subtitle: 'Learning', icon: GraduationCap, gradient: 'from-blue-500 to-indigo-600', iconColor: 'text-blue-600 dark:text-blue-400', glowColor: 'shadow-blue-500/25', badge: recentLectures.length || undefined },
            { id: 'exams' as const, title: 'পরীক্ষা', subtitle: 'Exams', icon: FileCheck, gradient: 'from-purple-500 to-violet-600', iconColor: 'text-purple-600 dark:text-purple-400', glowColor: 'shadow-purple-500/25', badge: recentExams.length || undefined },
            { id: 'bookmarks' as const, title: 'সেভ', subtitle: 'Saved', icon: Heart, gradient: 'from-rose-500 to-pink-600', iconColor: 'text-rose-600 dark:text-rose-400', glowColor: 'shadow-rose-500/25', badge: bookmarkedQuestions.length || undefined },
            { id: 'payments' as const, title: 'পেমেন্ট', subtitle: 'Payments', icon: CreditCard, gradient: 'from-amber-500 to-orange-600', iconColor: 'text-amber-600 dark:text-amber-400', glowColor: 'shadow-amber-500/25', badge: payments.length || undefined },
            { id: 'feedback' as const, title: 'ফিডব্যাক', subtitle: 'Feedback', icon: MessageSquareText, gradient: 'from-cyan-500 to-sky-600', iconColor: 'text-cyan-600 dark:text-cyan-400', glowColor: 'shadow-cyan-500/25' },
            { id: 'custom-exams' as const, title: 'কাস্টম এক্সাম', subtitle: 'Custom Exam', icon: Target, gradient: 'from-violet-500 to-fuchsia-600', iconColor: 'text-violet-600 dark:text-violet-400', glowColor: 'shadow-violet-500/25' },
            { id: 'preferences' as const, title: 'পছন্দ', subtitle: 'Settings', icon: Settings2, gradient: 'from-slate-500 to-gray-600', iconColor: 'text-slate-600 dark:text-slate-400', glowColor: 'shadow-slate-500/25' },
          ]

          return (
            <div className="mb-6 sm:mb-8" role="tablist" aria-label="Dashboard sections">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {sections.map((section) => {
                  const isActive = activeTab === section.id
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={section.title}
                      onClick={() => setActiveTab(section.id)}
                      className={`group relative flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isActive
                          ? `bg-gradient-to-br ${section.gradient} text-white border-transparent shadow-lg ${section.glowColor} scale-[1.02]`
                          : 'bg-card border-border/60 hover:border-border hover:shadow-md hover:scale-[1.02] hover:shadow-black/5 dark:hover:shadow-black/20'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl shrink-0 transition-colors duration-200 ${
                        isActive
                          ? 'bg-white/20'
                          : 'bg-muted/70 group-hover:bg-muted'
                      }`}>
                        <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 transition-colors duration-200 ${
                          isActive ? 'text-white' : section.iconColor
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm sm:text-[15px] font-semibold leading-tight truncate transition-colors duration-200 ${
                          isActive ? 'text-white' : 'text-foreground'
                        }`}>{section.title}</p>
                        <p className={`text-[11px] sm:text-xs mt-0.5 truncate transition-colors duration-200 ${
                          isActive ? 'text-white/70' : 'text-muted-foreground'
                        }`}>{section.subtitle}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {section.badge !== undefined && section.badge > 0 && (
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] sm:text-[11px] font-bold tabular-nums transition-colors duration-200 ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}>{section.badge}</span>
                        )}
                        <ChevronRight className={`w-4 h-4 transition-all duration-200 ${
                          isActive
                            ? 'text-white/60 translate-x-0'
                            : 'text-muted-foreground/40 -translate-x-0.5 group-hover:translate-x-0 group-hover:text-muted-foreground/70'
                        }`} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ═══════════════ Section Content ═══════════════ */}
        <div role="tabpanel" aria-label="Section content">
          {activeTab === 'purchased' && (
            <PurchasedContent
              loading={loadingPayments}
              approvedPayments={approvedPayments}
              subscriptionPayments={subscriptionPayments}
              bundlePayments={bundlePayments}
              individualPayments={individualPayments}
              activeSubscriptions={activeSubscriptions}
              onNavigate={navigateToContent}
              onExplore={() => navigate('home')}
            />
          )}

          {activeTab === 'learning' && (
            <LearningSection
              recentLectures={recentLectures}
              onNavigate={navigateToContent}
            />
          )}

          {activeTab === 'exams' && (
            <ExamsSection
              recentExams={recentExams}
              onHistoryClick={() => navigate('mcq-exam-history')}
              onResultClick={(resultId) => navigate('exam-result', { resultId })}
            />
          )}

          {activeTab === 'bookmarks' && (
            <BookmarksSection
              bookmarkedQuestions={bookmarkedQuestions}
              onNavigate={navigateToContent}
              onDelete={deleteBookmark}
              onExplore={() => navigate('home')}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentHistory
              payments={payments}
              approvedPaymentsCount={approvedPayments.length}
              pendingPaymentsCount={pendingPayments.length}
              rejectedPaymentsCount={rejectedPayments.length}
            />
          )}

          {activeTab === 'feedback' && <FeedbackSection />}
          {activeTab === 'custom-exams' && <CustomExamHistory />}
          {activeTab === 'preferences' && <LearningPreferences />}
        </div>

        {/* ═══════════════ Learning Dashboard Section (lazy-loaded) ═══════════════ */}
        <SectionErrorBoundary sectionName="লার্নিং ড্যাশবোর্ড">
          {showLearningDashboard && learningLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          ) : learningData ? (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40">
                    <LayoutDashboard className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  লার্নিং ড্যাশবোর্ড
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowLearningDashboard(false)}
                >
                  লুকান
                </Button>
              </div>
              {!learningLoading && learningData && (
                <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    স্ট্রিক: {learningData.streak.currentStreak} দিন
                  </span>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-sky-500" />
                    আজ {learningData.today.completedLectures}টি লেকচার
                  </span>
                </div>
              )}
              {!learningLoading && learningData && learningData.upcomingExams.length > 0 && (
                <div className="text-xs text-rose-500 dark:text-rose-400 mb-3 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse-soft" />
                  {learningData.upcomingExams.length}টি পরীক্ষা আসছে
                </div>
              )}
              <LazySection className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <StudyStreak streak={learningData.streak} />
                <TodayProgress today={learningData.today} />
                <WeeklyProgress weekly={learningData.weekly} />
                <UpcomingExams exams={learningData.upcomingExams} />
              </LazySection>
              {learningData.subjectPerformance.length > 0 && (
                <div className="mt-3">
                  <SubjectPerformanceBadges subjects={learningData.subjectPerformance} />
                </div>
              )}
            </div>
          ) : !showLearningDashboard && (
            <div className="mb-6">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => setShowLearningDashboard(true)}
              >
                <LayoutDashboard className="size-3.5" />
                লার্নিং ড্যাশবোর্ড দেখুন
              </Button>
            </div>
          )}
        </SectionErrorBoundary>

        {/* ═══════════════ Recommendations Section ═══════════════ */}
        <SectionErrorBoundary sectionName="সুপারিশ">
          <RecommendationsSection items={recommendations} loading={recsLoading} />
        </SectionErrorBoundary>

        {/* ═══════════════ Need Attention Section ═══════════════ */}
        <LazySection>
          <NeedAttentionErrorBoundary>
            <NeedAttentionSection data={weaknessData} loading={weaknessLoading} />
          </NeedAttentionErrorBoundary>
        </LazySection>

        {/* ═══════════════ Smart Revision Section ═══════════════ */}
        <LazySection>
          <SectionErrorBoundary sectionName="স্মার্ট রিভিশন">
            <RevisionSection
              data={revisionData}
              loading={revisionLoading}
              error={revisionError}
              onComplete={(id, quality) => { completeRevision(id, quality); }}
              onSkip={(id) => { skipRevision(id); }}
            />
          </SectionErrorBoundary>
        </LazySection>

        {/* ═══════════════ Achievements Section ═══════════════ */}
        <LazySection>
          <SectionErrorBoundary sectionName="অর্জন">
            <AchievementsSection enabled={isDashboardLoaded} />
          </SectionErrorBoundary>
        </LazySection>

        {/* ═══════════════ Learning Calendar Section ═══════════════ */}
        <LazySection>
          <SectionErrorBoundary sectionName="লার্নিং ক্যালেন্ডার">
            <LearningCalendarSection enabled={isDashboardLoaded} />
          </SectionErrorBoundary>
        </LazySection>

        {/* ═══════════════ Study Insights Section ═══════════════ */}
        <LazySection>
          <SectionErrorBoundary sectionName="স্টাডি ইনসাইটস">
            <StudyInsightsSection enabled={isDashboardLoaded} />
          </SectionErrorBoundary>
        </LazySection>

        {/* ═══════════════ Personal Analytics Section ═══════════════ */}
        <LazySection>
          <SectionErrorBoundary sectionName="পার্সোনাল অ্যানালিটিক্স">
            <StudentAnalyticsSection enabled={isDashboardLoaded} />
          </SectionErrorBoundary>
        </LazySection>

        {/* Active Subscription Banner */}
        {activeSubscriptions.length > 0 && (
          <div className="mb-6 sm:mb-8 animate-fade-in-up">
            <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700">
              <CardContent className="p-4 sm:p-6 text-white">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-white/15 backdrop-blur-sm shrink-0">
                    <Crown className="size-5 sm:size-6 text-yellow-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      সাবস্ক্রিপশন সচল
                      <Badge className="bg-yellow-400/20 text-yellow-200 border-yellow-400/30 gap-1 text-[10px] sm:text-xs">
                        <Sparkles className="size-3" />
                        PREMIUM
                      </Badge>
                    </h3>
                    <p className="text-purple-100/80 text-xs sm:text-sm mt-1">
                      {activeSubscriptions.map(s => s.packageName).join(', ')}
                    </p>
                    <div className="flex items-center gap-3 sm:gap-4 mt-2.5 sm:mt-3 flex-wrap">
                      {activeSubscriptions.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 text-xs sm:text-sm">
                          <Badge className="bg-white/15 text-white border-white/20 gap-1 text-[10px] sm:text-xs backdrop-blur-sm">
                            <Timer className="size-3" />
                            {sub.daysRemaining > 0 ? `${sub.daysRemaining} দিন বাকি` : 'শেষ হচ্ছে'}
                          </Badge>
                          <span className="text-purple-200/70 text-[10px] sm:text-xs">{sub.classLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      <BundleDetailDialog
        open={bundleDialogOpen}
        onOpenChange={setBundleDialogOpen}
        title={selectedBundleTitle}
        items={bundleItems}
        loading={loadingBundleItems}
        onNavigate={navigateToContent}
      />

      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        name={editName}
        setName={setEditName}
        mobile={editMobile}
        setMobile={setEditMobile}
        loading={updatingProfile}
        onSave={handleEditProfile}
      />
    </div>
  )
}
