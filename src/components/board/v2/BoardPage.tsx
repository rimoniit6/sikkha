'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ClassContextBanner from '@/components/shared/ClassContextBanner'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useRouterStore } from '@/store/router'
import { useAuthUser } from '@/store/auth'
import { useLearningPreference } from '@/providers/LearningPreferenceProvider'
import { useBoardFilterStore } from '@/store/board-filters'
import { useBoardQuestionsData } from '@/hooks/use-board-questions-data'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { useAccessStatus } from '@/hooks/use-access-status'
import { useStats } from '@/hooks/use-stats'
import { useIsMobile } from '@/hooks/use-mobile'
import PurchaseOptionsModal from '@/components/shared/PurchaseOptionsModal'

import { HeroBanner } from './header/HeroBanner'
import { BoardLayout } from './layout/BoardLayout'
import { SearchBar } from './filters/SearchBar'
import { QuickFilterRow } from './filters/QuickFilterRow'
import { TopFilters } from './filters/TopFilters'
import { ActiveFilterChips } from './filters/ActiveFilterChips'
import { FilterBottomSheet } from './filters/FilterBottomSheet'
import { Sidebar } from './filters/Sidebar'
import { AnalyticsBar } from './results/AnalyticsBar'
import { Pagination } from './results/Pagination'
import { PremiumBanner } from './premium/PremiumBanner'
import { LoadingState } from './states/LoadingState'
import { ErrorState } from './states/ErrorState'
import { SelectClassState } from './states/SelectClassState'
import { EmptyState } from './states/EmptyState'
import { McqList } from './cards/McqList'
import { CqList } from './cards/CqList'

import type { BoardQuestionItem } from '@/types/board-questions'

type QuestionTab = 'mcq' | 'cq'

