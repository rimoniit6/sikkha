'use client'

import { useCallback, useEffect, useState } from 'react'

export interface LocalNote {
  id: string
  lectureId: string
  content: string
  createdAt: string
  updatedAt: string
}

const STORAGE_PREFIX = 'edu-local-notes-'
const NOTES_INDEX_KEY = 'edu-local-notes-index'

export function useLocalNotes(lectureId: string | null) {
  const [notes, setNotes] = useState<LocalNote[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load notes for this lecture
  useEffect(() => {
    if (!lectureId) return
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
      if (stored) {
        setNotes(JSON.parse(stored))
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [lectureId])

  // Persist notes
  const persistNotes = useCallback((updatedNotes: LocalNote[]) => {
    if (!lectureId) return
    try {
      localStorage.setItem(STORAGE_PREFIX + lectureId, JSON.stringify(updatedNotes))
      // Update index
      const idx = JSON.parse(localStorage.getItem(NOTES_INDEX_KEY) || '{}')
      if (updatedNotes.length > 0) {
        idx[lectureId] = { count: updatedNotes.length, updatedAt: new Date().toISOString() }
      } else {
        delete idx[lectureId]
      }
      localStorage.setItem(NOTES_INDEX_KEY, JSON.stringify(idx))
    } catch { /* ignore */ }
    setNotes(updatedNotes)
  }, [lectureId])

  const addNote = useCallback((content: string) => {
    if (!content.trim() || !lectureId) return
    const now = new Date().toISOString()
    const newNote: LocalNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lectureId,
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
    }
    persistNotes([...notes, newNote])
  }, [lectureId, notes, persistNotes])

  const updateNote = useCallback((id: string, content: string) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, content: content.trim(), updatedAt: new Date().toISOString() } : n
    )
    persistNotes(updated)
  }, [notes, persistNotes])

  const deleteNote = useCallback((id: string) => {
    persistNotes(notes.filter((n) => n.id !== id))
  }, [notes, persistNotes])

  return { notes, loaded, addNote, updateNote, deleteNote }
}
