'use client'

import { useIsAuthenticated } from '@/store/auth'
import ScrollProgress from './ScrollProgress'
import HeroSection from './HeroSection'
import AchievementBadgesSection from './AchievementBadgesSection'
import FeaturedContentSection from './FeaturedContentSection'
import QuickSearchSection from './QuickSearchSection'
import SubjectExplorerSection from './SubjectExplorerSection'
import RecentContentSection from './RecentContentSection'
import NoticeBoardSection from './NoticeBoardSection'
import WhyChooseUsSection from './WhyChooseUsSection'
import ExamCountdownSection from './ExamCountdownSection'
import BoardQuestionSection from './BoardQuestionSection'
import PremiumBanner from './PremiumBanner'
import TeacherModeratorsSection from './TeacherModeratorsSection'
import StudentShowcaseSection from './StudentShowcaseSection'
import FAQSection from './FAQSection'
import NewsletterSection from './NewsletterSection'
import CTASection from './CTASection'

import HomeDashboard from './HomeDashboard'

export default function HomePage() {
  const isAuthenticated = useIsAuthenticated()

  return (
    <main className="min-h-screen">
      <ScrollProgress />

      {isAuthenticated ? (
        /* ── Authenticated: mobile-first student dashboard (no marketing) ── */
        <HomeDashboard />
      ) : (
        /* ── Guest: full marketing landing page ── */
        <>
          <HeroSection />
          <AchievementBadgesSection />
          <FeaturedContentSection />
          <QuickSearchSection />
          <SubjectExplorerSection />
          <RecentContentSection />
          <NoticeBoardSection />
          <WhyChooseUsSection />
          <ExamCountdownSection />
          <BoardQuestionSection />
          <PremiumBanner />
          <TeacherModeratorsSection />
          <StudentShowcaseSection />
          <FAQSection />
          <NewsletterSection />
          <CTASection />
        </>
      )}
    </main>
  )
}
