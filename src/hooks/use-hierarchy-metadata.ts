'use client'

import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/fetch-json'
import { queryKeys } from '@/lib/query-keys'

// ─── Types ──────────────────────────────────────────────────────

interface HierarchyClass { id: string; name: string; slug: string; color?: string; gradient?: string }
interface HierarchyBoard { id: string; name: string; slug: string; color?: string }
interface HierarchyYear { id: string; year: string }

interface HierarchySubject {
  id: string; name: string; slug: string; classId: string; order?: number; icon?: string; color?: string
  _count?: { chapters: number }
}
interface HierarchyChapter {
  id: string; name: string; slug: string; subjectId: string; order?: number
}

interface HierarchyMetadata {
  classes: HierarchyClass[]
  boards: HierarchyBoard[]
  years: HierarchyYear[]
  questionYears: string[]    // <-- distinct years from actual question data
  subjects: HierarchySubject[]
  chapters: HierarchyChapter[]
}

interface HierarchyMetadataHook {
  metadata: HierarchyMetadata | null
  loading: boolean
  error: string | null
  classLevelLabels: Record<string, string>
  classOptions: { value: string; label: string }[]
  classLevelColors: Record<string, string>
  slugGradients: Record<string, string>
  boardOptions: { value: string; label: string }[]
  boardSlugToLabel: Record<string, string>
  boardColorMap: Record<string, string>
  yearOptions: { value: string; label: string }[]
  yearLabels: string[]
  questionYearOptions: { value: string; label: string }[]   // <-- from actual question data
  questionYearLabels: string[]                                // <-- from actual question data
  getClassName: (slug: string) => string
  getBoardName: (slug: string) => string
  getClassColor: (slug: string) => string
  getClassGradient: (slug: string) => string
  getBoardColor: (slug: string) => string
  hasData: boolean
  subjects: HierarchySubject[]
  chapters: HierarchyChapter[]
}

// ─── Fallbacks ──────────────────────────────────────────────────

const FALLBACK_CLASSES: HierarchyClass[] = [
  { id: 'fc1', name: '৬ষ্ঠ শ্রেণি', slug: 'class-6' },
  { id: 'fc2', name: '৭ম শ্রেণি', slug: 'class-7' },
  { id: 'fc3', name: '৮ম শ্রেণি', slug: 'class-8' },
  { id: 'fc4', name: 'এসএসসি', slug: 'ssc' },
  { id: 'fc5', name: 'এইচএসসি', slug: 'hsc' },
]

const FALLBACK_BOARDS: HierarchyBoard[] = [
  { id: 'fb1', name: 'ঢাকা', slug: 'dhaka' },
  { id: 'fb2', name: 'রাজশাহী', slug: 'rajshahi' },
  { id: 'fb3', name: 'চট্টগ্রাম', slug: 'chittagong' },
  { id: 'fb4', name: 'সিলেট', slug: 'sylhet' },
  { id: 'fb5', name: 'বরিশাল', slug: 'barishal' },
  { id: 'fb6', name: 'কুমিল্লা', slug: 'comilla' },
  { id: 'fb7', name: 'দিনাজপুর', slug: 'dinajpur' },
  { id: 'fb8', name: 'যশোর', slug: 'jessore' },
  { id: 'fb9', name: 'ময়মনসিংহ', slug: 'mymensingh' },
  { id: 'fb10', name: 'টাঙ্গাইল', slug: 'tangail' },
]

const EMPTY_YEARS: HierarchyYear[] = []

