'use client'

import { useQuery } from '@tanstack/react-query'
import React, { useCallback,useMemo,useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
Breadcrumb,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,
BreadcrumbPage,BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { useSubjectResolver } from '@/hooks/use-subject-resolver'
import { fetchJSON } from '@/lib/fetch-json'
import { cn,toBengaliNumerals } from '@/lib/utils'
import { useRouterStore, useRouteParams } from '@/store/router'
import { useCountUp } from '@/hooks/use-count-up'
import { Reveal } from '@/components/shared/Reveal'
import {
ArrowRight,
Award,
BookOpen,
Brain,
ClipboardList,
Eye,
FileQuestion,
GraduationCap,
Lightbulb,
Lock,
PlayCircle,
Search
} from 'lucide-react'

// ─── Types ───

interface ChapterData {
  id: string; name: string; slug: string; number: number
  lectureCount: number; mcqCount: number; cqCount: number
  freeLectureCount: number; freeMcqCount: number; freeCqCount: number
  suggestionCount: number; examCount: number
  shortQuestionsCount: number; freeShortQuestionsCount: number
  progress: number
}

interface SubjectResponse {
  id: string; name: string; className: string; classSlug: string
  chapters: ChapterData[]
  contentCounts: Record<string, number>
  freeContentCounts: Record<string, number>
}

// Animated stat card with count-up
function StatCard({ stat, count, index }: { stat: StatDef; count: number; index: number }) {
  const Icon = stat.icon
  const { ref, value } = useCountUp(count)
  return (
    <Reveal delay={index * 60}>
      <Card className="border-border/50 card-lift cursor-default">
        <CardContent className="p-3 sm:p-4 flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl bg-gradient-to-br', stat.gradient, 'shadow-sm shrink-0')}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p ref={ref as React.Ref<HTMLParagraphElement>} className="text-lg sm:text-xl font-bold tabular-nums">
              {toBengaliNumerals(value)}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{stat.label}</p>
          </div>
        </CardContent>
      </Card>
    </Reveal>
  )
}

// ─── Stat item type ───

interface StatDef {
  icon: React.ElementType; label: string; key: string; gradient: string
}

const STATS: StatDef[] = [
  { icon: PlayCircle, label: 'Lectures', key: 'lecture', gradient: 'from-blue-500 to-cyan-500' },
  { icon: FileQuestion, label: 'MCQ', key: 'mcq', gradient: 'from-emerald-500 to-teal-500' },
  { icon: ClipboardList, label: 'CQ', key: 'cq', gradient: 'from-violet-500 to-purple-500' },
  { icon: GraduationCap, label: 'Board Q', key: 'board', gradient: 'from-orange-500 to-amber-500' },
  { icon: Brain, label: 'Knowledge', key: 'short-questions', gradient: 'from-pink-500 to-rose-500' },
  { icon: Lightbulb, label: 'Suggestions', key: 'suggestion', gradient: 'from-indigo-500 to-blue-500' },
  { icon: Award, label: 'Exams', key: 'exam', gradient: 'from-teal-500 to-emerald-500' },
]

// ─── Content type chip config ───

const CONTENT_TYPES = [
  { key: 'lecture', label: 'Lec', icon: PlayCircle, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', tabKey: 'lecture' },
  { key: 'mcq', label: 'MCQ', icon: FileQuestion, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', tabKey: 'mcq' },
  { key: 'cq', label: 'CQ', icon: ClipboardList, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', tabKey: 'cq' },
  { key: 'board', label: 'Board', icon: GraduationCap, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', tabKey: 'board' },
  { key: 'short-questions', label: 'KQ', icon: Brain, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400', tabKey: 'knowledge' },
  { key: 'suggestion', label: 'Sug', icon: Lightbulb, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', tabKey: 'suggestion' },
  { key: 'exam', label: 'Exam', icon: Award, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', tabKey: 'exam' },
]

// ─── Helpers ───



// ─── SubjectHubPage ───

export default function SubjectHubPage() {
  const params = useRouteParams()
  const navigate = useRouterStore((s) => s.navigate)
  const { classLevelLabels, metadata } = useHierarchyMetadata()
  const [search, setSearch] = useState('')

  const classSlug = params.classSlug

  // First: use direct ID if provided
  // Second: resolve slug to ID using API (for fresh URL loads)
  const resolvedSubjectId = useSubjectResolver(
    params.subjectId || params.subjectSlug,
    params.classSlug
  )

  // Combine resolved ID with fallback metadata lookup
  const subjectId = useMemo(() => {
    if (resolvedSubjectId.data) return resolvedSubjectId.data
    if (params.subjectId) return params.subjectId
    // Fallback: try to find in metadata
    if (!metadata || !params.classSlug || !params.subjectSlug) return undefined
    const cls = metadata.classes.find((c) => c.slug === params.classSlug)
    if (!cls) return undefined
    const sub = metadata.subjects.find((s) => s.slug === params.subjectSlug && s.classId === cls.id)
    return sub?.id
  }, [resolvedSubjectId.data, params.subjectId, params.classSlug, params.subjectSlug, metadata])

  const { data, isLoading, error } = useQuery({
    queryKey: ['subject-detail', subjectId],
    queryFn: () => fetchJSON<SubjectResponse>(`/api/subjects/${subjectId}`),
    enabled: !!subjectId,
  })

  // Filter chapters by search
  const filteredChapters = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.chapters
    const q = search.toLowerCase()
    return data.chapters.filter((c) => c.name.toLowerCase().includes(q))
  }, [data, search])

  // Navigate to chapter hub
  const goToChapter = useCallback((chapterId: string, chapterSlug: string, initialTab?: string) => {
    const currentData = data
    if (!currentData) return
    navigate('chapter-detail', {
      chapterId,
      chapterSlug,
      subjectId: currentData.id,
      subjectSlug: params.subjectSlug,
      classSlug: currentData.classSlug,
      ...(initialTab ? { initialTab } : {}),
    })
  }, [data, navigate, params.subjectSlug])

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-4 w-64" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border"><Skeleton className="h-11 w-11 rounded-xl mb-2" /><Skeleton className="h-5 w-12 mb-1" /><Skeleton className="h-3 w-16" /></div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6 rounded-xl border"><Skeleton className="h-6 w-32 mb-3" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-3/4" /></div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Error ───
  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-destructive mb-2">{error?.message ?? 'Subject not found'}</p>
        <Button variant="outline" onClick={() => navigate('class-detail', { classSlug })}>Go Back</Button>
      </div>
    )
  }

  const className = data.className || classLevelLabels[classSlug || ''] || classSlug || ''

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="animate-fade-in-up">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('class-detail', { classSlug: data.classSlug })}>
                {className}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{data.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Subject header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{className}</p>
          </div>
        </div>
      </div>

      {/* Stats bar — only show stats with actual content */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-6">
        {STATS
          .filter((stat) => (data.contentCounts[stat.key] || 0) > 0)
          .map((stat, i) => (
            <StatCard key={stat.key} stat={stat} count={data.contentCounts[stat.key] || 0} index={i} />
          ))}
      </div>

      {/* Search */}
      <div className="animate-fade-in delay-200 mt-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters..."
          className="pl-9 h-10 rounded-xl bg-background border-border/50"
        />
      </div>

      {/* Chapter grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChapters.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No chapters found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? `No chapters match "${search}"` : 'This subject has no chapters yet.'}
            </p>
          </div>
        ) : (
          filteredChapters.map((chapter, i) => (
            <Reveal key={chapter.id} delay={(i % 6) * 60} className="h-full">
              <Card
                onClick={() => goToChapter(chapter.id, chapter.slug)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToChapter(chapter.id, chapter.slug) } }}
                role="button"
                tabIndex={0}
                className="border-border/50 hover:border-primary/30 card-lift hover-shine group h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
              <CardContent className="p-5 sm:p-6 flex flex-col h-full">
                {/* Chapter number + name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {chapter.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">{chapter.name}</h3>
                  </div>
                </div>

                {/* Free/premium indicator */}
                <div className="flex items-center gap-2 mb-3">
                  {hasFreeContent(chapter) && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0 gap-1">
                      <Eye className="h-2.5 w-2.5" /> Free
                    </Badge>
                  )}
                  {hasOnlyPremium(chapter) && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] px-1.5 py-0 gap-1">
                      <Lock className="h-2.5 w-2.5" /> Premium
                    </Badge>
                  )}
                  {hasMixed(chapter) && (
                    <>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0 gap-1">
                        <Eye className="h-2.5 w-2.5" /> Free
                      </Badge>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] px-1.5 py-0 gap-1">
                        <Lock className="h-2.5 w-2.5" /> Premium
                      </Badge>
                    </>
                  )}
                </div>

                {/* Content type chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CONTENT_TYPES.map((ct) => {
                    const count = getChapterCountByKey(chapter, ct.key)
                    if (count === 0) return null
                    const Icon = ct.icon
                    return (
                      <span
                        key={ct.key}
                        onClick={(e) => { e.stopPropagation(); goToChapter(chapter.id, chapter.slug, ct.tabKey) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToChapter(chapter.id, chapter.slug, ct.tabKey) } }}
                        role="button"
                        tabIndex={0}
                        className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium cursor-pointer', ct.color)}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {toBengaliNumerals(count)}
                      </span>
                    )
                  })}
                </div>

                {/* Progress bar */}
                {chapter.progress > 0 && (
                  <div className="mt-auto mb-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{Math.round(chapter.progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(chapter.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Explore button */}
                <div className="mt-auto pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goToChapter(chapter.id, chapter.slug) }}
                    className="w-full rounded-lg text-xs gap-1 group-hover:bg-primary/5 group-hover:text-primary transition-all"
                  >
                    Explore Chapter
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            </Reveal>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Helpers ───

function hasFreeContent(ch: ChapterData): boolean {
  return ch.freeLectureCount > 0 || ch.freeMcqCount > 0 || ch.freeCqCount > 0 || ch.freeShortQuestionsCount > 0
}

function hasOnlyPremium(ch: ChapterData): boolean {
  const total = ch.lectureCount + ch.mcqCount + ch.cqCount + ch.shortQuestionsCount
  const free = ch.freeLectureCount + ch.freeMcqCount + ch.freeCqCount + ch.freeShortQuestionsCount
  return total > 0 && free === 0
}

function hasMixed(ch: ChapterData): boolean {
  return hasFreeContent(ch) && !hasOnlyPremium(ch) && (ch.lectureCount + ch.mcqCount + ch.cqCount + ch.shortQuestionsCount) > 0
}

function getChapterCountByKey(ch: ChapterData, key: string): number {
  switch (key) {
    case 'lecture': return ch.lectureCount
    case 'mcq': return ch.mcqCount
    case 'cq': return ch.cqCount
    case 'board': return 0 // board questions are not in chapter data from subject endpoint
    case 'short-questions': return ch.shortQuestionsCount
    case 'suggestion': return ch.suggestionCount
    case 'exam': return ch.examCount
    default: return 0
  }
}
