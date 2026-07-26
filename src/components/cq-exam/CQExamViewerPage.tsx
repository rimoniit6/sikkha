'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import SafeImage from '@/components/ui/safe-image'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { fetchCsrfToken } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { bengaliLabels,formatTime,getTypeLabel,hasAnswerContent } from '@/lib/cq-exam/utils'
import { useUploadThing } from '@/lib/upload/client'
import { cn,toBengaliNumerals } from '@/lib/utils'
import { useShallowAuth } from '@/store/auth'
import { useRouterStore, useRouteParams } from '@/store/router'
import { useImageViewer } from '@/providers/ImageViewerProvider'
import { useCQDraft } from '@/hooks/use-cq-draft'
import { AnimatePresence,motion } from 'framer-motion'
import {
AlertCircle,
ArrowLeft,
CheckCircle,
ChevronDown,
ChevronUp,
Clock,
FileQuestion,
GraduationCap,
ImagePlus,
Loader2,
Send,
Timer,
X,
BookOpen,
PenLine,
} from 'lucide-react'
import { useCallback,useEffect,useRef,useState } from 'react'

interface CQQuestionData {
  id: string
  cqId: string
  marks: number
  order: number
  type?: string
  subMarks?: string | null
  stem?: string | null
  stemImage?: string | null
  config?: string | null
  typedUddeepok?: string | null
  typedUddeepokImage?: string | null
  typedQuestion1?: string | null
  typedQuestion1Image?: string | null
  typedQuestion2?: string | null
  typedQuestion2Image?: string | null
  typedQuestion3?: string | null
  typedQuestion3Image?: string | null
  typedQuestion4?: string | null
  typedQuestion4Image?: string | null
  cq: {
    id: string
    uddeepok: string
    uddeepokImage: string | null
    question1: string
    question1Image: string | null
    question2: string
    question2Image: string | null
    question3: string
    question3Image: string | null
    question4: string
    question4Image: string | null
    classLevel: string
    subjectId: string
    chapterId: string
    chapter?: { id: string; name: string }
  } | null
}

type AnswerMode = 'flexible' | 'text-only' | 'image-only' | 'complete-image-only'

interface SetDetailData {
  set: {
    id: string
    title: string
    duration: number
    totalMarks: number
    totalQuestions: number
    answerMode: AnswerMode
    maxImagesPerAnswer: number
  }
  questions: CQQuestionData[]
}

interface AnswerImage {
  id: string
  imageUrl: string
  order: number
}

interface AnswerState {
  answerText: string
  images: AnswerImage[]
}