const DEFAULT_CLASS_COLORS: Record<string, string> = {
  'class-6': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'class-7': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'class-8': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'ssc': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'hsc': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

const DEFAULT_SLUG_GRADIENTS: Record<string, string> = {
  'class-6': 'from-emerald-400 to-emerald-600',
  'class-7': 'from-teal-400 to-teal-600',
  'class-8': 'from-cyan-400 to-cyan-600',
  'ssc': 'from-emerald-500 to-teal-500',
  'hsc': 'from-teal-500 to-emerald-500',
}

async function fetchHierarchyMetadata(): Promise<HierarchyMetadata> {
  const response = await fetchJSON<{ success?: boolean; data?: HierarchyMetadata } | HierarchyMetadata>(
    '/api/hierarchy/metadata'
  )
  const data: HierarchyMetadata =
    'data' in response && response.data
      ? response.data
      : (response as HierarchyMetadata)
  return {
    classes: data.classes || [],
    boards: data.boards || [],
    years: data.years || [],
    questionYears: data.questionYears || [],
    subjects: data.subjects || [],
    chapters: data.chapters || [],
  }
}

export function useHierarchyMetadata(): HierarchyMetadataHook {
  const { data: metadata = null, isLoading, error } = useQuery({
    queryKey: queryKeys.hierarchyMetadata,
    queryFn: fetchHierarchyMetadata,
  })

  const classes = metadata?.classes?.length ? metadata.classes : FALLBACK_CLASSES
  const boards = metadata?.boards?.length ? metadata.boards : FALLBACK_BOARDS
  const years = useMemo(() => metadata?.years || EMPTY_YEARS, [metadata?.years])

  const memoizedSubjects = useMemo(() => metadata?.subjects || [], [metadata?.subjects])
  const memoizedChapters = useMemo(() => metadata?.chapters || [], [metadata?.chapters])

  const classLevelLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.slug, c.name])), [classes]
  )
  const classOptions = useMemo(() => classes.map((c) => ({ value: c.slug, label: c.name })), [classes])
  const boardOptions = useMemo(() => boards.map((b) => ({ value: b.slug, label: b.name })), [boards])
  const boardSlugToLabel: Record<string, string> = useMemo(
    () => Object.fromEntries(boards.map((b) => [b.slug, b.name])), [boards]
  )
  const boardColorMap: Record<string, string> = useMemo(
    () => Object.fromEntries(boards.map((b) => [b.slug, b.color || 'rose'])), [boards]
  )
  const yearOptions = useMemo(() => years.map((y) => ({ value: y.year, label: y.year })), [years])
  const yearLabels = useMemo(() => years.map((y) => y.year), [years])
  const questionYears = useMemo(() => metadata?.questionYears || [], [metadata?.questionYears])
  const questionYearOptions = useMemo(() => questionYears.map((y) => ({ value: y, label: y })), [questionYears])
  const questionYearLabels = questionYears

  const classLevelColors: Record<string, string> = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.slug, c.color || DEFAULT_CLASS_COLORS[c.slug] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'])),
    [classes]
  )
  const slugGradients: Record<string, string> = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.slug, c.gradient || DEFAULT_SLUG_GRADIENTS[c.slug] || 'from-gray-400 to-gray-600'])),
    [classes]
  )

  const getClassName = useCallback((slug: string): string => classLevelLabels[slug] || slug, [classLevelLabels])
  const getBoardName = useCallback((slug: string): string => boardSlugToLabel[slug] || slug, [boardSlugToLabel])
  const getClassColor = useCallback((slug: string): string => classLevelColors[slug] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300', [classLevelColors])
  const getClassGradient = useCallback((slug: string): string => slugGradients[slug] || 'from-gray-400 to-gray-600', [slugGradients])
  const getBoardColor = useCallback((slug: string): string => boardColorMap[slug] || 'rose', [boardColorMap])

  return {
    metadata, loading: isLoading, error: error?.message ?? null,
    classLevelLabels, classOptions, classLevelColors, slugGradients,
    boardOptions, boardSlugToLabel, boardColorMap, yearOptions, yearLabels,
    questionYearOptions, questionYearLabels,
    getClassName, getBoardName, getClassColor, getClassGradient, getBoardColor,
    hasData: !!metadata?.classes?.length,
    subjects: memoizedSubjects,
    chapters: memoizedChapters,
  }
}
