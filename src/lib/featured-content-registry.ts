import { toDecimal } from '@/lib/decimal'
import type { PrismaClient } from '@prisma/client'

// ─── Types ───

export interface FeaturedContentRegistration {
  /** Prisma model accessor key (e.g. 'lecture', 'mCQ', 'cQ', 'blogPost') */
  modelKey: string
  /** Display label in Bengali */
  labelBn: string
  /** Display label in English */
  labelEn?: string
  /** Lucide icon name */
  icon: string
  /** Tailwind color class */
  color: string
  /** Whether this type has a thumbnail field */
  hasThumbnail: boolean
  /** Whether this type has a title field */
  hasTitle: boolean
  /** Extract display title from a raw DB row */
  getTitle: (entry: Record<string, unknown>) => string
  /** Build a subtitle from a raw DB row (class › subject, etc.) */
  getSubtitle: (entry: Record<string, unknown>) => string | null
  /** Extract thumbnail URL from a raw DB row */
  getThumbnail: (entry: Record<string, unknown>) => string | null
  /** Determine premium status from a raw DB row */
  isPremium: (entry: Record<string, unknown>) => boolean
  /** Extra Prisma include for resolving relations (chapter, subject, class, etc.) */
  include?: Record<string, unknown>
  /** Fields to search against (e.g. ['title', 'slug']) */
  searchFields: string[]
  /** Get a search result subtitle from a raw DB row */
  getSearchSubtitle: (entry: Record<string, unknown>) => string | null
  /** Get extra search metadata from a raw DB row */
  getSearchExtra?: (entry: Record<string, unknown>) => Record<string, unknown> | undefined
}

// ─── Chapter Include (reused by lecture, mcq, cq) ───

const CHAPTER_INCLUDE = {
  chapter: {
    select: {
      name: true,
      subject: {
        select: {
          id: true,
          name: true,
          slug: true,
          class: { select: { name: true, slug: true } },
        },
      },
    },
  },
}

const COURSE_INCLUDE = {
  classCategory: { select: { name: true, slug: true } },
  subject: { select: { id: true, name: true, slug: true } },
}

