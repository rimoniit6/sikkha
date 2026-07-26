'use client'

import { useState } from 'react'
import { StickyNote, Plus, Trash2, Edit3, X, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { LocalNote } from '@/hooks/use-local-notes'

interface LocalNoteDrawerProps {
  notes: LocalNote[]
  loaded: boolean
  onAdd: (content: string) => void
  onUpdate: (id: string, content: string) => void
  onDelete: (id: string) => void
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'এইমাত্র'
    if (mins < 60) return `${mins} মি. আগে`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ঘ. আগে`
    return `${Math.floor(hours / 24)} দিন আগে`
  } catch {
    return ''
  }
}

export default function LocalNoteDrawer({ notes, loaded, onAdd, onUpdate, onDelete }: LocalNoteDrawerProps) {
  const [open, setOpen] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleAdd = () => {
    onAdd(newNote)
    setNewNote('')
  }

  const startEdit = (note: LocalNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      onUpdate(editingId, editContent)
      setEditingId(null)
      setEditContent('')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground relative" aria-label="নোটস">
          <StickyNote className="size-4" />
          {notes.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
              {notes.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <StickyNote className="size-4" />
            আমার নোটস
          </SheetTitle>
        </SheetHeader>

        {/* Add note */}
        <div className="mb-5">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="আপনার নোট লিখুন..."
            rows={3}
            className="w-full text-sm bg-muted/50 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            className="w-full mt-2 gap-1.5"
            disabled={!newNote.trim()}
            onClick={handleAdd}
          >
            <Plus className="size-3.5" />
            নোট যোগ করুন
          </Button>
        </div>

        {/* Notes list */}
        {!loaded ? (
          <div className="py-8 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
        ) : notes.length === 0 ? (
          <div className="py-8 text-center">
            <StickyNote className="size-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">কোনো নোট নেই</p>
            <p className="text-xs text-muted-foreground/60 mt-1">উপরে নোট লিখুন</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-border/50 bg-card p-3"
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full text-sm bg-muted/30 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                        <X className="size-3 mr-1" />
                        বাতিল
                      </Button>
                      <Button size="sm" className="h-7 text-xs gap-1" disabled={!editContent.trim()} onClick={saveEdit}>
                        <Check className="size-3" />
                        সেভ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatRelativeTime(note.updatedAt)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => startEdit(note)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="এডিট"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(note.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 transition-colors"
                          aria-label="মুছুন"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
