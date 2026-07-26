import { PenLine, Layers, Eye } from 'lucide-react'
import type { FormState } from './types'

export const difficultyLabels: Record<string, string> = {
  easy: 'সহজ',
  medium: 'মাঝারি',
  hard: 'কঠিন',
}

export const difficultyColors: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export const typeLabels: Record<string, string> = {
  mcq: 'MCQ',
  cq: 'CQ',
}

export const typeColors: Record<string, string> = {
  mcq: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  cq: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
}

export const stepInfo = [
  { num: 1, title: 'প্রশ্নের ধরন ও বিষয়বস্তু', icon: PenLine },
  { num: 2, title: 'হায়ারার্কি ও মেটাডাটা', icon: Layers },
  { num: 3, title: 'প্রিভিউ ও প্রকাশ', icon: Eye },
]

export const emptyForm: FormState = {
  type: 'mcq',
  board: '',
  year: '',
  yearId: '',
  topic: '',
  classId: '',
  subjectId: '',
  chapterId: '',
  difficulty: 'medium',
  isPremium: false,
  price: '',
  tags: '',
  question: '',
  questionImage: '',
  optionA: '',
  optionAImage: '',
  optionB: '',
  optionBImage: '',
  optionC: '',
  optionCImage: '',
  optionD: '',
  optionDImage: '',
  correctAnswer: 'A',
  explanation: '',
  explanationImage: '',
  uddeepok: '',
  uddeepokImage: '',
  question1: '',
  question1Image: '',
  question2: '',
  question2Image: '',
  question3: '',
  question3Image: '',
  question4: '',
  question4Image: '',
  answer1: '',
  answer1Image: '',
  answer2: '',
  answer2Image: '',
  answer3: '',
  answer3Image: '',
  answer4: '',
  answer4Image: '',
}

export const resetMcqFields = {
  question: '',
  questionImage: '',
  optionA: '',
  optionAImage: '',
  optionB: '',
  optionBImage: '',
  optionC: '',
  optionCImage: '',
  optionD: '',
  optionDImage: '',
  correctAnswer: 'A',
  explanation: '',
  explanationImage: '',
}

export const resetCqFields = {
  uddeepok: '',
  uddeepokImage: '',
  question1: '',
  question1Image: '',
  question2: '',
  question2Image: '',
  question3: '',
  question3Image: '',
  question4: '',
  question4Image: '',
  answer1: '',
  answer1Image: '',
  answer2: '',
  answer2Image: '',
  answer3: '',
  answer3Image: '',
  answer4: '',
  answer4Image: '',
}
