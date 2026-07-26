export interface BoardQuestion {
  id: string
  type: 'mcq' | 'cq'
  board: string | null
  year: string | null
  yearId: string | null
  topic: string | null
  classLevel: string
  subjectId: string
  chapterId: string
  title: string
  difficulty: string
  isPremium: boolean
  isActive: boolean
  createdAt: string
  chapter: { id: string; name: string; slug: string; subject: { id: string; name: string; slug: string } } | null
  subject: { id: string; name: string; slug: string } | null
}

export interface ClassItem { id: string; name: string; slug: string }
export interface SubjectItem { id: string; name: string; slug: string; classId: string }
export interface ChapterItem { id: string; name: string; slug: string; subjectId: string }

export interface FormState {
  type: 'mcq' | 'cq'
  board: string
  year: string
  yearId: string
  topic: string
  classId: string
  subjectId: string
  chapterId: string
  difficulty: string
  isPremium: boolean
  price: string
  tags: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: string
  explanation: string
  uddeepok: string
  question1: string
  question2: string
  question3: string
  question4: string
  answer1: string
  answer2: string
  answer3: string
  answer4: string
  questionImage: string
  optionAImage: string
  optionBImage: string
  optionCImage: string
  optionDImage: string
  explanationImage: string
  uddeepokImage: string
  question1Image: string
  question2Image: string
  question3Image: string
  question4Image: string
  answer1Image: string
  answer2Image: string
  answer3Image: string
  answer4Image: string
}
