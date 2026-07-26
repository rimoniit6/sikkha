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
import { useToast } from '@/hooks/use-toast'
import { slugify } from '@/lib/slug'
import SlugField from '@/components/ui/slug-field'
import { motion } from 'framer-motion'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import type { BoardItem, DeleteConfirm } from './types'
import { itemVariants } from './utils'

interface BoardManagerProps {
  boards: BoardItem[]
  setBoards: (updater: (prev: BoardItem[]) => BoardItem[]) => void
  boardsLoading: boolean
  onDeleteConfirm: (confirm: DeleteConfirm) => void
  refreshBoards: () => void
}

export function BoardManager({
  boards,
  setBoards,
  boardsLoading,
  onDeleteConfirm,
  refreshBoards,
}: BoardManagerProps) {
  const { toast } = useToast()
  const [boardDialogOpen, setBoardDialogOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<BoardItem | null>(null)
  const [boardForm, setBoardForm] = useState({
    name: '',
    slug: '',
    isActive: true,
    order: 0,
  })
  const [boardFormOrder, setBoardFormOrder] = useState('0')
  const [saving, setSaving] = useState(false)

  const openBoardCreate = () => {
    setEditingBoard(null)
    setBoardForm({ name: '', slug: '', isActive: true, order: boards.length })
    setBoardFormOrder(String(boards.length))
    setBoardDialogOpen(true)
  }

  const openBoardEdit = (board: BoardItem) => {
    setEditingBoard(board)
    setBoardForm({
      name: board.name,
      slug: board.slug,
      isActive: board.isActive,
      order: board.order,
    })
    setBoardFormOrder(String(board.order))
    setBoardDialogOpen(true)
  }

  const saveBoard = async () => {
    if (!boardForm.name.trim()) {
      toast({ title: 'ত্রুটি', description: 'বোর্ডের নাম আবশ্যক', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const slug = boardForm.slug || slugify(boardForm.name)
      const body = {
        ...(editingBoard ? { id: editingBoard.id } : {}),
        name: boardForm.name,
        slug,
        isActive: boardForm.isActive,
        order: parseInt(boardFormOrder) || 0,
      }

      const res = editingBoard
        ? await fetch('/api/admin/boards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast({ title: editingBoard ? 'বোর্ড আপডেট হয়েছে' : 'বোর্ড তৈরি হয়েছে' })
        setBoardDialogOpen(false)
        refreshBoards()
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

  const reorderBoard = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...boards].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((b) => b.id === id)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = sorted[idx]
    const swap = sorted[swapIdx]

    setBoards((prev) => {
      const updated = [...prev]
      const ci = updated.findIndex((b) => b.id === current.id)
      const si = updated.findIndex((b) => b.id === swap.id)
      if (ci >= 0) updated[ci] = { ...updated[ci], order: swap.order }
      if (si >= 0) updated[si] = { ...updated[si], order: current.order }
      return updated.sort((a, b) => a.order - b.order)
    })

    try {
      await fetch('/api/admin/boards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id, order: swap.order }),
      })
      await fetch('/api/admin/boards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, order: current.order }),
      })
    } catch {
      toast({ title: 'ত্রুটি', description: 'বোর্ডের ক্রম পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' })
      refreshBoards()
    }
  }

  return (
    <>
      {/* Board Management - Horizontal Card Grid */}
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 px-5 py-3.5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-600" />
              <Label className="text-sm font-semibold">বোর্ড</Label>
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {boards.length}
              </Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openBoardCreate}>
              <Plus className="h-3 w-3" /> যোগ করুন
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {boardsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">কোনো বোর্ড নেই</p>
              <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" onClick={openBoardCreate}>
                <Plus className="h-3 w-3" /> বোর্ড যোগ করুন
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {boards
                .sort((a, b) => a.order - b.order)
                .map((board, idx) => (
                  <motion.div
                    key={board.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="group relative rounded-lg border border-border/50 p-3 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-medium text-sm truncate">{board.name}</span>
                      {!board.isActive && (
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-muted text-muted-foreground ml-auto shrink-0">
                          নিষ্ক্রিয়
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mb-2">{board.slug}</p>
                    {/* Actions - show on hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); reorderBoard(board.id, 'up') }}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); reorderBoard(board.id, 'down') }}
                        disabled={idx === boards.length - 1}
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); openBoardEdit(board) }}
                      >
                        <Edit className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDeleteConfirm({ type: 'board', id: board.id, name: board.name }) }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Board Dialog ═══════════ */}
      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              {editingBoard ? 'বোর্ড সম্পাদনা' : 'নতুন বোর্ড যোগ করুন'}
            </DialogTitle>
            <DialogDescription>
              {editingBoard ? 'বোর্ডের তথ্য আপডেট করুন' : 'নতুন বোর্ডের তথ্য দিন'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium">নাম <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="বোর্ডের নাম লিখুন"
                  value={boardForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setBoardForm((f) => ({
                      ...f,
                      name,
                      slug: f.slug === slugify(f.name) ? slugify(name) : f.slug,
                    }))
                  }}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <SlugField
                  value={boardForm.slug}
                  onChange={(v) => setBoardForm((f) => ({ ...f, slug: v }))}
                  sourceText={boardForm.name}
                  previewPrefix="boards"
                  showLabel={false}
                />
                <p className="text-xs text-muted-foreground">খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ক্রম</Label>
                <Input
                  type="number"
                  min={0}
                  value={boardFormOrder}
                  onChange={(e) => setBoardFormOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">সক্রিয়</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={boardForm.isActive}
                    onCheckedChange={(v) => setBoardForm((f) => ({ ...f, isActive: v }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {boardForm.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoardDialogOpen(false)} disabled={saving}>
              বাতিল
            </Button>
            <Button onClick={saveBoard} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              {editingBoard ? 'আপডেট করুন' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