const BLOG_INCLUDE = {
  author: { select: { id: true, name: true, avatar: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
}

// ─── Helper: truncate long text ───

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

// ─── Helper: get chapter hierarchy subtitle ───

function chapterSubtitle(entry: Record<string, unknown>): string | null {
  const ch = entry.chapter as Record<string, unknown> | undefined
  const subject = ch?.subject as Record<string, unknown> | undefined
  const cls = subject?.class as Record<string, unknown> | undefined
  if (cls?.name && subject?.name) {
    return `${cls.name} › ${subject.name}` + (ch?.name ? ` › ${ch.name}` : '')
  }
  return null
}

// ─── Helper: course subtitle ───

function courseSubtitle(entry: Record<string, unknown>): string | null {
  const cc = entry.classCategory as Record<string, unknown> | undefined
  const subj = entry.subject as Record<string, unknown> | undefined
  if (cc?.name && subj?.name) return `${cc.name} › ${subj.name}`
  if (cc?.name) return cc.name as string
  return null
}

// ─── Registry ───

/**
 * FEATURED_CONTENT_REGISTRY
 *
 * Single source of truth for all featureable content types.
 * Add a new entry here (and nowhere else) to make a content type
 * featureable across the entire system.
 */
export const FEATURED_CONTENT_REGISTRY: Record<string, FeaturedContentRegistration> = {
  // ─── Existing types ───

  lecture: {
    modelKey: 'lecture',
    labelBn: 'লেকচার',
    icon: 'PlayCircle',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: chapterSubtitle,
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: CHAPTER_INCLUDE,
    searchFields: ['title'],
    getSearchSubtitle: chapterSubtitle,
    getSearchExtra: (e) => {
      const ch = e.chapter as Record<string, unknown> | undefined
      const subj = ch?.subject as Record<string, unknown> | undefined
      const cls = subj?.class as Record<string, unknown> | undefined
      return {
        chapterId: ch?.id as string,
        chapterSlug: ch?.slug as string,
        subjectId: subj?.id as string,
        subjectSlug: subj?.slug as string,
        classSlug: cls?.slug as string,
      }
    },
  },

  mcq: {
    modelKey: 'mCQ',
    labelBn: 'MCQ',
    icon: 'FileQuestion',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => truncate((e.question as string) || 'শিরোনাম নেই'),
    getSubtitle: chapterSubtitle,
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: CHAPTER_INCLUDE,
    searchFields: ['question'],
    getSearchSubtitle: chapterSubtitle,
    getSearchExtra: (e) => {
      const ch = e.chapter as Record<string, unknown> | undefined
      const subj = ch?.subject as Record<string, unknown> | undefined
      const cls = subj?.class as Record<string, unknown> | undefined
      return {
        difficulty: e.difficulty as string,
        classLevel: e.classLevel as string,
        chapterId: ch?.id as string,
        chapterSlug: ch?.slug as string,
        subjectId: subj?.id as string,
        subjectSlug: subj?.slug as string,
        classSlug: cls?.slug as string,
      }
    },
  },

  cq: {
    modelKey: 'cQ',
    labelBn: 'CQ',
    icon: 'AlignLeft',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => truncate((e.uddeepok as string) || 'শিরোনাম নেই'),
    getSubtitle: chapterSubtitle,
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: CHAPTER_INCLUDE,
    searchFields: ['uddeepok'],
    getSearchSubtitle: chapterSubtitle,
    getSearchExtra: (e) => {
      const ch = e.chapter as Record<string, unknown> | undefined
      const subj = ch?.subject as Record<string, unknown> | undefined
      const cls = subj?.class as Record<string, unknown> | undefined
      return {
        difficulty: e.difficulty as string,
        classLevel: e.classLevel as string,
        chapterId: ch?.id as string,
        chapterSlug: ch?.slug as string,
        subjectId: subj?.id as string,
        subjectSlug: subj?.slug as string,
        classSlug: cls?.slug as string,
      }
    },
  },

  bundle: {
    modelKey: 'contentBundle',
    labelBn: 'বান্ডেল',
    icon: 'Package',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const t = e.type as string
      return t === 'MIXED' ? 'মিক্সড বান্ডেল' : t ? `${t.toUpperCase()} বান্ডেল` : null
    },
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => toDecimal(e.price as number) > 0,
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const t = e.type as string
      return t === 'MIXED' ? 'মিক্সড বান্ডেল' : t ? `${t.toUpperCase()} বান্ডেল` : null
    },
    getSearchExtra: (e) => ({
      price: e.price as number,
      originalPrice: e.originalPrice as number,
      type: e.type as string,
    }),
  },

  package: {
    modelKey: 'contentPackage',
    labelBn: 'প্যাকেজ',
    icon: 'Box',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => (e.durationLabel as string) || null,
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => toDecimal(e.price as number) > 0,
    searchFields: ['title'],
    getSearchSubtitle: (e) => (e.durationLabel as string) || null,
    getSearchExtra: (e) => ({
      price: e.price as number,
      duration: e.duration as number,
      durationLabel: e.durationLabel as string,
    }),
  },

  suggestion: {
    modelKey: 'suggestion',
    labelBn: 'সাজেশন',
    icon: 'Lightbulb',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: () => null,
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    searchFields: ['title'],
    getSearchSubtitle: () => null,
    getSearchExtra: (e) => ({ price: e.price as number, slug: e.slug as string }),
  },

  exam: {
    modelKey: 'exam',
    labelBn: 'এক্সাম',
    icon: 'ClipboardCheck',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cl = e.classLevel as string
      const t = e.type as string
      const dur = e.duration as number
      if (cl && t && dur) return `${cl} › ${t.toUpperCase()} › ${dur} মিনিট`
      return null
    },
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const cl = e.classLevel as string
      const t = e.type as string
      const dur = e.duration as number
      if (cl && t && dur) return `${cl} › ${t.toUpperCase()} › ${dur} মিনিট`
      return null
    },
    getSearchExtra: (e) => ({
      type: e.type as string,
      duration: e.duration as number,
      totalMarks: e.totalMarks as number,
    }),
  },

  course: {
    modelKey: 'course',
    labelBn: 'কোর্স',
    icon: 'GraduationCap',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: courseSubtitle,
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: COURSE_INCLUDE,
    searchFields: ['title'],
    getSearchSubtitle: courseSubtitle,
    getSearchExtra: (e) => ({
      price: e.price as number,
      originalPrice: e.originalPrice as number,
      slug: e.slug as string,
      teacherName: e.teacherName as string,
      difficulty: e.difficulty as string,
    }),
  },

  // ─── NEWLY ADDED types ───

  blog: {
    modelKey: 'blogPost',
    labelBn: 'ব্লগ',
    icon: 'Newspaper',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cat = e.category as Record<string, unknown> | undefined
      return cat?.name ? (cat.name as string) : null
    },
    getThumbnail: (e) => (e.featuredImage as string) || null,
    isPremium: () => false,
    include: BLOG_INCLUDE,
    searchFields: ['title', 'excerpt'],
    getSearchSubtitle: (e) => {
      const cat = e.category as Record<string, unknown> | undefined
      return cat?.name ? (cat.name as string) : null
    },
    getSearchExtra: (e) => ({
      slug: e.slug as string,
      readingTime: e.readingTime as number,
    }),
  },

  notice: {
    modelKey: 'notice',
    labelBn: 'নোটিশ',
    icon: 'Megaphone',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const t = e.type as string
      const typeLabels: Record<string, string> = { TEXT: 'পাঠ্য', PDF: 'পিডিএফ', LINK: 'লিংক' }
      return typeLabels[t] || null
    },
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: () => false,
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const t = e.type as string
      const typeLabels: Record<string, string> = { TEXT: 'পাঠ্য', PDF: 'পিডিএফ', LINK: 'লিংক' }
      return typeLabels[t] || null
    },
    getSearchExtra: (e) => ({
      type: e.type as string,
      isPinned: e.isPinned as boolean,
    }),
  },

  knowledgeQuestion: {
    modelKey: 'knowledgeQuestion',
    labelBn: 'সংক্ষিপ্ত প্রশ্ন',
    icon: 'Brain',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => truncate((e.question as string) || 'শিরোনাম নেই'),
    getSubtitle: (e) => {
      const types: Record<string, string> = { knowledge: 'জ্ঞানমূলক', comprehension: 'বোধমূলক' }
      return types[e.type as string] || null
    },
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: CHAPTER_INCLUDE,
    searchFields: ['question'],
    getSearchSubtitle: (e) => {
      const types: Record<string, string> = { knowledge: 'জ্ঞানমূলক', comprehension: 'বোধমূলক' }
      return types[e.type as string] || null
    },
    getSearchExtra: (e) => ({
      type: e.type as string,
      chapterId: (e.chapter as Record<string, unknown> | undefined)?.id as string,
    }),
  },

  mcqExamPackage: {
    modelKey: 'mCQExamPackage',
    labelBn: 'MCQ এক্সাম প্যাকেজ',
    icon: 'ClipboardList',
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: {
      class: { select: { id: true, name: true, slug: true } },
    },
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getSearchExtra: (e) => ({
      price: e.price as number,
      originalPrice: e.originalPrice as number,
      totalSets: e.totalSets as number,
    }),
  },

  cqExamPackage: {
    modelKey: 'cQExamPackage',
    labelBn: 'CQ এক্সাম প্যাকেজ',
    icon: 'ClipboardCheck',
    color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    include: {
      class: { select: { id: true, name: true, slug: true } },
    },
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getSearchExtra: (e) => ({
      price: e.price as number,
      originalPrice: e.originalPrice as number,
      totalSets: e.totalSets as number,
    }),
  },

  // ─── Special types ───

  boardQuestion: {
    modelKey: 'mCQ',
    labelBn: 'বোর্ড প্রশ্ন',
    icon: 'FileQuestion',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => truncate((e.question as string) || 'শিরোনাম নেই'),
    getSubtitle: (e) => {
      const board = e.board as string
      const year = e.year as string
      if (board && year) return `${board} › ${year}`
      if (board) return board
      if (year) return year
      return null
    },
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    searchFields: ['question'],
    getSearchSubtitle: (e) => {
      const board = e.board as string
      const year = e.year as string
      if (board && year) return `${board} › ${year}`
      if (board) return board
      if (year) return year
      return null
    },
    getSearchExtra: (e) => ({
      board: e.board as string,
      year: e.year as string,
      classLevel: e.classLevel as string,
      difficulty: e.difficulty as string,
    }),
  },

  customLink: {
    modelKey: '',
    labelBn: 'কাস্টম লিংক',
    icon: 'Link',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    hasThumbnail: true,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: () => null,
    getThumbnail: (e) => (e.thumbnail as string) || null,
    isPremium: () => false,
    searchFields: ['title'],
    getSearchSubtitle: () => null,
  },

  practiceExam: {
    modelKey: 'exam',
    labelBn: 'প্র্যাকটিস এক্সাম',
    icon: 'ClipboardCheck',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => (e.title as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cl = e.classLevel as string
      const dur = e.duration as number
      if (cl && dur) return `${cl} › ${dur} মিনিট`
      if (cl) return cl
      return null
    },
    getThumbnail: () => null,
    isPremium: (e) => (e.isPremium as boolean) || false,
    searchFields: ['title'],
    getSearchSubtitle: (e) => {
      const cl = e.classLevel as string
      const dur = e.duration as number
      if (cl && dur) return `${cl} › ${dur} মিনিট`
      return null
    },
    getSearchExtra: (e) => ({
      type: e.type as string,
      duration: e.duration as number,
      totalMarks: e.totalMarks as number,
    }),
  },

  chapter: {
    modelKey: 'chapter',
    labelBn: 'অধ্যায়',
    icon: 'BookOpen',
    color: 'bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => (e.name as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const subj = e.subject as Record<string, unknown> | undefined
      const cls = subj?.class as Record<string, unknown> | undefined
      if (cls?.name && subj?.name) return `${cls.name} › ${subj.name}`
      return null
    },
    getThumbnail: () => null,
    isPremium: () => false,
    include: {
      subject: {
        select: { id: true, name: true, slug: true, class: { select: { name: true, slug: true } } },
      },
    },
    searchFields: ['name'],
    getSearchSubtitle: (e) => {
      const subj = e.subject as Record<string, unknown> | undefined
      const cls = subj?.class as Record<string, unknown> | undefined
      if (cls?.name && subj?.name) return `${cls.name} › ${subj.name}`
      return null
    },
    getSearchExtra: (e) => ({
      subjectId: (e.subject as Record<string, unknown> | undefined)?.id as string,
    }),
  },

  subject: {
    modelKey: 'subject',
    labelBn: 'বিষয়',
    icon: 'BookOpen',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => (e.name as string) || 'শিরোনাম নেই',
    getSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getThumbnail: () => null,
    isPremium: () => false,
    include: {
      class: { select: { id: true, name: true, slug: true } },
    },
    searchFields: ['name'],
    getSearchSubtitle: (e) => {
      const cls = e.class as Record<string, unknown> | undefined
      return cls?.name ? (cls.name as string) : null
    },
    getSearchExtra: (e) => ({
      classSlug: (e.class as Record<string, unknown> | undefined)?.slug as string,
    }),
  },

  class: {
    modelKey: 'class',
    labelBn: 'শ্রেণি',
    icon: 'GraduationCap',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    hasThumbnail: false,
    hasTitle: true,
    getTitle: (e) => (e.name as string) || 'শিরোনাম নেই',
    getSubtitle: () => null,
    getThumbnail: () => null,
    isPremium: () => false,
    searchFields: ['name'],
    getSearchSubtitle: () => null,
    getSearchExtra: (e) => ({
      slug: e.slug as string,
    }),
  },
}

