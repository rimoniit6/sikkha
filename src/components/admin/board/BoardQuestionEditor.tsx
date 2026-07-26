'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ImageUploader from '@/components/ui/image-uploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  FileQuestion,
  Sigma,
} from 'lucide-react'
import Image from 'next/image'
import { stepInfo, typeColors, typeLabels, difficultyLabels, difficultyColors } from './constants'
import type { ClassItem, SubjectItem, ChapterItem, FormState } from './types'

interface BoardQuestionEditorProps {
  step: number
  setStep: (v: number) => void
  editId: string | null
  form: FormState
  setForm: (v: FormState | ((prev: FormState) => FormState)) => void
  saving: boolean
  classes: ClassItem[]
  subjects: SubjectItem[]
  chapters: ChapterItem[]
  boardOptions: { value: string; label: string }[]
  yearOptions: { value: string; label: string }[]
  classLabelMap: Record<string, string>
  boardLabelMap: Record<string, string>
  setViewMode: (v: 'list' | 'editor') => void
  goNext: () => void
  goPrev: () => void
  handleSave: () => Promise<void>
  handleTypeChange: (newType: 'mcq' | 'cq') => void
}

export default function BoardQuestionEditor({
  step, setStep: _setStep, editId, form, setForm, saving,
  classes, subjects, chapters, boardOptions, yearOptions,
  classLabelMap: _classLabelMap, boardLabelMap,
  setViewMode, goNext, goPrev, handleSave, handleTypeChange,
}: BoardQuestionEditorProps) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setViewMode('list')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {editId ? 'বোর্ড প্রশ্ন সম্পাদনা' : 'নতুন বোর্ড প্রশ্ন তৈরি'}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              ধাপ {step} / ৩ — {stepInfo[step - 1].title}
            </p>
          </div>
        </div>
        <Badge className={`${form.type === 'mcq' ? typeColors.mcq : typeColors.cq} text-sm px-3 py-1`}>
          {typeLabels[form.type]}
        </Badge>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          {stepInfo.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.num
            const isCompleted = step > s.num
            return (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`flex items-center justify-center h-9 w-9 rounded-full border-2 transition-all ${isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : isActive ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-muted-foreground/30 text-muted-foreground/50'}`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`hidden sm:inline text-sm font-medium ${isActive ? 'text-emerald-600' : isCompleted ? 'text-emerald-600' : 'text-muted-foreground/50'}`}>
                  {s.title}
                </span>
                {i < stepInfo.length - 1 && (
                  <div className={`hidden sm:block w-12 lg:w-20 h-0.5 mx-1 ${step > s.num ? 'bg-emerald-600' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="sm:hidden flex gap-1 mt-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-emerald-600' : 'bg-muted-foreground/20'}`} />
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6 animate-slide-in-right">
              <div className="space-y-3">
                <Label className="text-base font-semibold">প্রশ্নের ধরন নির্বাচন করুন</Label>
                <Tabs value={form.type} onValueChange={(v) => handleTypeChange(v as 'mcq' | 'cq')}>
                  <TabsList className="grid w-full grid-cols-2 h-12">
                    <TabsTrigger value="mcq" className="gap-2 text-sm">
                      <FileQuestion className="h-4 w-4" />
                      MCQ (বহুনির্বাচনী)
                    </TabsTrigger>
                    <TabsTrigger value="cq" className="gap-2 text-sm">
                      <BookOpen className="h-4 w-4" />
                      CQ (সৃজনশীল)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="border-t pt-6" />

              {form.type === 'mcq' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      প্রশ্ন <span className="text-xs text-destructive">(আবশ্যক)</span>
                      <Sigma className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <Textarea placeholder="প্রশ্ন লিখুন... (গণিতের জন্য $...$ ব্যবহার করুন)" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} />
                    <ImageUploader value={form.questionImage} onChange={(url) => setForm({ ...form, questionImage: url })} label="প্রশ্নের ছবি (ঐচ্ছিক)" />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">অপশনসমূহ</Label>
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                      const key = `option${opt}` as keyof FormState
                      const imgKey = `option${opt}Image` as keyof FormState
                      const labels: Record<string, string> = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }
                      return (
                        <div key={opt} className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                              {labels[opt]}
                            </span>
                            অপশন {labels[opt]} <span className="text-xs text-destructive">(আবশ্যক)</span>
                          </Label>
                          <Input placeholder={`অপশন ${labels[opt]} লিখুন...`} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                          <ImageUploader value={form[imgKey] as string} onChange={(url) => setForm({ ...form, [imgKey]: url })} label="ছবি (ঐচ্ছিক)" />
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label>সঠিক উত্তর <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <RadioGroup value={form.correctAnswer} onValueChange={(v) => setForm({ ...form, correctAnswer: v })} className="flex gap-4">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const labels: Record<string, string> = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }
                        return (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt} id={`correct-${opt}`} />
                            <Label htmlFor={`correct-${opt}`} className="cursor-pointer">{labels[opt]}</Label>
                          </div>
                        )
                      })}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      ব্যাখ্যা (ঐচ্ছিক)
                      <Sigma className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <Textarea placeholder="ব্যাখ্যা লিখুন... (গণিতের জন্য $...$ ব্যবহার করুন)" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={3} />
                    <ImageUploader value={form.explanationImage} onChange={(url) => setForm({ ...form, explanationImage: url })} label="ব্যাখ্যার ছবি (ঐচ্ছিক)" />
                  </div>
                </div>
              )}

              {form.type === 'cq' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      উদ্দীপক <span className="text-xs text-destructive">(আবশ্যক)</span>
                      <Sigma className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <Textarea placeholder="উদ্দীপক লিখুন... (গণিতের জন্য $...$ ব্যবহার করুন)" value={form.uddeepok} onChange={(e) => setForm({ ...form, uddeepok: e.target.value })} rows={4} />
                    <ImageUploader value={form.uddeepokImage} onChange={(url) => setForm({ ...form, uddeepokImage: url })} label="উদ্দীপকের ছবি (ঐচ্ছিক)" />
                  </div>

                  <div className="border-t pt-4" />
                  <Label className="text-base font-semibold">প্রশ্ন-উত্তর জোড়া</Label>

                  {([1, 2, 3, 4] as const).map((n) => {
                    const qKey = `question${n}` as keyof FormState
                    const aKey = `answer${n}` as keyof FormState
                    const qImgKey = `question${n}Image` as keyof FormState
                    const aImgKey = `answer${n}Image` as keyof FormState
                    const banglaNums: Record<number, string> = { 1: '১', 2: '২', 3: '৩', 4: '৪' }
                    const isRequired = n === 1
                    return (
                      <Card key={n} className="border-l-4 border-l-teal-400">
                        <CardContent className="p-4 space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-bold">{banglaNums[n]}</span>
                            প্রশ্ন {banglaNums[n]}
                            {isRequired && <span className="text-xs text-destructive">(আবশ্যক)</span>}
                            {n > 1 && <span className="text-xs text-muted-foreground">(ঐচ্ছিক)</span>}
                          </h4>
                          <Textarea placeholder={`প্রশ্ন ${banglaNums[n]} লিখুন...`} value={form[qKey] as string} onChange={(e) => setForm({ ...form, [qKey]: e.target.value })} rows={2} />
                          <ImageUploader value={form[qImgKey] as string} onChange={(url) => setForm({ ...form, [qImgKey]: url })} label="প্রশ্নের ছবি (ঐচ্ছিক)" />
                          <h5 className="font-medium text-sm mt-2">
                            উত্তর {banglaNums[n]}
                            {isRequired && <span className="text-xs text-destructive ml-1">(আবশ্যক)</span>}
                          </h5>
                          <Textarea placeholder={`উত্তর ${banglaNums[n]} লিখুন...`} value={form[aKey] as string} onChange={(e) => setForm({ ...form, [aKey]: e.target.value })} rows={2} />
                          <ImageUploader value={form[aImgKey] as string} onChange={(url) => setForm({ ...form, [aImgKey]: url })} label="উত্তরের ছবি (ঐচ্ছিক)" />
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-slide-in-right">
              <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-semibold">বোর্ড প্রশ্নের জন্য বোর্ড ও সাল আবশ্যক</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>বোর্ড <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <Select value={form.board} onValueChange={(v) => setForm({ ...form, board: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="বোর্ড নির্বাচন করুন" />
                      </SelectTrigger>
                      <SelectContent>
                    <SelectItem value="none">কোনোটি নয়</SelectItem>
                        {boardOptions.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>সাল <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <Select value={form.yearId} onValueChange={(v) => {
                      const selected = yearOptions.find((y) => y.value === v)
                      setForm({ ...form, yearId: v, year: selected?.label || v })
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="সাল নির্বাচন করুন" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">শ্রেণি → বিষয় → অধ্যায়</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>শ্রেণি <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="শ্রেণি নির্বাচন" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>বিষয় <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })} disabled={!form.classId || subjects.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={form.classId ? 'বিষয় নির্বাচন' : 'প্রথমে শ্রেণি নির্বাচন করুন'} />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>অধ্যায় <span className="text-xs text-destructive">(আবশ্যক)</span></Label>
                    <Select value={form.chapterId} onValueChange={(v) => setForm({ ...form, chapterId: v })} disabled={!form.subjectId || chapters.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={form.subjectId ? 'অধ্যায় নির্বাচন' : 'প্রথমে বিষয় নির্বাচন করুন'} />
                      </SelectTrigger>
                      <SelectContent>
                        {chapters.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>টপিক (ঐচ্ছিক)</Label>
                <Input placeholder="টপিক বা থিম লিখুন..." value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>কঠিনতা</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">সহজ</SelectItem>
                    <SelectItem value="medium">মাঝারি</SelectItem>
                    <SelectItem value="hard">কঠিন</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-slide-in-right">
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">প্রশ্নের প্রিভিউ</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={typeColors[form.type]}>{typeLabels[form.type]}</Badge>
                      <Badge className={difficultyColors[form.difficulty] || ''}>{difficultyLabels[form.difficulty] || form.difficulty}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Archive className="h-3.5 w-3.5" />
                      {boardLabelMap[form.board] || form.board}
                    </span>
                    <span>·</span>
                    <span>{form.year}</span>
                    <span>·</span>
                    <span>{classes.find((c) => c.id === form.classId)?.name || form.classId}</span>
                    <span>·</span>
                    <span>{subjects.find((s) => s.id === form.subjectId)?.name || form.subjectId}</span>
                    {form.chapterId && (
                      <>
                        <span>·</span>
                        <span>{chapters.find((ch) => ch.id === form.chapterId)?.name || form.chapterId}</span>
                      </>
                    )}
                    {form.topic && (
                      <>
                        <span>·</span>
                        <span>{form.topic}</span>
                      </>
                    )}
                  </div>

                  <div className="border-t" />

                  {form.type === 'mcq' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-1">প্রশ্ন:</h4>
                        <RichContentRenderer content={form.question} className="text-sm" />
                        {form.questionImage && (
                          <Image src={form.questionImage} alt="প্রশ্নের ছবি" width={400} height={300} className="mt-2 max-h-48 rounded border" unoptimized />
                        )}
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold mb-1">অপশন:</h4>
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                          const labels: Record<string, string> = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ' }
                          const val = form[`option${opt}` as keyof FormState] as string
                          const img = form[`option${opt}Image` as keyof FormState] as string
                          const isCorrect = form.correctAnswer === opt
                          return (
                            <div key={opt} className={`p-3 rounded-lg border ${isCorrect ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border'}`}>
                              <div className="flex items-start gap-2">
                                <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold shrink-0 ${isCorrect ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}>
                                  {labels[opt]}
                                </span>
                                <div className="flex-1">
                                  <RichContentRenderer content={val} className="text-sm" />
                                  {img && (
                                    <Image src={img} alt={`অপশন ${labels[opt]}`} width={256} height={128} className="mt-1 max-h-32 rounded" unoptimized />
                                  )}
                                </div>
                                {isCorrect && (
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs shrink-0">সঠিক</Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {(form.explanation || form.explanationImage) && (
                        <div>
                          <h4 className="font-semibold mb-1">ব্যাখ্যা:</h4>
                          {form.explanation && (
                            <RichContentRenderer content={form.explanation} className="text-sm text-muted-foreground" />
                          )}
                          {form.explanationImage && (
                            <Image src={form.explanationImage} alt="ব্যাখ্যার ছবি" width={400} height={300} className="mt-2 max-h-48 rounded border" unoptimized />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {form.type === 'cq' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-1">উদ্দীপক:</h4>
                        <RichContentRenderer content={form.uddeepok} className="text-sm" />
                        {form.uddeepokImage && (
                          <Image src={form.uddeepokImage} alt="উদ্দীপকের ছবি" width={400} height={300} className="mt-2 max-h-48 rounded border" unoptimized />
                        )}
                      </div>

                      {([1, 2, 3, 4] as const).map((n) => {
                        const q = form[`question${n}` as keyof FormState] as string
                        const a = form[`answer${n}` as keyof FormState] as string
                        const qImg = form[`question${n}Image` as keyof FormState] as string
                        const aImg = form[`answer${n}Image` as keyof FormState] as string
                        const banglaNums: Record<number, string> = { 1: '১', 2: '২', 3: '৩', 4: '৪' }
                        if (!q && !a) return null
                        return (
                          <div key={n} className="border-l-4 border-l-teal-400 pl-4 space-y-2">
                            <h4 className="font-semibold text-sm">প্রশ্ন {banglaNums[n]}:</h4>
                            <RichContentRenderer content={q} className="text-sm" />
                            {qImg && (
                              <Image src={qImg} alt={`প্রশ্ন ${banglaNums[n]}`} width={256} height={128} className="mt-1 max-h-32 rounded" unoptimized />
                            )}
                            {a && (
                              <>
                                <h5 className="font-medium text-sm text-teal-700 dark:text-teal-300">
                                  উত্তর {banglaNums[n]}:
                                </h5>
                                <RichContentRenderer content={a} className="text-sm text-muted-foreground" />
                                {aImg && (
                                  <Image src={aImg} alt={`উত্তর ${banglaNums[n]}`} width={256} height={128} className="mt-1 max-h-32 rounded" unoptimized />
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2 text-base">
                        <Crown className="h-4 w-4 text-amber-500" />
                        প্রিমিয়াম প্রশ্ন
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        প্রিমিয়াম প্রশ্ন শুধুমাত্র সাবস্ক্রাইব করা ব্যবহারকারীরা দেখতে পাবেন
                      </p>
                    </div>
                    <Switch
                      checked={form.isPremium}
                      onCheckedChange={(v) => setForm({ ...form, isPremium: v })}
                    />
                  </div>
                  {form.isPremium && (
                    <div className="space-y-2">
                      <Label>মূল্য (টাকা)</Label>
                      <Input type="number" placeholder="মূল্য লিখুন" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full sm:w-48" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={goPrev} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  আগের ধাপ
                </Button>
              )}
              {step === 1 && (
                <Button variant="outline" onClick={() => setViewMode('list')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  বাতিল
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step < 3 && (
                <Button onClick={goNext} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  পরবর্তী ধাপ
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editId ? 'আপডেট করুন' : 'প্রকাশ করুন'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
