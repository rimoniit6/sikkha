'use client'

import { useCallback, useEffect, useRef } from 'react'

const DRAFT_PREFIX = 'edu-cq-draft-'

interface DraftData {
  answers: Record<string, { answerText: string }>
  savedAt: number
  questionCount: number
  answeredCount: number
}

export function useCQDraft(
  setId: string,
  answers: Record<string, { answerText: string }>,
  questionCount: number,
  answeredCount: number
) {
  const key = `${DRAFT_PREFIX}${setId}`
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')

  // Load draft on mount
  const loadDraft = useCallback((): DraftData | null => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as DraftData
    } catch {
      return null
    }
  }, [key])

  // Save draft with debounce
  const saveDraft = useCallback(() => {
    try {
      const serialized = JSON.stringify({ answers, savedAt: Date.now(), questionCount, answeredCount })
      if (serialized === lastSavedRef.current) return
      localStorage.setItem(key, serialized)
      lastSavedRef.current = serialized
    } catch {
      // localStorage full or unavailable
    }
  }, [key, answers, questionCount, answeredCount])

  // Debounced auto-save
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveDraft, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [saveDraft])

  // Save on unmount (visibility change)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Synchronous save — can't use async storage in some browsers
        try {
          const serialized = JSON.stringify({ answers, savedAt: Date.now(), questionCount, answeredCount })
          localStorage.setItem(key, serialized)
          lastSavedRef.current = serialized
        } catch {}
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      // Final save on unmount
      try {
        const serialized = JSON.stringify({ answers, savedAt: Date.now(), questionCount, answeredCount })
        localStorage.setItem(key, serialized)
      } catch {}
    }
  }, [key, answers, questionCount, answeredCount])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key)
      lastSavedRef.current = ''
    } catch {}
  }, [key])

  const getDraftAge = useCallback((): number | null => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const data = JSON.parse(raw) as DraftData
      return Date.now() - data.savedAt
    } catch {
      return null
    }
  }, [key])

  return { loadDraft, clearDraft, getDraftAge, saveDraft }
}
