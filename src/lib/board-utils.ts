export interface BoardColorClasses {
  bg: string
  text: string
  gradient: string
  border: string
  lightBg: string
}

const BOARD_COLOR_MAP: Record<string, BoardColorClasses> = {
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-400 to-rose-600',
    border: 'border-rose-200 dark:border-rose-800',
    lightBg: 'bg-rose-100 dark:bg-rose-900/30',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-400 to-emerald-600',
    border: 'border-emerald-200 dark:border-emerald-800',
    lightBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    text: 'text-sky-600 dark:text-sky-400',
    gradient: 'from-sky-400 to-sky-600',
    border: 'border-sky-200 dark:border-sky-800',
    lightBg: 'bg-sky-100 dark:bg-sky-900/30',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-400 to-amber-600',
    border: 'border-amber-200 dark:border-amber-800',
    lightBg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-600 dark:text-violet-400',
    gradient: 'from-violet-400 to-violet-600',
    border: 'border-violet-200 dark:border-violet-800',
    lightBg: 'bg-violet-100 dark:bg-violet-900/30',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-600 dark:text-orange-400',
    gradient: 'from-orange-400 to-orange-600',
    border: 'border-orange-200 dark:border-orange-800',
    lightBg: 'bg-orange-100 dark:bg-orange-900/30',
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    text: 'text-teal-600 dark:text-teal-400',
    gradient: 'from-teal-400 to-teal-600',
    border: 'border-teal-200 dark:border-teal-800',
    lightBg: 'bg-teal-100 dark:bg-teal-900/30',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    text: 'text-pink-600 dark:text-pink-400',
    gradient: 'from-pink-400 to-pink-600',
    border: 'border-pink-200 dark:border-pink-800',
    lightBg: 'bg-pink-100 dark:bg-pink-900/30',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    gradient: 'from-indigo-400 to-indigo-600',
    border: 'border-indigo-200 dark:border-indigo-800',
    lightBg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    text: 'text-cyan-600 dark:text-cyan-400',
    gradient: 'from-cyan-400 to-cyan-600',
    border: 'border-cyan-200 dark:border-cyan-800',
    lightBg: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
}

export function getBoardColorClasses(color: string): BoardColorClasses {
  return BOARD_COLOR_MAP[color] || BOARD_COLOR_MAP.rose
}

export function getDifficultyColor(d: string): string {
  switch (d) {
    case 'easy': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'hard': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
}

export function getDifficultyLabel(d: string): string {
  switch (d) {
    case 'easy': return 'সহজ'
    case 'hard': return 'কঠিন'
    default: return 'মাঝারি'
  }
}

export function getDifficultyStripe(d: string): string {
  switch (d) {
    case 'easy': return 'bg-emerald-500'
    case 'hard': return 'bg-red-500'
    default: return 'bg-amber-500'
  }
}

export const SUBJECT_COLOR_PALETTE = [
  { bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  { bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  { bg: 'bg-rose-50 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  { bg: 'bg-sky-50 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  { bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  { bg: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
]

export const QUICK_FILTER_SHORTCUTS = [
  { id: 'ssc', label: 'SSC', icon: 'graduation', filters: { classLevels: ['ssc'] } },
  { id: 'hsc', label: 'HSC', icon: 'graduation', filters: { classLevels: ['hsc'] } },
  // Quick filter for Latest Year — dynamically loaded from hierarchy metadata
  { id: 'dhaka', label: 'Dhaka Board', icon: 'map', filters: { boards: ['dhaka'] } },
  { id: 'rajshahi', label: 'Rajshahi Board', icon: 'map', filters: { boards: ['rajshahi'] } },
  { id: 'math', label: 'Mathematics', icon: 'calculator', filters: { subjects: ['mathematics'] } },
  { id: 'physics', label: 'Physics', icon: 'atom', filters: { subjects: ['physics'] } },
  { id: 'chemistry', label: 'Chemistry', icon: 'flask', filters: { subjects: ['chemistry'] } },
  { id: 'biology', label: 'Biology', icon: 'leaf', filters: { subjects: ['biology'] } },
]