function NonCQQuestionBlock({
  question,
  index,
  answers,
  onAnswerChange,
  collapsed,
  onToggle,
  answerIdMap,
  onAddImage,
  onRemoveImage,
  maxImagesPerAnswer: _maxImagesPerAnswer = 5,
  answerMode = 'flexible',
  onImageClick,
}: {
  question: CQQuestionData
  index: number
  answers: Record<string, AnswerState>
  onAnswerChange: (questionId: string, subIndex: number, value: string) => void
  collapsed: boolean
  onToggle: () => void
  answerIdMap: Record<string, string[]>
  onAddImage: (answerId: string, questionId: string, subIndex: number) => void
  onRemoveImage: (imageId: string, questionId: string, subIndex: number) => void
  maxImagesPerAnswer?: number
  answerMode?: AnswerMode
  onImageClick?: (src: string, alt?: string) => void
}) {
  const qType = (question.type || 'mcq-single').toLowerCase()
  let config: any = {}
  config = question.config || {}

  const stem = question.stem || ''
  const stemImage = question.stemImage || null

  const subQuestionCount = qType === 'fill-blanks' ? (config.blanks || []).length : 1

  const answeredCount = (() => {
    if (qType === 'fill-blanks') {
      const blanks = config.blanks || []
      return blanks.filter((_: any, si: number) => {
        const key = `${question.id}-${si}`
        return !!answers[key]?.answerText?.trim()
      }).length
    }
    const key = `${question.id}-0`
    const ans = answers[key]
    if (qType === 'written') {
      return ans?.answerText?.trim() || (answers[`${question.id}-1`]?.images?.length ?? 0) > 0 ? 1 : 0
    }
    return ans?.answerText?.trim() ? 1 : 0
  })()

  return (
    <Card id={`cq-${question.id}`} className="border-border/50 overflow-hidden motion-safe:animate-fade-in motion-safe:animate-slide-up">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center size-8 rounded-full bg-emerald-500 text-white font-bold text-sm shrink-0">
              {toBengaliNumerals(index + 1)}
            </span>
            <div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">
                {getTypeLabel(question.type ?? 'mcq-single')}
              </span>
              <p className="text-xs text-muted-foreground">
                {answeredCount}/{subQuestionCount} উত্তর দেওয়া হয়েছে | {question.marks} নম্বর
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {toBengaliNumerals(question.marks)} নম্বর
            </Badge>
            {collapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-4 sm:p-6 space-y-6">
              {stem ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <FileQuestion className="size-4" />
                    প্রশ্ন
                  </h4>
                  <div className="rounded-lg bg-muted/50 p-4 border">
                    <RichContentRenderer content={stem} className="text-base leading-relaxed" />
                  </div>
                  {stemImage && (
                    <div className="rounded-lg overflow-hidden border bg-muted/30">
                      <SafeImage src={stemImage} alt="প্রশ্নের ছবি" className="max-h-64 object-contain mx-auto" />
                    </div>
                  )}
                </div>
              ) : null}

              {qType === 'mcq-single' && (() => {
                const options = config.options || []
                const key = `${question.id}-0`
                const ans = answers[key] || { answerText: '', images: [] }
                const selectedIndex = ans.answerText !== '' ? parseInt(ans.answerText) : -1
                return (
                  <div className="space-y-2">
                    {options.map((opt: string, oi: number) => (
                      <label
                        key={oi}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          selectedIndex === oi
                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <input
                          type="radio"
                          name={`mcq-${question.id}`}
                          checked={selectedIndex === oi}
                          onChange={() => onAnswerChange(question.id, 0, String(oi))}
                          className="text-emerald-500"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )
              })()}

              {qType === 'mcq-multiple' && (() => {
                const options = config.options || []
                const key = `${question.id}-0`
                const ans = answers[key] || { answerText: '', images: [] }
                let selectedIndices: number[] = []
                try { selectedIndices = JSON.parse(ans.answerText || '[]') } catch {
                  // Default [] already set above — malformed JSON from prior save
                }
                const toggleIndex = (oi: number) => {
                  const newIndices = selectedIndices.includes(oi)
                    ? selectedIndices.filter((i: number) => i !== oi)
                    : [...selectedIndices, oi]
                  onAnswerChange(question.id, 0, JSON.stringify(newIndices.sort((a: number, b: number) => a - b)))
                }
                return (
                  <div className="space-y-2">
                    {options.map((opt: string, oi: number) => (
                      <label
                        key={oi}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          selectedIndices.includes(oi)
                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIndices.includes(oi)}
                          onChange={() => toggleIndex(oi)}
                          className="text-emerald-500"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )
              })()}

              {qType === 'fill-blanks' && (() => {
                const blanks: { id: string; answer: string; marks: number }[] = config.blanks || []
                return (
                  <div className="space-y-3">
                    {blanks.map((blank, si) => {
                      const key = `${question.id}-${si}`
                      const ans = answers[key] || { answerText: '', images: [] }
                      return (
                        <div key={si} className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground w-6 shrink-0">{toBengaliNumerals(si + 1)}.</span>
                          <input
                            type="text"
                            value={ans.answerText || ''}
                            onChange={(e) => onAnswerChange(question.id, si, e.target.value)}
                            placeholder={`শূন্যস্থান ${si + 1} পূরণ করুন...`}
                            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                          {blank.marks > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">{toBengaliNumerals(blank.marks)} নম্বর</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {qType === 'written' && answerMode !== 'image-only' && (() => {
                const key = `${question.id}-0`
                const ans = answers[key] || { answerText: '', images: [] }
                return (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="আপনার উত্তর লিখুন... (প্রয়োজনে নিচে থেকে ছবি সংযুক্ত করতে পারেন)"
                      value={ans.answerText || ''}
                      onChange={(e) => onAnswerChange(question.id, 0, e.target.value)}
                      rows={8}
                      className="text-base min-h-[200px] w-full resize-y focus-visible:ring-emerald-400/50"
                      onInput={(e) => {
                        const target = e.currentTarget
                        target.style.height = 'auto'
                        target.style.height = target.scrollHeight + 'px'
                      }}
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-0.5">
                      <span>
                        {toBengaliNumerals((ans.answerText || '').length)} অক্ষর
                      </span>
                      {(ans.answerText || '').trim() && (
                        <span>
                          ~{toBengaliNumerals(Math.max(1, Math.ceil((ans.answerText || '').trim().split(/\s+/).length)))} শব্দ
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {qType === 'written' && answerMode !== 'text-only' && (() => {
                const imgKey = `${question.id}-1`
                const imgAns = answers[imgKey] || { answerText: '', images: [] }
                const imgAnswerId = answerIdMap[question.id]?.[1]
                return (
                  <div className="space-y-3 pt-2 border-t border-dashed border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                        <ImagePlus className="size-4" />
                        ছবি সংযুক্ত করুন (ঐচ্ছিক)
                      </span>
                    </div>
                    {imgAns.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {imgAns.images.map((img: AnswerImage) => (
                          <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border bg-muted/30 cursor-pointer"
                            onClick={() => onImageClick?.(img.imageUrl, 'উত্তরের ছবি')}
                          >
                            <SafeImage src={img.imageUrl} alt="উত্তরের ছবি" className="size-20 object-cover" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id, question.id, 1); }}
                              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => imgAnswerId && onAddImage(imgAnswerId, question.id, 1)}
                      className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-muted-foreground hover:text-emerald-600 text-sm py-3"
                    >
                      <ImagePlus className="size-5" />
                      ছবি যোগ করুন
                    </button>
                  </div>
                )
              })()}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function CQBlock({
  question,
  index,
  answers,
  onAnswerChange,
  collapsed,
  onToggle,
  answerIdMap,
  onAddImage,
  onRemoveImage,
  answerMode = 'flexible',
  maxImagesPerAnswer = 5,
  onImageClick,
}: {
  question: CQQuestionData
  index: number
  answers: Record<string, AnswerState>
  onAnswerChange: (
    questionId: string,
    subIndex: number,
    value: string
  ) => void
  collapsed: boolean
  onToggle: () => void
  answerIdMap: Record<string, string[]>
  onAddImage: (answerId: string, questionId: string, subIndex: number) => void
  onRemoveImage: (imageId: string, questionId: string, subIndex: number) => void
  answerMode?: AnswerMode
  maxImagesPerAnswer?: number
  onImageClick?: (src: string, alt?: string) => void
}) {
  const questionType = (question.type || 'cq').toLowerCase()
  if (questionType !== 'cq' && questionType !== 'typed') {
    return (
      <NonCQQuestionBlock
        question={question}
        index={index}
        answers={answers}
        onAnswerChange={onAnswerChange}
        collapsed={collapsed}
        onToggle={onToggle}
        answerIdMap={answerIdMap}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
        maxImagesPerAnswer={maxImagesPerAnswer}
        answerMode={answerMode}
        onImageClick={onImageClick}
      />
    )
  }

  const isTyped = questionType === 'typed'
  const cq = question.cq

  let stimulus = ''
  let stimulusImage: string | null = null
  let subQuestions: { text: string; image: string | null }[] = []

  if (isTyped) {
    stimulus = question.typedUddeepok || ''
    stimulusImage = question.typedUddeepokImage || null
    subQuestions = [
      { text: question.typedQuestion1 || '', image: question.typedQuestion1Image || null },
      { text: question.typedQuestion2 || '', image: question.typedQuestion2Image || null },
      { text: question.typedQuestion3 || '', image: question.typedQuestion3Image || null },
      { text: question.typedQuestion4 || '', image: question.typedQuestion4Image || null },
    ]
  } else if (cq) {
    stimulus = cq.uddeepok
    stimulusImage = cq.uddeepokImage
    subQuestions = [
      { text: cq.question1, image: cq.question1Image },
      { text: cq.question2, image: cq.question2Image },
      { text: cq.question3, image: cq.question3Image },
      { text: cq.question4, image: cq.question4Image },
    ]
  }

  const globalKey = `${question.id}-4`
  const globalAns = answers[globalKey]
  const hasGlobalImage = (globalAns?.images?.length ?? 0) > 0

  const answeredCount = (() => {
    if (answerMode === 'complete-image-only') {
      return hasGlobalImage ? subQuestions.length : 0
    }
    if (answerMode === 'image-only' && hasGlobalImage) {
      return subQuestions.length
    }
    return subQuestions.filter((_, si) => {
      const key = `${question.id}-${si}`
      const ans = answers[key]
      if (answerMode === 'text-only') {
        return ans?.answerText?.trim()
      }
      if (answerMode === 'image-only') {
        return (ans?.images?.length ?? 0) > 0
      }
      // flexible mode
      return ans?.answerText?.trim() || (ans?.images?.length ?? 0) > 0
    }).length
  })()

  return (
    <Card id={`cq-${question.id}`} className="border-border/50 overflow-hidden motion-safe:animate-fade-in motion-safe:animate-slide-up">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center size-8 rounded-full bg-emerald-500 text-white font-bold text-sm shrink-0">
              {toBengaliNumerals(index + 1)}
            </span>
            <div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">
                CQ {toBengaliNumerals(index + 1)}
              </span>
              <p className="text-xs text-muted-foreground">
                {answeredCount}/{subQuestions.length} উত্তর দেওয়া হয়েছে | {question.marks} নম্বর
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {toBengaliNumerals(question.marks)} নম্বর
            </Badge>
            {collapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-4 sm:p-6 space-y-6">
              {stimulus ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <FileQuestion className="size-4" />
                    উদ্দীপক
                  </h4>
                  <div className="rounded-lg bg-muted/50 p-4 border">
                    <RichContentRenderer content={stimulus} className="text-base leading-relaxed" />
                  </div>
                  {stimulusImage && (
                    <div className="rounded-lg overflow-hidden border bg-muted/30">
                      <SafeImage src={stimulusImage} alt="উদ্দীপকের ছবি" className="max-h-64 object-contain mx-auto" />
                    </div>
                  )}
                </div>
              ) : null}

              {stimulus ? <Separator /> : null}

              {/* In complete-image-only mode, don't render individual sub-question inputs */}
              {answerMode !== 'complete-image-only' && subQuestions.map((sq, si) => {
                const key = `${question.id}-${si}`
                const ans = answers[key] || { answerText: '', images: [] }
                const answerId = answerIdMap[question.id]?.[si];
              const isAnswered = answerMode === 'text-only'
    ? !!ans.answerText?.trim()
    : answerMode === 'image-only'
      ? ans.images.length > 0
      : hasAnswerContent(ans.answerText, ans.images)

                return (
                  <div key={si} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center size-7 rounded-full bg-emerald-500 text-white font-bold text-xs shrink-0">
                        {bengaliLabels[si]}
                      </span>
                      <span className="font-semibold text-sm">প্রশ্ন {bengaliLabels[si]}</span>
                      {isAnswered ? (
                        <CheckCircle className="size-4 text-emerald-500 ml-auto" />
                      ) : null}
                    </div>

                    <div className="rounded-lg bg-muted/30 p-3 border text-sm leading-relaxed">
                      <RichContentRenderer content={sq.text} />
                    </div>

                    {sq.image && (
                      <div className="rounded-lg overflow-hidden border bg-muted/30">
                        <SafeImage src={sq.image} alt={`প্রশ্ন ${bengaliLabels[si]}-এর ছবি`} className="max-h-48 object-contain mx-auto" />
                      </div>
                    )}

                    {answerMode !== 'text-only' && ans.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ans.images.map((img) => (
                          <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border bg-muted/30 cursor-pointer"
                            onClick={() => onImageClick?.(img.imageUrl, 'উত্তরের ছবি')}
                          >
                            <SafeImage src={img.imageUrl} alt="উত্তরের ছবি" className="size-20 object-cover" />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id, question.id, si); }}
                              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {/* Textarea: shown in flexible and text-only modes */}
                      {answerMode !== 'image-only' && (
                        <div className="flex-1 space-y-1.5">
                          <Textarea
                            placeholder={`প্রশ্ন ${bengaliLabels[si]}-এর উত্তর লিখুন...`}
                            value={ans.answerText || ''}
                            onChange={(e) => onAnswerChange(question.id, si, e.target.value)}
                            rows={4}
                            className="text-base min-h-[100px] w-full resize-y focus-visible:ring-emerald-400/50"
                            onInput={(e) => {
                              const target = e.currentTarget
                              target.style.height = 'auto'
                              target.style.height = target.scrollHeight + 'px'
                            }}
                          />
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-0.5">
                            <span>
                              {toBengaliNumerals((ans.answerText || '').length)} অক্ষর
                            </span>
                            {(ans.answerText || '').trim() && (
                              <span>
                                ~{toBengaliNumerals(Math.max(1, Math.ceil((ans.answerText || '').trim().split(/\s+/).length)))} শব্দ
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Image upload button: shown in flexible and image-only modes */}
                      {answerMode !== 'text-only' && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => answerId && onAddImage(answerId, question.id, si)}
                            className="flex flex-col items-center justify-center gap-1 size-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-muted-foreground hover:text-emerald-600"
                            title="ছবি যোগ করুন"
                          >
                            <ImagePlus className="size-5" />
                            <span className="text-[10px]">ছবি</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Global image upload for whole CQ (subIndex 4) */}
              {/* Show in flexible, image-only, and complete-image-only modes. Hide in text-only mode. */}
              {answerMode !== 'text-only' && (() => {
                const globalAnsLocal = answers[globalKey] || { answerText: '', images: [] }
                const globalAnswerId = answerIdMap[question.id]?.[4]
                const isCompleteMode = answerMode === 'complete-image-only'
                return (
                  <div className={cn(
                    'space-y-3',
                    !isCompleteMode && 'pt-2 border-t border-dashed border-border/50'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                        <ImagePlus className="size-4" />
                        {isCompleteMode ? 'সম্পূর্ণ উত্তরের ছবি আপলোড করুন' : 'সম্পূর্ণ প্রশ্নের জন্য ছবি (ঐচ্ছিক)'}
                      </span>
                    </div>
                    {isCompleteMode && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-md px-3 py-1.5 border border-amber-200 dark:border-amber-800">
                        সম্পূর্ণ উত্তরের খাতার ছবি আপলোড করতে হবে — এই ছবিটি সকল উপপ্রশ্নের উত্তর হিসেবে গণ্য হবে
                      </p>
                    )}
                    {globalAnsLocal.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {globalAnsLocal.images.map((img) => (
                          <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border bg-muted/30 cursor-pointer"
                            onClick={() => onImageClick?.(img.imageUrl, 'সম্পূর্ণ উত্তরের ছবি')}
                          >
                            <SafeImage src={img.imageUrl} alt="সম্পূর্ণ উত্তরের ছবি" className={cn(isCompleteMode ? 'size-32' : 'size-24', 'object-cover')} />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id, question.id, 4); }}
                              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => globalAnswerId && onAddImage(globalAnswerId, question.id, 4)}
                      className={cn(
                        'flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-muted-foreground hover:text-emerald-600 text-sm',
                        isCompleteMode ? 'py-6' : 'py-3'
                      )}
                    >
                      <ImagePlus className={cn(isCompleteMode ? 'size-6' : 'size-5')} />
                      {isCompleteMode ? 'সম্পূর্ণ উত্তরের ছবি আপলোড করুন' : 'সম্পূর্ণ উত্তরের জন্য ছবি যোগ করুন'}
                    </button>
                  </div>
                )
              })()}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function CQExamViewerPage() {
  const params = useRouteParams()
  const goBack = useRouterStore((s) => s.goBack)
  const navigate = useRouterStore((s) => s.navigate)
  const { user, isAuthenticated } = useShallowAuth()
  const { toast } = useToast()
  const uploadResolveRef = useRef<((url: string | null) => void) | null>(null)
  const { startUpload } = useUploadThing('screenshotUploader', {
    onClientUploadComplete: (res) => {
      const resolve = uploadResolveRef.current
      uploadResolveRef.current = null
      resolve?.(res?.[0]?.ufsUrl ?? res?.[0]?.url ?? null)
    },
    onUploadError: () => {
      const resolve = uploadResolveRef.current
      uploadResolveRef.current = null
      resolve?.(null)
    },
  })

  const setId = params.examId || ''
  const packageId = params.packageId || ''

  const [setData, setSetData] = useState<SetDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitSuccessDialogOpen, setSubmitSuccessDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [answerIdMap, setAnswerIdMap] = useState<Record<string, string[]>>({})
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [collapsedCQs, setCollapsedCQs] = useState<Record<string, boolean>>({})

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viewer = useImageViewer()

  const handleImagePreview = useCallback((src: string, alt?: string) => {
    viewer?.openViewer([{ src, alt }])
  }, [viewer])

  const fetchSetDetail = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      setError('পরীক্ষার আইডি পাওয়া যায়নি');
      return;
    }
    setLoading(true)
    try {
      const controller = new AbortController()
      abortTimerRef.current = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`/api/cq-exam-packages?action=set-detail&setId=${setId}`, { signal: controller.signal })
      clearTimeout(abortTimerRef.current)
      if (!res.ok) throw new Error('Failed to fetch set detail')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const set = json.data?.set
      const questions = set.questions || []
      setSetData({ set, questions })
      const collapsed: Record<string, boolean> = {}
      questions.forEach((q: CQQuestionData, i: number) => {
        collapsed[q.id] = i !== 0
      })
      setCollapsedCQs(collapsed)
    } catch {
      setError('সেটের তথ্য লোড করতে সমস্যা হয়েছে')
    } finally {
      setLoading(false)
    }
  }, [setId])

  useEffect(() => {
    fetchSetDetail()
    return () => {
      if (abortTimerRef.current) clearTimeout(abortTimerRef.current)
    }
  }, [fetchSetDetail])

  const startExam = async () => {
    if (!isAuthenticated || !user || !setId) {
      toast({ title: 'লগইন করুন', description: 'পরীক্ষা দিতে প্রথমে লগইন করুন', variant: 'destructive' })
      navigate('login')
      return
    }

    setStarting(true)
    try {
      const controller = new AbortController()
      abortTimerRef.current = setTimeout(() => controller.abort(), 15000)
      const csrfToken = await fetchCsrfToken()
      const res = await fetch('/api/cq-exam-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({
          action: 'start-exam',
          setId,
          userId: user.id,
        }),
        signal: controller.signal,
      })
      clearTimeout(abortTimerRef.current)
      const json = await res.json()
      if (json.error) {
        toast({ title: 'ত্রুটি', description: json.error, variant: 'destructive' })
        return
      }
      const submission = json.data?.submission
      if (!submission) {
        toast({ title: 'ত্রুটি', description: 'পরীক্ষা শুরু করতে সমস্যা হয়েছে', variant: 'destructive' })
        return
      }

      // If already submitted, redirect to result page
      if (json.data?.status?.toLowerCase() === 'submitted') {
        navigate('cq-exam-result', { packageId, examId: setId, resultId: submission.id })
        return
      }

      setSubmissionId(submission.id)
      setTimeRemaining((setData?.set.duration || 0) * 60)
      setExamStarted(true)

      // Map answer IDs: { questionId: [ans0_id, ans1_id, ans2_id, ans3_id, ans4_id] }
      const idMap: Record<string, string[]> = {}
      const answerState: Record<string, AnswerState> = {}
      for (const ans of submission.answers || []) {
        if (!idMap[ans.questionId]) idMap[ans.questionId] = []
        idMap[ans.questionId][ans.subIndex] = ans.id
        const key = `${ans.questionId}-${ans.subIndex}`
        answerState[key] = {
          answerText: ans.answerText || '',
          images: (ans.images || []).map((img: any) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            order: img.order,
          })),
        }
      }
      setAnswerIdMap(idMap)
      setAnswers(answerState)
    } catch {
      toast({ title: 'ত্রুটি', description: 'পরীক্ষা শুরু করতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setStarting(false)
    }
  }

  const saveAnswerText = async (answerId: string, text: string) => {
    try {
      const csrfToken = await fetchCsrfToken()
      await fetch('/api/cq-exam-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({
          action: 'save-answer',
          answerId,
          answerText: text,
        }),
      })
    } catch {
    }
  }

  const addAnswerImage = async (answerId: string, questionId: string, subIndex: number) => {
    // Enforce maxImagesPerAnswer limit
    const key = `${questionId}-${subIndex}`
    const currentImages = answers[key]?.images?.length ?? 0
    const maxImages = setData?.set.maxImagesPerAnswer ?? 5
    if (currentImages >= maxImages) {
      toast({
        title: 'ছবির সীমা পূর্ণ',
        description: `প্রতিটি উত্তরে সর্বোচ্চ ${toBengaliNumerals(maxImages)}টি ছবি আপলোড করা যাবে`,
        variant: 'destructive',
      })
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      // Upload file via UploadThing
      let imageUrl: string | null = null
      try {
        const url = await new Promise<string | null>((resolve) => {
          uploadResolveRef.current = resolve
          startUpload([file])
        })
        imageUrl = url
        if (!imageUrl) throw new Error('Upload failed')

        // Save image record
        const csrfToken = await fetchCsrfToken()
        const imgRes = await fetch('/api/cq-exam-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
          body: JSON.stringify({
            action: 'add-image',
            answerId,
            imageUrl,
          }),
        })
        if (!imgRes.ok) throw new Error('Failed to save image')
        const imgData = await imgRes.json()

        // Update local state
        setAnswers((prev) => {
          const current = prev[key] || { answerText: '', images: [] }
          return {
            ...prev,
            [key]: {
              ...current,
              images: [...current.images, { id: imgData.data?.image?.id, imageUrl: imageUrl!, order: current.images.length }],
            },
          }
        })
      } catch (err) {
        console.error('Image upload error:', err)
        toast({ title: 'ত্রুটি', description: 'ছবি আপলোড করতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    }
    input.click()
  }

  const removeAnswerImage = async (imageId: string, questionId: string, subIndex: number) => {
    try {
      const csrfToken = await fetchCsrfToken()
      await fetch('/api/cq-exam-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({
          action: 'remove-image',
          imageId,
        }),
      })
      const key = `${questionId}-${subIndex}`
      setAnswers((prev) => {
        const current = prev[key] || { answerText: '', images: [] }
        return {
          ...prev,
          [key]: {
            ...current,
            images: current.images.filter((img) => img.id !== imageId),
          },
        }
      })
    } catch {
      toast({ title: 'ত্রুটি', description: 'ছবি মুছতে সমস্যা হয়েছে', variant: 'destructive' })
    }
  }

  const handleAnswerChange = useCallback(
    async (questionId: string, subIndex: number, value: string) => {
      const key = `${questionId}-${subIndex}`

      setAnswers((prev) => {
        const current = prev[key] || { answerText: '', images: [] }
        return { ...prev, [key]: { ...current, answerText: value } }
      })
      const ansId = answerIdMap[questionId]?.[subIndex]
      if (ansId) {
        saveAnswerText(ansId, value)
      }
    },
    [answerIdMap]
  )

  const handleSubmitExamRef = useRef<() => void>(() => {})

  const handleSubmitExam = useCallback(async () => {
    if (!submissionId) return
    setSubmitting(true)
    try {
      const timeUsed = (setData?.set.duration || 0) * 60 - timeRemaining
      const csrfToken = await fetchCsrfToken()
      const res = await fetch('/api/cq-exam-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({
          action: 'submit-exam',
          submissionId,
          timeTaken: timeUsed,
        }),
      })
      const json = await res.json()
      if (json.error) {
        toast({ title: 'ত্রুটি', description: json.error, variant: 'destructive' })
        return
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setSubmitSuccessDialogOpen(true)
    } catch {
      toast({ title: 'ত্রুটি', description: 'পরীক্ষা জমা দিতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }, [submissionId, setData, timeRemaining, toast])

  handleSubmitExamRef.current = handleSubmitExam

  useEffect(() => {
    if (!examStarted) return

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [examStarted])

  useEffect(() => {
    if (examStarted && timeRemaining <= 0 && submissionId) {
      handleSubmitExamRef.current()
    }
  }, [timeRemaining, examStarted, submissionId])

  // ── Draft auto-save and restore (safe defaults before early returns) ──
  const pendingQuestions = setData?.questions || []
  const pendingAnswered = pendingQuestions.reduce((sum, q) => sum + (q.type === 'cq' || (q.type || 'cq').toLowerCase() === 'typed' ? 0 : 0), 0)
  const pendingSubQuestions = pendingQuestions.reduce((sum) => sum + 1, 0)
  const cqDraft = useCQDraft(setId, answers, pendingSubQuestions, pendingAnswered)
  const draftRestoredRef = useRef(false)
  useEffect(() => {
    if (!examStarted || draftRestoredRef.current) return
    const serverAnswersExist = questions.length > 0 && Object.keys(answerIdMap).length > 0
    if (!serverAnswersExist) return

    const draft = cqDraft.loadDraft()
    if (draft && draft.answers && Object.keys(draft.answers).length > 0) {
      const hasLocalContent = Object.values(draft.answers).some(a => a.answerText?.trim())
      if (hasLocalContent) {
        setAnswers((prev) => {
          const newState = { ...prev }
          for (const [key, val] of Object.entries(draft.answers)) {
            if (!newState[key]?.answerText?.trim() && val.answerText?.trim()) {
              newState[key] = { ...(newState[key] || { answerText: '', images: [] }), answerText: val.answerText }
            }
          }
          return newState
        })
      }
    }
    draftRestoredRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStarted, answerIdMap, pendingQuestions.length, cqDraft])

  if (loading) {
    return (
      <div>
        {/* Premium loading skeleton matching real layout */}
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="h-1 bg-muted/30"><div className="h-full w-0 bg-emerald-400" /></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/50 overflow-hidden">
              {/* Question header skeleton */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50" />
                  <div>
                    <div className="h-4 w-24 bg-muted rounded mb-1" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
              {/* Stimulus skeleton */}
              <div className="px-4 pb-4 space-y-3">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="rounded-lg bg-muted/30 p-4 border space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                {/* Sub-question skeletons */}
                {[0,1].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                    <div className="h-24 bg-muted/20 rounded-lg border" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !setData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">{error || 'পরীক্ষা খুঁজে পাওয়া যায়নি'}</p>
          <Button onClick={goBack} variant="outline">ফিরে যান</Button>
        </Card>
      </div>
    )
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg mx-4"
        >
          <Card className="border-emerald-200/50 dark:border-emerald-800/30">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                <FileQuestion className="size-10 text-emerald-500" />
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-1">{setData.set.title}</h1>
                <p className="text-sm text-muted-foreground">
                  CQ পরীক্ষা — {toBengaliNumerals(setData.questions.length)}টি সৃজনশীল প্রশ্ন
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-xl font-bold text-emerald-600">{toBengaliNumerals(setData.set.totalMarks)}</p>
                  <p className="text-xs text-muted-foreground">মোট নম্বর</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/20">
                  <p className="text-xl font-bold text-teal-600">{toBengaliNumerals(setData.set.totalQuestions)}</p>
                  <p className="text-xs text-muted-foreground">প্রশ্ন</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                  <p className="text-xl font-bold text-amber-600">{setData.set.duration}</p>
                  <p className="text-xs text-muted-foreground">মিনিট</p>
                </div>
              </div>

              <Button
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                onClick={startExam}
                disabled={starting}
              >
                {starting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    শুরু হচ্ছে...
                  </>
                ) : (
                  <>
                    <Timer className="size-4" />
                    পরীক্ষা শুরু করুন
                  </>
                )}
              </Button>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {setData.set.answerMode === 'text-only'
                    ? 'শুধুমাত্র টেক্সট উত্তর দিতে পারবেন'
                    : setData.set.answerMode === 'image-only'
                      ? 'শুধুমাত্র ছবি আপলোড করতে পারবেন'
                      : setData.set.answerMode === 'complete-image-only'
                        ? 'সম্পূর্ণ উত্তরের খাতার ছবি আপলোড করতে হবে'
                        : 'আপনি টেক্সট, ছবি অথবা সম্পূর্ণ উত্তরের ছবি দিতে পারবেন'}
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>* উত্তরগুলি স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে</p>
                <p>* নির্ধারিত সময় শেষ হলে স্বয়ংক্রিয়ভাবে জমা হবে</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const answerMode = setData.set.answerMode || 'flexible'
  const questions = setData.questions || []

  const countAnswersForQuestion = (q: CQQuestionData): number => {
    const qt = (q.type || 'cq').toLowerCase()
    if (qt === 'cq' || qt === 'typed') {
      if (answerMode === 'complete-image-only') {
        const gk = `${q.id}-4`
        return (answers[gk]?.images?.length ?? 0) > 0 ? 4 : 0
      }
      if (answerMode === 'image-only') {
        const gk = `${q.id}-4`
        if ((answers[gk]?.images?.length ?? 0) > 0) return 4
      }
      let count = 0
      for (let si = 0; si < 4; si++) {
        const ans = answers[`${q.id}-${si}`]
        if (answerMode === 'text-only') {
          if (ans?.answerText?.trim()) count++
        } else if (answerMode === 'image-only') {
          if ((ans?.images?.length ?? 0) > 0) count++
        } else {
          if (ans?.answerText?.trim() || (ans?.images?.length ?? 0) > 0) count++
        }
      }
      return count
    }
    if (qt === 'fill-blanks') {
      let blanks: any[] = []
      const c = q.config || {}; blanks = (c as any).blanks || []
      return blanks.filter((_, si) => !!answers[`${q.id}-${si}`]?.answerText?.trim()).length
    }
    const ans = answers[`${q.id}-0`]
    if (qt === 'written') {
      return (ans?.answerText?.trim() || (answers[`${q.id}-1`]?.images?.length ?? 0) > 0) ? 1 : 0
    }
    return ans?.answerText?.trim() ? 1 : 0
  }

  const subQuestionCountForQuestion = (q: CQQuestionData): number => {
    const qt = (q.type || 'cq').toLowerCase()
    if (qt === 'cq' || qt === 'typed') return 4
    if (qt === 'fill-blanks') {
      let blanks: any[] = []
      const c = q.config || {}; blanks = (c as any).blanks || []
      return blanks.length || 1
    }
    return 1
  }

  const totalAnswered = questions.reduce((sum, q) => sum + countAnswersForQuestion(q), 0)
  const totalSubQuestions = questions.reduce((sum, q) => sum + subQuestionCountForQuestion(q), 0)
  const progressPercent = totalSubQuestions > 0 ? (totalAnswered / totalSubQuestions) * 100 : 0

  return (
    <div>
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current)
                navigate('cq-exam-package-detail', { packageId })
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{setData.set.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  <span className="text-foreground font-semibold">{toBengaliNumerals(totalAnswered)}</span>
                  {'/'}{toBengaliNumerals(totalSubQuestions)}
                </span>
                <span className="text-[10px] text-muted-foreground/60">|</span>
                <span className="text-xs text-muted-foreground">
                  {toBengaliNumerals(totalSubQuestions - totalAnswered)} বাকি
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={timeRemaining < 60 ? 'destructive' : 'secondary'}
              className={`gap-1.5 tabular-nums h-7 ${timeRemaining < 300 && timeRemaining >= 60 ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700' : ''}`}
            >
              <Clock className="size-3" />
              {formatTime(timeRemaining)}
            </Badge>
          </div>
        </div>
        <div className="relative h-1 bg-muted/30">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-r-full"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)',
            }}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {questions.map((q, idx) => (
          <CQBlock
            key={q.id}
            question={q}
            index={idx}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            collapsed={collapsedCQs[q.id] ?? idx !== 0}
            onToggle={() =>
              setCollapsedCQs((prev) => ({
                ...prev,
                [q.id]: !(prev[q.id] ?? idx !== 0),
              }))
            }
            answerIdMap={answerIdMap}
            onAddImage={addAnswerImage}
            onRemoveImage={removeAnswerImage}
            answerMode={answerMode}
            maxImagesPerAnswer={setData.set.maxImagesPerAnswer ?? 5}
            onImageClick={handleImagePreview}
          />
        ))}

        {/* Desktop submit button */}
        <div className="hidden sm:flex justify-center pt-4 pb-8">
          <Button
            className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white min-w-[200px]"
            onClick={() => setSubmitDialogOpen(true)}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'জমা হচ্ছে...' : 'পরীক্ষা জমা দিন'}
          </Button>
        </div>

        {/* Mobile sticky bottom bar */}
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/50 safe-bottom">
          <div className="flex items-center justify-between px-2 py-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Find the first visible (expanded) CQ that isn't the first question
                let prevIdx = -1
                for (let i = 0; i < questions.length; i++) {
                  if (!(collapsedCQs[questions[i].id] ?? i !== 0)) {
                    if (i > 0) prevIdx = i - 1
                    break
                  }
                }
                if (prevIdx >= 0) {
                  const prev = questions[prevIdx]
                  const firstExpanded = questions.findIndex(q => !(collapsedCQs[q.id] ?? q.id !== questions[0].id))
                  if (firstExpanded >= 0) {
                    setCollapsedCQs(state => ({ ...state, [prev.id]: false, [questions[firstExpanded].id]: true }))
                  }
                  setTimeout(() => document.getElementById(`cq-${prev.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
                }
              }}
              className="gap-1 h-11 flex-1 min-w-0"
            >
              <span className="text-xs truncate">পূর্ববর্তী</span>
            </Button>

            <div className="flex items-center gap-1 px-1 shrink-0">
              <span className="text-[10px] text-muted-foreground font-mono">
                {toBengaliNumerals(totalAnswered)}/{toBengaliNumerals(totalSubQuestions)}
              </span>
            </div>

            <Button
              size="sm"
              onClick={() => setSubmitDialogOpen(true)}
              disabled={submitting}
              className="gap-1.5 h-11 flex-1 min-w-0 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              <span className="text-xs">জমা দিন</span>
            </Button>
          </div>
        </div>
        {/* Bottom spacer for mobile bar */}
        <div className="sm:hidden h-[4.5rem]" />
      </div>

      {/* ─── Submit Confirmation Dialog ─────────────────────────────────── */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>পরীক্ষা জমা দিন</DialogTitle>
            <DialogDescription>
              আপনার উত্তর জমা দেওয়ার পূর্বে যাচাই করুন
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Progress summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <span className="text-sm font-medium">প্রশ্নের উত্তর</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="size-3.5" />
                  {toBengaliNumerals(totalAnswered)} উত্তর
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <PenLine className="size-3.5" />
                  {toBengaliNumerals(totalSubQuestions - totalAnswered)} বাকি
                </span>
              </div>
            </div>

            {/* Question-by-question review */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {questions.map((q, idx) => {
                const answered = countAnswersForQuestion(q)
                const totalSub = subQuestionCountForQuestion(q)
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex items-center justify-center size-5 rounded-full bg-muted font-semibold text-[10px] shrink-0">
                        {toBengaliNumerals(idx + 1)}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {q.type === 'cq' || q.type === 'typed' ? `CQ ${toBengaliNumerals(idx + 1)}` : getTypeLabel(q.type || 'mcq-single')}
                      </span>
                    </div>
                    <span className={cn(
                      'font-mono text-[10px] shrink-0 ml-2',
                      answered === totalSub ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    )}>
                      {toBengaliNumerals(answered)}/{toBengaliNumerals(totalSub)}
                    </span>
                  </div>
                )
              })}
            </div>

            <DialogDescription className="text-xs text-center pt-1">
              আপনি কি নিশ্চিতভাবে পরীক্ষা জমা দিতে চান?
            </DialogDescription>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
              disabled={submitting}
              className="flex-1 sm:flex-none"
            >
              বাতিল
            </Button>
            <Button
              onClick={() => {
                setSubmitDialogOpen(false)
                cqDraft.clearDraft()
                handleSubmitExam()
              }}
              disabled={submitting}
              className="gap-2 flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitting ? 'জমা হচ্ছে...' : 'জমা দিন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitSuccessDialogOpen} onOpenChange={setSubmitSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-500" />
              পরীক্ষা জমা হয়েছে
            </DialogTitle>
            <DialogDescription>
              আপনার উত্তর জমা দেওয়া হয়েছে।
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 -mt-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              শিক্ষক উত্তর মূল্যায়ন করে ফলাফল প্রকাশ করবেন। অনুগ্রহ করে অপেক্ষা করুন।
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setSubmitSuccessDialogOpen(false)
                navigate('cq-exam-package-detail', { packageId })
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              প্যাকেজে ফিরে যান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
