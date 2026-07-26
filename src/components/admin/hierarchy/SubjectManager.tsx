'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/slug'
import SlugField from '@/components/ui/slug-field'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  GripVertical,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import type { DeleteConfirm, SubjectItem } from './types'
import { itemVariants } from './utils'

interface SubjectManagerProps {
  subjects: SubjectItem[]
  setSubjects: (updater: (prev: SubjectItem[]) => SubjectItem[]) => void
  subjectsLoading: boolean
  selectedClassId: string | null
  selectedSubjectId: string | null
  onSelectSubject: (id: string) => void
  onDeleteConfirm: (confirm: DeleteConfirm) => void
  refreshSubjects: (classId: string) => void
  selectedClassName?: string
}

export function SubjectManager({
  subjects,
  setSubjects,
  subjectsLoading,
  selectedClassId,
  selectedSubjectId,
  onSelectSubject,
  onDeleteConfirm,
  refreshSubjects,
  selectedClassName,
}: SubjectManagerProps) {
  const { toast } = useToast()
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null)
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    slug: '',
    icon: '',
    color: '',
    description: '',
    order: 0,
    isActive: true,
  })
  const [subjectFormOrder, setSubjectFormOrder] = useState('0')
  const [saving, setSaving] = useState(false)

  const openSubjectCreate = () => {
    if (!selectedClassId) {
      toast({ title: 'ত্রুটি', description: 'প্রথমে একটি শ্রেণি নির্বাচন করুন', variant: 'destructive' })
      return
    }
    setEditingSubject(null)
    setSubjectForm({ name: '', slug: '', icon: '', color: '', description: '', order: subjects.length, isActive: true })
    setSubjectFormOrder(String(subjects.length))
    setSubjectDialogOpen(true)
  }

  const openSubjectEdit = (subj: SubjectItem) => {
    setEditingSubject(subj)
    setSubjectForm({
      name: subj.name,
      slug: subj.slug,
      icon: subj.icon || '',
      color: subj.color || '',
      description: subj.description || '',
      order: subj.order,
      isActive: subj.isActive,
    })
    setSubjectFormOrder(String(subj.order))
    setSubjectDialogOpen(true)
  }

  const saveSubject = async () => {
    if (!subjectForm.name.trim()) {
      toast({ title: 'ত্রুটি', description: 'বিষয়ের নাম আবশ্যক', variant: 'destructive' })
      return
    }
    if (!selectedClassId) {
      toast({ title: 'ত্রুটি', description: 'শ্রেণি নির্বাচন করুন', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const slug = subjectForm.slug || slugify(subjectForm.name)
      const body = {
        ...(editingSubject ? { id: editingSubject.id } : {}),
        name: subjectForm.name,
        slug,
        classId: selectedClassId,
        icon: subjectForm.icon || null,
        color: subjectForm.color || null,
        description: subjectForm.description || null,
        order: parseInt(subjectFormOrder) || 0,
        isActive: subjectForm.isActive,
      }

      const res = editingSubject
        ? await fetch('/api/admin/subjects', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast({ title: editingSubject ? 'বিষয় আপডেট হয়েছে' : 'বিষয় তৈরি হয়েছে' })
        setSubjectDialogOpen(false)
        if (selectedClassId) refreshSubjects(selectedClassId)
      } else {
        const json = await res.json()
        toast({ title: 'ত্রুটি', description: json.error || 'সংরক্ষণ করতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'নেটওয়ার্ক সমস্যা', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const reorderSubject = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...subjects].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((s) => s.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = sorted[idx]
    const swap = sorted[swapIdx]

    setSubjects((prev) => {
      const updated = [...prev]
      const ci = updated.findIndex((s) => s.id === current.id)
      const si = updated.findIndex((s) => s.id === swap.id)
      if (ci >= 0) updated[ci] = { ...updated[ci], order: swap.order }
      if (si >= 0) updated[si] = { ...updated[si], order: current.order }
      return updated.sort((a, b) => a.order - b.order)
    })

    try {
      await fetch('/api/admin/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id, order: swap.order }),
      })
      await fetch('/api/admin/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, order: current.order }),
      })
    } catch {
      toast({ title: 'ত্রুটি', description: 'বিষয়ের ক্রম পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' })
      if (selectedClassId) refreshSubjects(selectedClassId)
    }
  }

  return (
    <>
      {/* ═══════════ Subjects Column ═══════════ */}
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-50/80 to-cyan-50/80 dark:from-teal-950/30 dark:to-cyan-950/30 px-5 py-3.5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-teal-600" />
              <Label className="text-sm font-semibold">বিষয়</Label>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {subjects.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={openSubjectCreate}
              disabled={!selectedClassId}
            >
              <Plus className="h-3 w-3" /> যোগ করুন
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">একটি শ্রেণি নির্বাচন করুন</p>
            </div>
          ) : subjectsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">কোনো বিষয় নেই</p>
              <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" onClick={openSubjectCreate}>
                <Plus className="h-3 w-3" /> বিষয় যোগ করুন
              </Button>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
              <AnimatePresence>
                {subjects
                  .sort((a, b) => a.order - b.order)
                  .map((subj, idx) => (
                    <motion.div
                      key={subj.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={cn(
                        'group border-b border-border/30 last:border-b-0 transition-colors cursor-pointer',
                        selectedSubjectId === subj.id
                          ? 'bg-teal-50/80 dark:bg-teal-950/20'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => onSelectSubject(subj.id)}
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />

                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: subj.color || '#14b8a6' }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{subj.name}</span>
                            {!subj.isActive && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-muted text-muted-foreground">
                                নিষ্ক্রিয়
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{subj.slug}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">ক্রম: {subj.order}</span>
                            {subj._count && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-teal-600 dark:text-teal-400">
                                  {subj._count.chapters} অধ্যায়
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderSubject(subj.id, 'up') }}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderSubject(subj.id, 'down') }}
                            disabled={idx === subjects.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); openSubjectEdit(subj) }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteConfirm({ type: 'subject', id: subj.id, name: subj.name }) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {selectedSubjectId === subj.id && (
                          <div className="w-1.5 h-6 rounded-full bg-teal-500 shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Subject Dialog ═══════════ */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-600" />
              {editingSubject ? 'বিষয় সম্পাদনা' : 'নতুন বিষয় যোগ করুন'}
            </DialogTitle>
            <DialogDescription>
              {editingSubject
                ? 'বিষয়ের তথ্য আপডেট করুন'
                : `${selectedClassName || 'শ্রেণি'}-এর জন্য নতুন বিষয় যোগ করুন`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">নাম <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="বিষয়ের নাম লিখুন"
                  value={subjectForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setSubjectForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug === slugify(f.name) ? slugify(name) : f.slug,
                    }))
                  }}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <SlugField
                  value={subjectForm.slug}
                  onChange={(v) => setSubjectForm((f) => ({ ...f, slug: v }))}
                  sourceText={subjectForm.name}
                  previewPrefix="subjects"
                  showLabel={false}
                />
                <p className="text-xs text-muted-foreground">খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">আইকন</Label>
                <Input
                  placeholder="আইকনের নাম (ঐচ্ছিক)"
                  value={subjectForm.icon}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">রঙ</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="#14b8a6"
                    value={subjectForm.color}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, color: e.target.value }))}
                    className="flex-1"
                  />
                  {subjectForm.color && (
                    <div
                      className="w-9 h-9 rounded-md border shrink-0"
                      style={{ backgroundColor: subjectForm.color }}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">বিবরণ</Label>
                <Textarea
                  placeholder="বিষয়ের বিবরণ (ঐচ্ছিক)"
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ক্রম</Label>
                <Input
                  type="number"
                  min={0}
                  value={subjectFormOrder}
                  onChange={(e) => setSubjectFormOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">সক্রিয়</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={subjectForm.isActive}
                    onCheckedChange={(v) => setSubjectForm((f) => ({ ...f, isActive: v }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {subjectForm.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialogOpen(false)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={saveSubject} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              {editingSubject ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
