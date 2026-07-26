'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useKeyboardSafe — Detects mobile keyboard open/close state.
 *
 * Returns the estimated keyboard height and a boolean flag so consumers
 * can adjust layout (padding, scroll position, etc.) without needing an
 * extra DOM wrapper component.
 *
 * Uses `window.visualViewport` API which is the only reliable way to detect
 * keyboard state across iOS Safari and Android Chrome.
 *
 * Usage:
 * ```tsx
 * const { isKeyboardOpen, keyboardHeight } = useKeyboardSafe()
 *
 * return (
 *   <div style={{ paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : 16 }}>
 *     <form>...</form>
 *   </div>
 * )
 * ```
 */

interface KeyboardSafeState {
  isKeyboardOpen: boolean
  keyboardHeight: number
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function useKeyboardSafe(): KeyboardSafeState {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const initialHeightRef = useRef(0)

  // Capture initial viewport height on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initialHeightRef.current = window.innerHeight
    }
  }, [])

  const handleVisualViewportChange = useCallback(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    const initialHeight = initialHeightRef.current
    const isMobile = isMobileDevice()

    // On iOS: window.innerHeight stays constant, visualViewport shrinks.
    // On Android: both shrink, so compare against cached initial height.
    if (isMobile && initialHeight > 0 && vv.height < initialHeight * 0.8) {
      const heightDiff = initialHeight - vv.height
      setIsKeyboardOpen(true)
      setKeyboardHeight(heightDiff)
    } else {
      setIsKeyboardOpen(false)
      setKeyboardHeight(0)
    }
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    vv.addEventListener('resize', handleVisualViewportChange)
    vv.addEventListener('scroll', handleVisualViewportChange)

    return () => {
      vv.removeEventListener('resize', handleVisualViewportChange)
      vv.removeEventListener('scroll', handleVisualViewportChange)
    }
  }, [handleVisualViewportChange])

  return { isKeyboardOpen, keyboardHeight }
}
