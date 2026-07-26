'use client'

import { useRef } from 'react'
import { BookOpen, ChevronRight, Clock, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeaturedCourses, type FeaturedItem } from '@/hooks/use-home-data'
import { usePersonalizedContinueLearning } from '@/hooks/user/use-personalized-continue-learning'
import { useRouterStore } from '@/store/router'
import { getFeaturedRegistration } from '@/lib/featured-content-registry'
import Image from 'next/image'


function getTypeLabel(type: string): string {
  const reg = getFeaturedRegistration(type)
  return reg?.labelBn || type
}

function getTypeColor(type: string): string {
  const reg = getFeaturedRegistration(type)
  return reg?.color || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

function navigateToItem(item: FeaturedItem, navigate: ReturnType<typeof useRouterStore.getState>['navigate']) {
  const navigateToUrl = (url: string) => {
    if (typeof window !== 'undefined') window.location.href = url
  }

  switch (item.contentType) {
    case 'lecture': {
      // item.id IS the lecture ID from personalized API's lectureToItem
      // extra.lectureId doesn't exist in getSearchExtra — item.id is the source of truth
      const lectureId = item.id
      const chapterId = item.extra.chapterId as string | undefined
      const subjectId = item.extra.subjectId as string | undefined
      const classSlug = item.extra.classSlug as string | undefined
      const subjectSlug = item.extra.subjectSlug as string | undefined
      const chapterSlug = item.extra.chapterSlug as string | undefined
      if (lectureId) {
        // Best: navigate with full context
        navigate('lecture-viewer', {
          lectureId,
          chapterId: chapterId || '',
          subjectId: subjectId || '',
          classSlug: classSlug || '',
        })
      } else if (chapterId && classSlug && subjectSlug && chapterSlug) {
        navigate('chapter-detail', { chapterId, subjectId: subjectId || '', classSlug, subjectSlug, chapterSlug })
      } else if (subjectId && classSlug && subjectSlug) {
        navigate('subject-detail', { subjectId, classSlug, subjectSlug })
      }
      break
    }
    case 'mcq': {
      const mcqChapterId = item.extra.chapterId as string | undefined
      const mcqSubjectId = item.extra.subjectId as string | undefined
      const mcqClassSlug = item.extra.classSlug as string | undefined
      const mcqSubjectSlug = item.extra.subjectSlug as string | undefined
      const mcqChapterSlug = item.extra.chapterSlug as string | undefined
      if (mcqChapterId && mcqClassSlug && mcqSubjectSlug && mcqChapterSlug) {
        navigate('chapter-detail', { chapterId: mcqChapterId, subjectId: mcqSubjectId || '', classSlug: mcqClassSlug, subjectSlug: mcqSubjectSlug, chapterSlug: mcqChapterSlug })
      } else if (mcqSubjectId && mcqClassSlug && mcqSubjectSlug) {
        navigate('subject-detail', { subjectId: mcqSubjectId, classSlug: mcqClassSlug, subjectSlug: mcqSubjectSlug })
      }
      break
    }
    case 'cq': {
      const cqChapterId = item.extra.chapterId as string | undefined
      const cqSubjectId = item.extra.subjectId as string | undefined
      const cqClassSlug = item.extra.classSlug as string | undefined
      const cqSubjectSlug = item.extra.subjectSlug as string | undefined
      if (cqChapterId && cqSubjectId) {
        navigate('cq-list', { chapterId: cqChapterId, subjectId: cqSubjectId, classSlug: cqClassSlug || '' })
      } else if (cqSubjectId && cqClassSlug && cqSubjectSlug) {
        navigate('subject-detail', { subjectId: cqSubjectId, classSlug: cqClassSlug, subjectSlug: cqSubjectSlug })
      }
      break
    }
    case 'blog': {
      const slug = item.extra.slug as string | undefined
      if (slug) navigateToUrl(`/blog/${slug}`)
      else navigate('blog')
      break
    }
    case 'course': {
      const courseSlug = item.extra.slug as string | undefined
      if (courseSlug) navigate('course-detail', { courseSlug })
      break
    }
    case 'notice':
      navigate('notices')
      break
    case 'exam':
      navigate('exam-center')
      break
    case 'suggestion':
      navigate('suggestion-detail', { suggestionId: item.id })
      break
    case 'bundle':
    case 'package':
      navigate('premium')
      break
    case 'boardQuestion':
      navigate('board-questions')
      break
    case 'knowledgeQuestion':
      navigate('short-questions')
      break
    case 'mcqExamPackage':
      navigate('mcq-exam-package-list')
      break
    case 'cqExamPackage':
      navigate('cq-exam-package-list')
      break
    case 'customLink': {
      const url = item.extra.url as string | undefined
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      break
    }
    default:
      break
  }
}

function ContinueLearningSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[240px] shrink-0 space-y-2">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function ContinueLearningSection() {
  const navigate = useRouterStore((s) => s.navigate)
  const { items: personalizedItems, isLoading: personalizedLoading } = usePersonalizedContinueLearning()
  const { data: featuredItems = [], isLoading: featuredLoading } = useFeaturedCourses()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fallback chain: personalized → featured → empty
  const hasPersonalized = personalizedItems.length > 0
  const items = hasPersonalized ? personalizedItems : featuredItems
  const isLoading = hasPersonalized ? personalizedLoading : featuredLoading

  const visibleItems = items.slice(0, 8)

  if (!isLoading && visibleItems.length === 0) return null

  return (
    <section className="py-5 sm:py-6 bg-background" aria-labelledby="continue-learning-title">
      <div className="container-app">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="continue-learning-title" className="text-lg sm:text-xl font-bold text-foreground">
              চালিয়ে যান
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              আপনার পড়াশোনা চালিয়ে যান
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('class-list')}
            className="gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 shrink-0"
          >
            সব দেখুন
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Horizontal Scroll */}
        {isLoading ? (
          <ContinueLearningSkeleton />
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 no-scrollbar -mx-4 px-4"
          >
            {visibleItems.map((item, idx) => {
              const label = getTypeLabel(item.contentType)
              const colorClass = getTypeColor(item.contentType)
              return (
                <button
                  key={`${item.contentType}-${item.id}`}
                  onClick={() => navigateToItem(item, navigate)}
                  className="snap-start shrink-0 w-[220px] sm:w-[240px] text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
                  aria-label={`${label}: ${item.title}`}
                >
                  <Card variant="compact" className="h-full border-border/50 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200">
                    <CardContent className="p-0">
                      {/* Thumbnail */}
                      <div className="aspect-[16/9] relative bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 rounded-t-xl overflow-hidden">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            unoptimized
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <BookOpen className="w-8 h-8 text-emerald-400/50" />
                          </div>
                        )}

                        {/* Duration badge */}
                        {(item.extra.readingTime as number | undefined || item.extra.duration as number | undefined) && (
                          <div className="absolute bottom-2 left-2">
                            <span className="text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-sm">
                              <Clock className="w-3 h-3" />
                              {String((item.extra.readingTime as number | undefined) || (item.extra.duration as number | undefined) || '')} মিনিট
                            </span>
                          </div>
                        )}

                        {/* Premium badge */}
                        {item.isPremium && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-amber-500/90 text-white text-[10px] px-1.5 py-0 border-0">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3 sm:p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Badge variant="outline" className={`text-[10px] font-normal px-1.5 py-0 ${colorClass}`}>
                            {label}
                          </Badge>
                          {!item.isPremium && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] border-0 px-1.5 py-0">
                              ফ্রি
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
