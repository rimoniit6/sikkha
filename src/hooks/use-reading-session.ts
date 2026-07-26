'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface LectureSessionData {
  totalSeconds: number
  lastOpened: string | null
  totalVisits: number
}

const STORAGE_PREFIX = 'edu-lecture-session-'

export function useReadingSession(lectureId: string | null) {
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [lastOpened, setLastOpened] = useState<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveRef = useRef<number>(Date.now())
  const sessionSecondsRef = useRef(0)

  // Load persisted session data on mount / lecture change
  useEffect(() => {
    if (!lectureId) return

    // Load existing data
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
      if (stored) {
        const data: LectureSessionData = JSON.parse(stored)
        setTotalSeconds(data.totalSeconds || 0)
        setLastOpened(data.lastOpened || null)
      }
    } catch { /* ignore */ }

    // Reset session timer
    startTimeRef.current = Date.now()
    sessionSecondsRef.current = 0
    setSessionSeconds(0)

    // Update last opened
    const now = new Date().toISOString()
    setLastOpened(now)
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
      const data: LectureSessionData = stored ? JSON.parse(stored) : { totalSeconds: 0, lastOpened: null, totalVisits: 0 }
      data.lastOpened = now
      data.totalVisits = (data.totalVisits || 0) + 1
      localStorage.setItem(STORAGE_PREFIX + lectureId, JSON.stringify(data))
    } catch { /* ignore */ }

    // Track current session duration using ref to avoid re-render loop
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      sessionSecondsRef.current = elapsed
      setSessionSeconds(elapsed)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Save accumulated time on unmount (since last save)
      if (lectureId) {
        const elapsed = Math.floor((Date.now() - lastSaveRef.current) / 1000)
        if (elapsed > 0) {
          try {
            const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
            const data: LectureSessionData = stored ? JSON.parse(stored) : { totalSeconds: 0, lastOpened: null, totalVisits: 0 }
            data.totalSeconds = (data.totalSeconds || 0) + elapsed
            localStorage.setItem(STORAGE_PREFIX + lectureId, JSON.stringify(data))
          } catch { /* ignore */ }
        }
      }
    }
  }, [lectureId])

  // Save accumulated time periodically (every 30s) — no sessionSeconds dependency
  useEffect(() => {
    if (!lectureId) return

    const saveInterval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - lastSaveRef.current) / 1000)
      if (elapsed > 5) {
        try {
          const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
          const data: LectureSessionData = stored ? JSON.parse(stored) : { totalSeconds: 0, lastOpened: null, totalVisits: 0 }
          data.totalSeconds = (data.totalSeconds || 0) + elapsed
          setTotalSeconds(data.totalSeconds)
          localStorage.setItem(STORAGE_PREFIX + lectureId, JSON.stringify(data))
          lastSaveRef.current = now
        } catch { /* ignore */ }
      }
    }, 30000)

    // Save on visibility change (tab switch / app background)
    const handleVisibility = () => {
      if (document.hidden && lectureId) {
        const now = Date.now()
        const elapsed = Math.floor((now - lastSaveRef.current) / 1000)
        if (elapsed > 0) {
          try {
            const stored = localStorage.getItem(STORAGE_PREFIX + lectureId)
            const data: LectureSessionData = stored ? JSON.parse(stored) : { totalSeconds: 0, lastOpened: null, totalVisits: 0 }
            data.totalSeconds = (data.totalSeconds || 0) + elapsed
            setTotalSeconds(data.totalSeconds)
            localStorage.setItem(STORAGE_PREFIX + lectureId, JSON.stringify(data))
            lastSaveRef.current = now
          } catch { /* ignore */ }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(saveInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [lectureId]) // No sessionSeconds dependency — avoids re-render loop

  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}সে`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) return `${mins}মি ${secs}সে`
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hrs}ঘ ${remainMins}মি`
  }, [])

  const formatDate = useCallback((isoString: string | null): string => {
    if (!isoString) return '—'
    try {
      const diff = Date.now() - new Date(isoString).getTime()
      const hours = Math.floor(diff / 3600000)
      if (hours < 1) return 'এইমাত্র'
      if (hours < 24) return `${hours} ঘণ্টা আগে`
      const days = Math.floor(hours / 24)
      return `${days} দিন আগে`
    } catch {
      return '—'
    }
  }, [])

  return {
    sessionSeconds,
    totalSeconds,
    lastOpened,
    formatTime,
    formatDate,
  }
}
