'use client'

import { useCallback, useEffect, useState } from 'react'

export type FontSize = 'sm' | 'base' | 'lg' | 'xl'
export type LineHeight = 'normal' | 'relaxed' | 'loose'
export type ReadingWidth = 'comfort' | 'wide'
export type ReadingTheme = 'light' | 'sepia' | 'dark'

export interface ReadingSettings {
  fontSize: FontSize
  lineHeight: LineHeight
  readingWidth: ReadingWidth
  readingTheme: ReadingTheme
}

const STORAGE_KEY = 'edu-reading-settings'

const defaults: ReadingSettings = {
  fontSize: 'base',
  lineHeight: 'relaxed',
  readingWidth: 'comfort',
  readingTheme: 'light',
}

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

const LINE_HEIGHT_MAP: Record<LineHeight, string> = {
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
}

const READING_WIDTH_MAP: Record<ReadingWidth, string> = {
  comfort: 'max-w-prose',
  wide: 'max-w-4xl',
}

export function useReadingSettings() {
  const [settings, setSettings] = useState<ReadingSettings>(defaults)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSettings({ ...defaults, ...parsed })
      }
    } catch { /* ignore */ }
    setMounted(true)
  }, [])

  // Persist to localStorage
  const updateSettings = useCallback((partial: Partial<ReadingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // Apply theme class to document
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('reading-theme-light', 'reading-theme-sepia', 'reading-theme-dark')

    // Add current theme class
    if (settings.readingTheme !== 'light') {
      root.classList.add(`reading-theme-${settings.readingTheme}`)
    }

    return () => {
      root.classList.remove('reading-theme-light', 'reading-theme-sepia', 'reading-theme-dark')
    }
  }, [settings.readingTheme, mounted])

  const fontSizeClass = FONT_SIZE_MAP[settings.fontSize]
  const lineHeightClass = LINE_HEIGHT_MAP[settings.lineHeight]
  const readingWidthClass = READING_WIDTH_MAP[settings.readingWidth]

  // Apply font size to lecture-content via data attribute (CSS handles the rest)
  const contentClassName = `lecture-content ${fontSizeClass} ${lineHeightClass}`

  return {
    settings,
    updateSettings,
    mounted,
    fontSizeClass,
    lineHeightClass,
    readingWidthClass,
    contentClassName,
  }
}