// ─── Helper functions ───

/** Get the registration for a content type, or null if not registered */
export function getFeaturedRegistration(type: string): FeaturedContentRegistration | null {
  return FEATURED_CONTENT_REGISTRY[type] ?? null
}

/** Get all registered content type keys */
export function getRegisteredFeaturedTypes(): string[] {
  return Object.keys(FEATURED_CONTENT_REGISTRY)
}

/** Get all registrations as an array */
export function getFeaturedRegistrations(): FeaturedContentRegistration[] {
  return Object.values(FEATURED_CONTENT_REGISTRY)
}

/** Resolve a map of IDs → DB rows for a given content type */
export async function batchResolveFeaturedContent(
  type: string,
  ids: string[],
  prisma: PrismaClient,
): Promise<Record<string, Record<string, unknown>>> {
  if (!ids || ids.length === 0) return {}
  const reg = getFeaturedRegistration(type)
  if (!reg) return {}

  const model = (prisma as unknown as Record<string, unknown>)[reg.modelKey] as
    | { findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>> }
    | undefined

  if (!model) return {}

  const items = await model.findMany({
    where: { id: { in: ids } },
    include: reg.include,
  })

  const map: Record<string, Record<string, unknown>> = {}
  for (const item of items) {
    map[item.id as string] = item as Record<string, unknown>
  }
  return map
}

/** Resolve a single featured content item for UI display */
export function resolveFeaturedDisplayItem(
  contentType: string,
  item: { id: string; title: string | null; subtitle: string | null; thumbnail: string | null },
  entry: Record<string, unknown> | undefined,
) {
  const reg = getFeaturedRegistration(contentType)
  let contentExists = true
  let displayTitle = 'শিরোনাম নেই'
  let displaySubtitle: string | null = null
  let displayThumbnail: string | null = null
  let isPremium = false

  if (!entry) {
    contentExists = false
  } else if (reg) {
    displayTitle = item.title || reg.getTitle(entry)
    displaySubtitle = item.subtitle || reg.getSubtitle(entry)
    displayThumbnail = item.thumbnail || reg.getThumbnail(entry)
    isPremium = reg.isPremium(entry)
  }

  return { contentExists, displayTitle, displaySubtitle, displayThumbnail, isPremium }
}