export default function BoardPage() {
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthUser()
  const metadata = useHierarchyMetadata()
  const isMobile = useIsMobile()
  const setLabelMap = useBoardFilterStore((s) => s.setLabelMap)
  const classLevels = useBoardFilterStore((s) => s.classLevels)
  const boards = useBoardFilterStore((s) => s.boards)
  const years = useBoardFilterStore((s) => s.years)
  const subjects = useBoardFilterStore((s) => s.subjects)
  const chapters = useBoardFilterStore((s) => s.chapters)
  const difficulty = useBoardFilterStore((s) => s.difficulty)
  const topics = useBoardFilterStore((s) => s.topics)
  const status = useBoardFilterStore((s) => s.status)
  const contentAccess = useBoardFilterStore((s) => s.contentAccess)

  const [tab, setTab] = useState<QuestionTab>('mcq')
  const [mcqPage, setMcqPage] = useState(1)
  const [cqPage, setCqPage] = useState(1)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseModalData, setPurchaseModalData] = useState<{
    contentType: string; contentId: string; contentTitle: string; contentPrice: number; classLevel?: string
  } | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const filterCount = useBoardFilterStore((s) => s.getFilterCount())
  const setFilter = useBoardFilterStore((s) => s.setFilter)

  const { classLevel: learningClassLevel, learningMode: lMode } = useLearningPreference()

  // Initialize classLevels from learning preference on mount
  useEffect(() => {
    if (lMode === 'CLASS_BASED' && learningClassLevel && classLevels.length === 0) {
      setFilter('classLevels', [learningClassLevel])
    }
  }, [lMode, learningClassLevel, classLevels.length, setFilter])

  const filterSignature = useMemo(
    () => [classLevels.join(','), boards.join(','), years.join(','), subjects.join(','), chapters.join(','), difficulty.join(','), topics.join(','), status.join(','), contentAccess].join('|'),
    [classLevels, boards, years, subjects, chapters, difficulty, topics, status, contentAccess],
  )

  useEffect(() => {
    const id = window.setTimeout(() => { setMcqPage(1); setCqPage(1) }, 0)
    return () => window.clearTimeout(id)
  }, [filterSignature])

  const handleTabChange = useCallback((value: string) => {
    setTab(value as QuestionTab)
  }, [])

  const hasClassSelected = classLevels.length > 0

  const {
    questions: mcqQuestions, analytics: mcqAnalytics, isLoading: mcqLoading, error: mcqError, pagination: mcqPagination, refetch: mcqRefetch,
  } = useBoardQuestionsData(hasClassSelected ? mcqPage : 1, 10, 'mcq')

  const {
    questions: cqQuestions, analytics: cqAnalytics, isLoading: cqLoading, error: cqError, pagination: cqPagination, refetch: cqRefetch,
  } = useBoardQuestionsData(hasClassSelected ? cqPage : 1, 10, 'cq')

  const mcqAccessMap = useAccessStatus(hasClassSelected ? mcqQuestions : [])
  const cqAccessMap = useAccessStatus(hasClassSelected ? cqQuestions : [])

  const analytics = tab === 'mcq' ? mcqAnalytics : cqAnalytics
  const isLoading = tab === 'mcq' ? mcqLoading : cqLoading

  const { data: stats } = useStats()

  const totalQuestions = analytics.totalQuestions || 12500
  const recentAdded = analytics.totalQuestions || 240

  const scrollToResults = useCallback(() => {
    if (isMobile) return
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isMobile])

  const handleBookmark = useCallback((q: BoardQuestionItem) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(q.id)) next.delete(q.id)
      else next.add(q.id)
      return next
    })
  }, [])

  const handleShare = useCallback((_q: BoardQuestionItem) => {
    // Share functionality - to be implemented
  }, [])

  const handleUnlock = useCallback((q: BoardQuestionItem) => {
    if (!user) { navigate('login'); return }
    setPurchaseModalData({
      contentType: q.type === 'mcq' ? 'board-mcq' : 'board-cq',
      contentId: q.id,
      contentTitle: `${metadata.getBoardName(q.board)} - ${q.year} (${q.type.toUpperCase()})`,
      contentPrice: q.price,
      classLevel: q.classLevel,
    })
    setPurchaseModalOpen(true)
  }, [navigate, user, metadata])

  const labelMapsSeeded = useRef(false)
  useEffect(() => {
    if (labelMapsSeeded.current) return
    if (!metadata.hasData) return
    labelMapsSeeded.current = true
    setLabelMap('classLevels', Object.fromEntries(metadata.classOptions.map((o) => [o.value, o.label])))
    setLabelMap('boards', Object.fromEntries(metadata.boardOptions.map((o) => [o.value, o.label])))
    setLabelMap('years', Object.fromEntries(metadata.questionYearLabels.map((y) => [y, y])))
    setLabelMap('subjects', Object.fromEntries(metadata.subjects.map((s) => [s.id, s.name])))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.hasData])

  const showPremiumBanner = hasClassSelected && !mcqLoading && mcqAnalytics.totalQuestions > mcqAnalytics.accessibleQuestions

  const boardColor = boards[0] || 'rose'

  return (
    <div className="min-h-screen bg-background">
      <ClassContextBanner />
      <HeroBanner totalQuestions={totalQuestions} recentAdded={recentAdded} activeStudents={stats?.students ?? 0} />

      {/* Mobile sticky search + filter bar */}
      {isMobile && hasClassSelected && (
        <div className="sticky top-16 z-30 sticky-glass px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar compact />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setFilterDrawerOpen(true)}
              className="relative h-9 w-9 shrink-0 rounded-xl border-border/60"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center shadow-xs">
                  {filterCount > 9 ? '9+' : filterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Desktop: full search outside sticky bar */}
        {!isMobile && (
          <>
            <div className="py-4 sm:py-6">
              <SearchBar />
            </div>
            <div className="pb-3">
              <QuickFilterRow />
            </div>
          </>
        )}

        {/* Mobile: quick filters below sticky bar */}
        {isMobile && hasClassSelected && (
          <div className="pt-3 pb-1">
            <QuickFilterRow />
          </div>
        )}

        {/* Desktop-only quick filters */}
        {!isMobile && (
          <div className="py-2">
            <ActiveFilterChips />
          </div>
        )}

        <AnimatePresence mode="wait">
          {!hasClassSelected && (
            <motion.div key="select-class" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <SelectClassState />
            </motion.div>
          )}

          {hasClassSelected && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {showPremiumBanner && (
                <div className="py-2">
                  <PremiumBanner totalQuestions={mcqAnalytics.totalQuestions} accessibleQuestions={mcqAnalytics.accessibleQuestions} premiumQuestions={mcqAnalytics.premiumQuestions} />
                </div>
              )}

              <div className={isMobile ? 'py-2' : 'pb-4'}>
                <TopFilters />
              </div>

              <BoardLayout>
                <div ref={resultsRef} className="space-y-4">
                  <AnalyticsBar data={analytics} isLoading={isLoading} />

                  <Tabs value={tab} onValueChange={handleTabChange}>
                    <TabsList className={isMobile ? 'w-full' : ''}>
                      <TabsTrigger value="mcq" className={isMobile ? 'gap-2 flex-1' : 'gap-2'}>
                        MCQ{mcqPagination.total > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{mcqPagination.total}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="cq" className={isMobile ? 'gap-2 flex-1' : 'gap-2'}>
                        CQ (সৃজনশীল){cqPagination.total > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{cqPagination.total}</Badge>}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="mcq" className={isMobile ? 'mt-3' : 'mt-4'}>
                      {mcqLoading && !mcqQuestions.length && <LoadingState />}
                      {!mcqLoading && mcqQuestions.length === 0 && !mcqError && <EmptyState />}
                      {mcqError && !mcqLoading && <ErrorState onRetry={() => mcqRefetch()} />}
                      {mcqQuestions.length > 0 && (
                        <>
                          <McqList questions={mcqQuestions} accessMap={mcqAccessMap} boardColor={boardColor}
                            onBookmark={handleBookmark} onShare={handleShare} onUnlock={handleUnlock}
                            bookmarkedIds={bookmarkedIds} />
                          <Pagination page={mcqPage} totalPages={mcqPagination.totalPages} total={mcqPagination.total}
                            pageSize={10} onPageChange={(p) => { setMcqPage(p); scrollToResults() }} />
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="cq" className={isMobile ? 'mt-3' : 'mt-4'}>
                      {cqLoading && !cqQuestions.length && <LoadingState />}
                      {!cqLoading && cqQuestions.length === 0 && !cqError && <EmptyState />}
                      {cqError && !cqLoading && <ErrorState onRetry={() => cqRefetch()} />}
                      {cqQuestions.length > 0 && (
                        <>
                          <CqList questions={cqQuestions} accessMap={cqAccessMap} boardColor={boardColor}
                            onBookmark={handleBookmark} onShare={handleShare} onUnlock={handleUnlock}
                            bookmarkedIds={bookmarkedIds} />
                          <Pagination page={cqPage} totalPages={cqPagination.totalPages} total={cqPagination.total}
                            pageSize={10} onPageChange={(p) => { setCqPage(p); scrollToResults() }} />
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </BoardLayout>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile filter bottom sheet */}
      {isMobile && (
        <FilterBottomSheet open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} filterCount={filterCount}>
          <Sidebar />
        </FilterBottomSheet>
      )}

      {purchaseModalData && (
        <PurchaseOptionsModal
          open={purchaseModalOpen}
          onOpenChange={setPurchaseModalOpen}
          contentType={purchaseModalData.contentType}
          contentId={purchaseModalData.contentId}
          contentTitle={purchaseModalData.contentTitle}
          contentPrice={purchaseModalData.contentPrice}
          classLevel={purchaseModalData.classLevel}
        />
      )}
    </div>
  )
}
