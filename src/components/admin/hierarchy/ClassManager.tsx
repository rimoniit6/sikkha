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
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import type { ClassItem, DeleteConfirm } from './types'
import { itemVariants } from './utils'

interface ClassManagerProps {
  classes: ClassItem[]
  setClasses: (updater: (prev: ClassItem[]) => ClassItem[]) => void
  classesLoading: boolean
  selectedClassId: string | null
  onSelectClass: (id: string) => void
  onDeleteConfirm: (confirm: DeleteConfirm) => void
  refreshClasses: () => void
}

export function ClassManager({
  classes,
  setClasses,
  classesLoading,
  selectedClassId,
  onSelectClass,
  onDeleteConfirm,
  refreshClasses,
}: ClassManagerProps) {
  const { toast } = useToast()
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [classForm, setClassForm] = useState({
    name: '',
    slug: '',
    icon: '',
    color: '',
    description: '',
    order: 0,
    isActive: true,
  })
  const [classFormOrder, setClassFormOrder] = useState('0')
  const [saving, setSaving] = useState(false)

  const openClassCreate = () => {
    setEditingClass(null)
    setClassForm({ name: '', slug: '', icon: '', color: '', description: '', order: classes.length, isActive: true })
    setClassFormOrder(String(classes.length))
    setClassDialogOpen(true)
  }

  const openClassEdit = (cls: ClassItem) => {
    setEditingClass(cls)
    setClassForm({
      name: cls.name,
      slug: cls.slug,
      icon: cls.icon || '',
      color: cls.color || '',
      description: cls.description || '',
      order: cls.order,
      isActive: cls.isActive,
    })
    setClassFormOrder(String(cls.order))
    setClassDialogOpen(true)
  }

  const saveClass = async () => {
    if (!classForm.name.trim()) {
      toast({ title: 'ত্রুটি', description: 'শ্রেণির নাম আবশ্যক', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const slug = classForm.slug || slugify(classForm.name)
      const body = {
        ...(editingClass ? { id: editingClass.id } : {}),
        name: classForm.name,
        slug,
        icon: classForm.icon || null,
        color: classForm.color || null,
        description: classForm.description || null,
        order: parseInt(classFormOrder) || 0,
        isActive: classForm.isActive,
      }

      const res = editingClass
        ? await fetch('/api/admin/classes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast({ title: editingClass ? 'শ্রেণি আপডেট হয়েছে' : 'শ্রেণি তৈরি হয়েছে' })
        setClassDialogOpen(false)
        refreshClasses()
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

  const reorderClass = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...classes].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = sorted[idx]
    const swap = sorted[swapIdx]

    setClasses((prev) => {
      const updated = [...prev]
      const ci = updated.findIndex((c) => c.id === current.id)
      const si = updated.findIndex((c) => c.id === swap.id)
      if (ci >= 0) updated[ci] = { ...updated[ci], order: swap.order }
      if (si >= 0) updated[si] = { ...updated[si], order: current.order }
      return updated.sort((a, b) => a.order - b.order)
    })

    try {
      await fetch('/api/admin/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id, order: swap.order }),
      })
      await fetch('/api/admin/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, order: current.order }),
      })
    } catch {
      toast({ title: 'ত্রুটি', description: 'শ্রেণির ক্রম পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' })
      refreshClasses()
    }
  }

  return (
    <>
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/30 px-5 py-3.5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <Label className="text-sm font-semibold">শ্রেণি</Label>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {classes.length}
              </Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openClassCreate}>
              <Plus className="h-3 w-3" /> যোগ করুন
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {classesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Layers className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">কোনো শ্রেণি নেই</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
              <AnimatePresence>
                {classes
                  .sort((a, b) => a.order - b.order)
                  .map((cls, idx) => (
                    <motion.div
                      key={cls.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      className={cn(
                        'group border-b border-border/30 last:border-b-0 transition-colors cursor-pointer',
                        selectedClassId === cls.id
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => {
                        onSelectClass(cls.id)
                      }}
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />

                        {/* Color dot */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cls.color || '#10b981' }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{cls.name}</span>
                            {!cls.isActive && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-muted text-muted-foreground">
                                নিষ্ক্রিয়
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{cls.slug}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">ক্রম: {cls.order}</span>
                            {cls._count && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                  {cls._count.subjects} বিষয়
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderClass(cls.id, 'up') }}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); reorderClass(cls.id, 'down') }}
                            disabled={idx === classes.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); openClassEdit(cls) }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteConfirm({ type: 'class', id: cls.id, name: cls.name }) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Active indicator */}
                        {selectedClassId === cls.id && (
                          <div className="w-1.5 h-6 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Class Dialog ═══════════ */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              {editingClass ? 'শ্রেণি সম্পাদনা' : 'নতুন শ্রেণি যোগ করুন'}
            </DialogTitle>
            <DialogDescription>
              {editingClass ? 'শ্রেণির তথ্য আপডেট করুন' : 'নতুন শ্রেণির তথ্য দিন'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">নাম <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="শ্রেণির নাম লিখুন"
                  value={classForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setClassForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug === slugify(f.name) ? slugify(name) : f.slug,
                    }))
                  }}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <SlugField
                  value={classForm.slug}
                  onChange={(v) => setClassForm((f) => ({ ...f, slug: v }))}
                  sourceText={classForm.name}
                  previewPrefix="classes"
                  showLabel={false}
                />
                <p className="text-xs text-muted-foreground">খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">আইকন</Label>
                <Input
                  placeholder="আইকনের নাম (ঐচ্ছিক)"
                  value={classForm.icon}
                  onChange={(e) => setClassForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">রঙ</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="#10b981"
                    value={classForm.color}
                    onChange={(e) => setClassForm((f) => ({ ...f, color: e.target.value }))}
                    className="flex-1"
                  />
                  {classForm.color && (
                    <div
                      className="w-9 h-9 rounded-md border shrink-0"
                      style={{ backgroundColor: classForm.color }}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">বিবরণ</Label>
                <Textarea
                  placeholder="শ্রেণির বিবরণ (ঐচ্ছিক)"
                  value={classForm.description}
                  onChange={(e) => setClassForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ক্রম</Label>
                <Input
                  type="number"
                  min={0}
                  value={classFormOrder}
                  onChange={(e) => setClassFormOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">সক্রিয়</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={classForm.isActive}
                    onCheckedChange={(v) => setClassForm((f) => ({ ...f, isActive: v }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {classForm.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassDialogOpen(false)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={saveClass} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              {editingClass ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
