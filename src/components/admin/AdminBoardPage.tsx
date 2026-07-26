'use client'

import BulkImportDialog from '@/components/admin/BulkImportDialog'
import DataTable, { type BulkAction } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { useTableSelection } from '@/hooks/use-table-selection'
import { useToast } from '@/hooks/use-toast'
import { Archive, FileQuestion, Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import BoardQuestionEditor from './board/BoardQuestionEditor'
import BoardQuestionList from './board/BoardQuestionList'
import FilterBar from './board/FilterBar'
import { emptyForm, resetMcqFields, resetCqFields } from './board/constants'
import type { BoardQuestion, ClassItem, SubjectItem, ChapterItem, FormState } from './board/types'

export default function AdminBoardPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<BoardQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [mcqCount, setMcqCount] = useState(0)
  const [cqCount, setCqCount] = useState(0)
  const [boardCount, setBoardCount] = useState(0)

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list')

  const [search, setSearch] = useState('')
  const [boardFilter, setBoardFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const [page, setPage] = useState(1)
  const perPage = 10

  const [step, setStep] = useState(1)
  const [editId, setEditId] = useState<string | null>(null)
  const [editType, setEditType] = useState<'mcq' | 'cq' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteInfo, setDeleteInfo] = useState<{ id: string; type: 'mcq' | 'cq' } | null>(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [chapters, setChapters] = useState<ChapterItem[]>([])
  const [filterSubjects, setFilterSubjects] = useState<SubjectItem[]>([])

  const { boardOptions, classLevelLabels: classLabelMap, boardSlugToLabel: boardLabelMap, yearOptions } = useHierarchyMetadata()

  useEffect(() => {
    fetch('/api/admin/classes')
      .then((res) => res.json())
      .then((json) => setClasses(Array.isArray(json.data) ? json.data : []))
      .catch((err) => {
        console.error('[AdminBoard] Failed to load classes:', err)
      })
  }, [])

  useEffect(() => {
    if (classFilter && classFilter !== 'all') {
      fetch(`/api/admin/subjects?classId=${classFilter}`)
        .then((res) => res.json())
        .then((json) => {
          setFilterSubjects(Array.isArray(json.data) ? json.data : [])
          setSubjectFilter('all')
        })
        .catch((err) => {
          console.error('[AdminBoard] Failed to load subjects:', err)
        })
    } else {
      setFilterSubjects([])
      setSubjectFilter('all')
    }
  }, [classFilter])

  const fetchSubjects = useCallback(async (classId: string) => {
    if (!classId) {
      setSubjects([])
      return
    }
    try {
      const res = await fetch(`/api/admin/subjects?classId=${classId}`)
      const json = await res.json()
      setSubjects(Array.isArray(json.data) ? json.data : [])
    } catch {
      /* ignore */
    }
  }, [])

  const fetchChapters = useCallback(async (subjectId: string) => {
    if (!subjectId) {
      setChapters([])
      return
    }
    try {
      const res = await fetch(`/api/admin/chapters?subjectId=${subjectId}`)
      const json = await res.json()
      setChapters(Array.isArray(json.data) ? json.data : [])
    } catch {
      /* ignore */
    }
  }, [])

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(perPage))
      if (search) params.set('q', search)
      if (boardFilter !== 'all') params.set('board', boardFilter)
      if (yearFilter !== 'all') params.set('year', yearFilter)
      if (classFilter !== 'all') params.set('classLevel', classFilter)
      if (subjectFilter !== 'all') params.set('subjectId', subjectFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const res = await fetch(`/api/admin/board-questions?${params}`)
      if (res.ok) {
        const json = await res.json()
        const data: BoardQuestion[] = Array.isArray(json.data) ? json.data : []
        setQuestions(data)
        setTotal(json.pagination?.total || 0)
        setMcqCount(data.filter((d) => d.type === 'mcq').length)
        setCqCount(data.filter((d) => d.type === 'cq').length)
        const uniqueBoards = new Set(data.map((d) => d.board).filter(Boolean))
        setBoardCount(uniqueBoards.size)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [page, search, boardFilter, yearFilter, classFilter, subjectFilter, typeFilter])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const selection = useTableSelection(questions)

  const handleBulkDelete = async (ids: string[]) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/admin/board-questions?ids=${ids.join(',')}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'মুছে ফেলা হয়েছে' }); selection.clearSelection(); fetchQuestions() }
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (form.classId) {
      fetchSubjects(form.classId)
      setForm((f) => ({ ...f, subjectId: '', chapterId: '' }))
    } else {
      setSubjects([])
      setChapters([])
    }
  }, [form.classId, fetchSubjects])

  useEffect(() => {
    if (form.subjectId) {
      fetchChapters(form.subjectId)
      setForm((f) => ({ ...f, chapterId: '' }))
    } else {
      setChapters([])
    }
  }, [form.subjectId, fetchChapters])

  const getClassSlug = (classId: string): string => {
    const cls = classes.find((c) => c.id === classId)
    return cls?.slug || classId
  }

  const openCreate = () => {
    setEditId(null)
    setEditType(null)
    setForm(emptyForm)
    setSubjects([])
    setChapters([])
    setStep(1)
    setViewMode('editor')
  }

  const openEdit = async (q: BoardQuestion) => {
    setEditId(q.id)
    setEditType(q.type)
    setStep(1)
    setViewMode('editor')

    // Fetch full question details for content fields
    try {
      const res = await fetch(`/api/admin/board-questions?id=${q.id}`)
      if (res.ok) {
        const json = await res.json()
        const full = json.data || json
        // Auto-resolve yearId from existing year
        const matchedYear = yearOptions.find((y) => y.label === q.year)
        setForm({
          type: q.type,
          board: q.board || '',
          year: q.year || '',
          yearId: full.yearId || matchedYear?.value || '',
          topic: full.topic || '',
          classId: q.classLevel,
          subjectId: q.subjectId,
          chapterId: q.chapterId,
          difficulty: (full.difficulty || 'medium').toLowerCase(),
          isPremium: full.isPremium ?? false,
          price: full.price ? String(full.price) : '',
          tags: full.tags || '',
          question: q.type === 'mcq' ? (full.question || '') : '',
          questionImage: full.questionImage || '',
          optionA: full.optionA || '',
          optionAImage: full.optionAImage || '',
          optionB: full.optionB || '',
          optionBImage: full.optionBImage || '',
          optionC: full.optionC || '',
          optionCImage: full.optionCImage || '',
          optionD: full.optionD || '',
          optionDImage: full.optionDImage || '',
          correctAnswer: full.correctAnswer || 'A',
          explanation: full.explanation || '',
          explanationImage: full.explanationImage || '',
          uddeepok: q.type === 'cq' ? (full.uddeepok || '') : '',
          uddeepokImage: full.uddeepokImage || '',
          question1: full.question1 || '',
          question1Image: full.question1Image || '',
          question2: full.question2 || '',
          question2Image: full.question2Image || '',
          question3: full.question3 || '',
          question3Image: full.question3Image || '',
          question4: full.question4 || '',
          question4Image: full.question4Image || '',
          answer1: full.answer1 || '',
          answer1Image: full.answer1Image || '',
          answer2: full.answer2 || '',
          answer2Image: full.answer2Image || '',
          answer3: full.answer3 || '',
          answer3Image: full.answer3Image || '',
          answer4: full.answer4 || '',
          answer4Image: full.answer4Image || '',
        })
      }
    } catch {
      // Fallback: populate with what we have from the list
      const matchedYear = yearOptions.find((y) => y.label === q.year)
      setForm({
        type: q.type,
        board: q.board || '',
        year: q.year || '',
        yearId: matchedYear?.value || '',
        topic: q.topic || '',
        classId: q.classLevel,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        difficulty: q.difficulty || 'medium',
        isPremium: q.isPremium,
        price: '',
        tags: '',
        question: q.type === 'mcq' ? q.title : '',
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
        uddeepok: q.type === 'cq' ? q.title : '',
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
      })
    }
    if (q.classLevel) fetchSubjects(q.classLevel)
    if (q.subjectId) fetchChapters(q.subjectId)
  }

  const handleTypeChange = (newType: 'mcq' | 'cq') => {
    setForm((prev) => ({
      ...prev,
      type: newType,
      ...(newType === 'mcq' ? resetMcqFields : resetCqFields),
    }))
  }

  const validateStep1 = (): string | null => {
    if (form.type === 'mcq') {
      if (!form.question.trim()) return 'প্রশ্ন লিখুন'
      if (!form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) {
        return 'সব অপশন (ক, খ, গ, ঘ) পূরণ করুন'
      }
      if (!form.correctAnswer) return 'সঠিক উত্তর নির্বাচন করুন'
    } else {
      if (!form.uddeepok.trim()) return 'উদ্দীপক লিখুন'
      if (!form.question1.trim()) return 'প্রশ্ন ১ লিখুন'
      if (!form.answer1.trim()) return 'উত্তর ১ লিখুন'
    }
    return null
  }

  const validateStep2 = (): string | null => {
    if (!form.board) return 'বোর্ড নির্বাচন করুন (বোর্ড প্রশ্নের জন্য আবশ্যক)'
    if (!form.year) return 'সাল নির্বাচন করুন (বোর্ড প্রশ্নের জন্য আবশ্যক)'
    if (!form.classId) return 'ক্লাস নির্বাচন করুন'
    if (!form.subjectId) return 'বিষয় নির্বাচন করুন'
    if (!form.chapterId) return 'অধ্যায় নির্বাচন করুন'
    return null
  }

  const goNext = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) {
        toast({ title: 'ত্রুটি', description: err, variant: 'destructive' })
        return
      }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) {
        toast({ title: 'ত্রুটি', description: err, variant: 'destructive' })
        return
      }
      setStep(3)
    }
  }

  const goPrev = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const classSlug = getClassSlug(form.classId)
      let body: Record<string, unknown>

      if (form.type === 'mcq') {
        body = {
          type: 'mcq',
          question: form.question,
          questionImage: form.questionImage || undefined,
          optionA: form.optionA,
          optionAImage: form.optionAImage || undefined,
          optionB: form.optionB,
          optionBImage: form.optionBImage || undefined,
          optionC: form.optionC,
          optionCImage: form.optionCImage || undefined,
          optionD: form.optionD,
          optionDImage: form.optionDImage || undefined,
          correctAnswer: form.correctAnswer,
          explanation: form.explanation || undefined,
          explanationImage: form.explanationImage || undefined,
          chapterId: form.chapterId,
          classLevel: classSlug,
          subjectId: form.subjectId,
          board: form.board,
          year: form.year,
          yearId: form.yearId || undefined,
          topic: form.topic || undefined,
          difficulty: form.difficulty,
          isPremium: form.isPremium,
          price: form.isPremium ? parseFloat(form.price) || 0 : 0,
          tags: form.tags || undefined,
        }
      } else {
        body = {
          type: 'cq',
          uddeepok: form.uddeepok,
          uddeepokImage: form.uddeepokImage || undefined,
          question1: form.question1,
          question1Image: form.question1Image || undefined,
          question2: form.question2 || '',
          question2Image: form.question2Image || undefined,
          question3: form.question3 || '',
          question3Image: form.question3Image || undefined,
          question4: form.question4 || '',
          question4Image: form.question4Image || undefined,
          answer1: form.answer1,
          answer1Image: form.answer1Image || undefined,
          answer2: form.answer2 || '',
          answer2Image: form.answer2Image || undefined,
          answer3: form.answer3 || '',
          answer3Image: form.answer3Image || undefined,
          answer4: form.answer4 || '',
          answer4Image: form.answer4Image || undefined,
          chapterId: form.chapterId,
          classLevel: classSlug,
          subjectId: form.subjectId,
          board: form.board,
          year: form.year,
          yearId: form.yearId || undefined,
          topic: form.topic || undefined,
          difficulty: form.difficulty,
          isPremium: form.isPremium,
          price: form.isPremium ? parseFloat(form.price) || 0 : 0,
          tags: form.tags || undefined,
        }
      }

      const res = editId
        ? await fetch('/api/admin/board-questions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editId, type: editType || form.type, ...body }),
          })
        : await fetch('/api/admin/board-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast({
          title: editId ? 'বোর্ড প্রশ্ন আপডেট হয়েছে' : 'বোর্ড প্রশ্ন তৈরি হয়েছে',
          description: 'সফলভাবে সংরক্ষিত হয়েছে',
        })
        setViewMode('list')
        fetchQuestions()
      } else {
        const json = await res.json()
        toast({
          title: 'ত্রুটি',
          description: json.error || 'সংরক্ষণ করতে সমস্যা হয়েছে',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'নেটওয়ার্ক সমস্যা', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteInfo) return
    try {
      const res = await fetch(
        `/api/admin/board-questions?id=${deleteInfo.id}&type=${deleteInfo.type}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast({ title: 'বোর্ড প্রশ্ন মুছে ফেলা হয়েছে' })
        setDeleteInfo(null)
        fetchQuestions()
      } else {
        toast({ title: 'ত্রুটি', description: 'মুছতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'নেটওয়ার্ক সমস্যা', variant: 'destructive' })
    }
  }

  if (loading && questions.length === 0 && viewMode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (viewMode === 'editor') {
    return (
      <BoardQuestionEditor
        step={step}
        setStep={setStep}
        editId={editId}
        form={form}
        setForm={setForm}
        saving={saving}
        classes={classes}
        subjects={subjects}
        chapters={chapters}
        boardOptions={boardOptions}
        yearOptions={yearOptions}
        classLabelMap={classLabelMap}
        boardLabelMap={boardLabelMap}
        setViewMode={setViewMode}
        goNext={goNext}
        goPrev={goPrev}
        handleSave={handleSave}
        handleTypeChange={handleTypeChange}
      />
    )
  }

  const bulkActions: BulkAction[] = [
    { label: 'মুছে ফেলুন', variant: 'destructive', handler: handleBulkDelete, disabled: isProcessing },
  ]

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-emerald-600" />
            বোর্ড প্রশ্ন ব্যবস্থাপনা
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            মোট {total}টি বোর্ড প্রশ্ন
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4" />
            বাল্ক ইম্পোর্ট
          </Button>
          <BulkImportDialog
            open={bulkImportOpen}
            onOpenChange={setBulkImportOpen}
            defaultType="board-mcq"
            onSuccess={fetchQuestions}
          />
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            নতুন বোর্ড প্রশ্ন
          </Button>
        </div>
      </div>

      <BoardQuestionList
        questions={questions}
        total={total}
        page={page}
        perPage={perPage}
        setPage={setPage}
        loading={loading}
        selection={selection}
        bulkActions={bulkActions}
        openEdit={openEdit}
        setDeleteInfo={setDeleteInfo}
        classLabelMap={classLabelMap}
        boardLabelMap={boardLabelMap}
        totalStats={{ total, boardCount, mcqCount, cqCount }}
        filters={
          <FilterBar
            search={search}
            setSearch={setSearch}
            boardFilter={boardFilter}
            setBoardFilter={setBoardFilter}
            yearFilter={yearFilter}
            setYearFilter={setYearFilter}
            classFilter={classFilter}
            setClassFilter={setClassFilter}
            subjectFilter={subjectFilter}
            setSubjectFilter={setSubjectFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            setPage={setPage}
            classes={classes}
            filterSubjects={filterSubjects}
            boardOptions={boardOptions}
          />
        }
      />

      {deleteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">মুছে ফেলার নিশ্চিতকরণ</h3>
              <p className="text-sm text-muted-foreground">
                আপনি কি নিশ্চিত যে এই বোর্ড প্রশ্নটি মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteInfo(null)}>বাতিল</Button>
                <Button variant="destructive" onClick={handleDelete}>মুছে ফেলুন</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
