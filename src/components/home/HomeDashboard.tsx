'use client'

import GreetingSection from './GreetingSection'
import PersonalProgressSection from './PersonalProgressSection'
import ResumeLearningSection from './ResumeLearningSection'
import QuickActionsSection from './QuickActionsSection'
import RecentActivitySection from './RecentActivitySection'
import ContinueLearningSection from './ContinueLearningSection'

/**
 * Authenticated-only Student Home Dashboard.
 *
 * Each section self-manages its data and visibility:
 * - GreetingSection: always visible (personalized)
 * - PersonalProgressSection: only if personal stats exist
 * - ResumeLearningSection: only if recent lectures exist
 * - ContinueLearningSection: only if featured content exists
 * - QuickActionsSection: always visible
 * - RecentActivitySection: only if recent views exist
 */
export default function HomeDashboard() {
  return (
    <>
      <GreetingSection />
      <PersonalProgressSection />
      <ResumeLearningSection />
      <ContinueLearningSection />
      <QuickActionsSection />
      <RecentActivitySection />
    </>
  )
}
