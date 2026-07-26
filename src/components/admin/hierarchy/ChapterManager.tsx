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
import { slugify } from '@/lib/slug'
import SlugField from '@/components/ui/slug-field'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookMarked,
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
import type { ChapterCountItem, ChapterItem, DeleteConfirm } from './types'
import { itemVariants } from './utils'
import { ChapterDetailPanel } from './ChapterDetailPanel'

interface ChapterManagerProps {
  chapters: ChapterItem[]
  setChapters: (updater: (prev: ChapterItem[]) => ChapterItem[]) => void
  chaptersLoading: boolean
  selectedSubjectId: string | null
  chapterCountsMap: Map<string, ChapterCountItem>
  onDeleteConfirm: (confirm: DeleteConfirm) => void
  refreshChapters: (subjectId: string) => void
  selectedSubjectName?: string
}

export function ChapterManager({
  chapters,
  setChapters,
  chaptersLoading,
  selectedSubjectId,
  chapterCountsMap,
  onDeleteConfirm,
  refreshChapters,
  selectedSubjectName,
}: ChapterManagerProps) {
  const { toast } = useToast()
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false)
  const [editingChapter, setEditingChapter] = useState<ChapterItem | null>(null)
  const [chapterForm, setChapterForm] = useState({
    name: '',
    slug: '',
    description: '',
    order: 0,
    isActive: true,
  })
  const [chapterFormOrder, setChapterFormOrder] = useState('0')
  const [saving, setSaving] = useState(false)

  const openChapterCreate = () => {
    if (!selectedSubjectId) {
      toast({ title: 'ত্রুটি', description: 'প্রথমে একটি বিষয় নির্বাচন করুন', variant: 'destructive' })
      return
    }
    setEditingChapter(null)
    setChapterForm({ name: '', slug: '', description: '', order: chapters.length, isActive: true })
    setChapterFormOrder(String(chapters.length))
    setChapterDialogOpen(true)
  }

  const openChapterEdit = (ch: ChapterItem) => {
    setEditingChapter(ch)
    setChapterForm({
      name: ch.name,
      slug: ch.slug,
      description: ch.description || '',
      order: ch.order,
      isActive: ch.isActive,
    })
    setChapterFormOrder(String(ch.order))
    setChapterDialogOpen(true)
  }

  const saveChapter = async () => {
    if (!chapterForm.name.trim()) {
      toast({ title: 'ত্রুটি', description: 'অধ্যায়ের নাম আবশ্যক', variant: 'destructive' })
      return
    }
    if (!selectedSubjectId) {
      toast({ title: 'ত্রুটি', description: 'বিষয় নির্বাচন করুন', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const slug = chapterForm.slug || slugify(chapterForm.name)
      const body = {
        ...(editingChapter ? { id: editingChapter.id } : {}),
        name: chapterForm.name,
        slug,
        subjectId: selectedSubjectId,
        description: chapterForm.description || null,
        order: parseInt(chapterFormOrder) || 0,
        isActive: chapterForm.isActive,
      }

      const res = editingChapter
        ? await fetch('/api/admin/chapters', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast({ title: editingChapter ? 'অধ্যায় আপডেট হয়েছে' : 'অধ্যায় তৈরি হয়েছে' })
        setChapterDialogOpen(false)
        if (selectedSubjectId) refreshChapters(selectedSubjectId)
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

  const reorderChapter = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...chapters].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = sorted[idx]
    const swap = sorted[swapIdx]

    setChapters((prev) => {
      const updated = [...prev]
      const ci = updated.findIndex((c) => c.id === current.id)
      const si = updated.findIndex((c) => c.id === swap.id)
      if (ci >= 0) updated[ci] = { ...updated[ci], order: swap.order }
      if (si >= 0) updated[si] = { ...updated[si], order: current.order }
      return updated.sort((a, b) => a.order - b.order)
    })

    try {
      await fetch('/api/admin/chapters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id, order: swap.order }),
      })
      await fetch('/api/admin/chapters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, order: current.order }),
      })
    } catch {
      toast({ title: 'ত্রুটি', description: 'অধ্যায়ের ক্রম পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' })
      if (selectedSubjectId) refreshChapters(selectedSubjectId)
    }
  }

  return (
    <>
      {/* ═══════════ Chapters Column ═══════════ */}
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-50/80 to-sky-50/80 dark:from-cyan-950/30 dark:to-sky-950/30 px-5 py-3.5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-cyan-600" />
              <Label className="text-sm font-semibold">অধ্যায়</Label>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {chapters.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={openChapterCreate}
              disabled={!selectedSubjectId}
            >
              <Plus className="h-3 w-3" /> যোগ করুন
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {!selectedSubjectId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookMarked className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">একটি বিষয় নির্বাচন করুন</p>
            </div>
          ) : chaptersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : chapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookMarked className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">কোনো অধ্যায় নেই</p>
              <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" onClick={openChapterCreate}>
                <Plus className="h-3 w-3" /> অধ্যায় যোগ করুন
              </Button>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
              <AnimatePresence>
                {chapters
                  .sort((a, b) => a.order - b.order)
                  .map((ch, idx) => (
                    <motion.div
                      key={ch.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className="group border-b border-border/30 last:border-b-0 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{ch.name}</span>
                            {!ch.isActive && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-muted text-muted-foreground">
                                নিষ্ক্রিয়
                              </Badge>
                            )}
                          </div>
                          <ChapterDetailPanel
                            chapter={ch}
                            counts={chapterCountsMap.get(ch.id)}
                            showLegend={idx === 0}
                          />
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderChapter(ch.id, 'up') }}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderChapter(ch.id, 'down') }}
                            disabled={idx === chapters.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); openChapterEdit(ch) }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteConfirm({ type: 'chapter', id: ch.id, name: ch.name }) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Chapter Dialog ═══════════ */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-cyan-600" />
              {editingChapter ? 'অধ্যায় সম্পাদনা' : 'নতুন অধ্যায় যোগ করুন'}
            </DialogTitle>
            <DialogDescription>
              {editingChapter
                ? 'অধ্যায়ের তথ্য আপডেট করুন'
                : `${selectedSubjectName || 'বিষয়'}-এর জন্য নতুন অধ্যায় যোগ করুন`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">নাম <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="অধ্যায়ের নাম লিখুন"
                  value={chapterForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setChapterForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug === slugify(f.name) ? slugify(name) : f.slug,
                    }))
                  }}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <SlugField
                  value={chapterForm.slug}
                  onChange={(v) => setChapterForm((f) => ({ ...f, slug: v }))}
                  sourceText={chapterForm.name}
                  previewPrefix="chapters"
                  showLabel={false}
                />
                <p className="text-xs text-muted-foreground">খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">বিবরণ</Label>
                <Textarea
                  placeholder="অধ্যায়ের বিবরণ (ঐচ্ছিক)"
                  value={chapterForm.description}
                  onChange={(e) => setChapterForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ক্রম</Label>
                <Input
                  type="number"
                  min={0}
                  value={chapterFormOrder}
                  onChange={(e) => setChapterFormOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">সক্রিয়</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={chapterForm.isActive}
                    onCheckedChange={(v) => setChapterForm((f) => ({ ...f, isActive: v }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {chapterForm.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={saveChapter} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              {editingChapter ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
