'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'

const SESSION_KEY = 'notifications-generated-session'

/**
 * Triggers intelligent notification generation based on context.
 *
 * - `useGenerateNotifications()` — triggers once per browser session on dashboard load
 * - `useGenerateNotifications('login')` — triggers on login
 * - `refreshNotifications()` — manually trigger regeneration (e.g., after revision/exam complete)
 *
 * Reuses the existing API client. Fire-and-forget — never blocks the UI.
 */
export function useGenerateNotifications(
  context?: 'dashboard-load' | 'login',
): { refreshNotifications: () => void } {
  const user = useAuthUser()
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (!user?.id || hasTriggered.current) return

    // For dashboard-load, check session storage to avoid regenerating on tab switch
    if (context === 'dashboard-load' || !context) {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return
      } catch {
        // sessionStorage might not be available
      }
    }

    hasTriggered.current = true

    // Fire-and-forget: generate notifications in the background
    const effectiveContext = context || 'dashboard-load'
    api.post('user/notifications/process', { context: effectiveContext })
      .then(() => {
        try {
          if (effectiveContext === 'dashboard-load') {
            sessionStorage.setItem(SESSION_KEY, 'true')
          }
        } catch { /* ignore */ }
      })
      .catch(() => {
        // Silent failure — notification generation is best-effort
      })
  }, [user?.id, context])

  /**
   * Manually trigger regeneration for specific contexts (e.g., revision-complete, exam-complete).
   * Fires even if session generation has already happened.
   */
  const refreshNotifications = useCallback((eventContext?: string) => {
    if (!user?.id) return

    const ctx = eventContext || 'daily-check'

    api.post('user/notifications/process', { context: ctx })
      .catch(() => {
        // Silent failure
      })
  }, [user?.id])

  return { refreshNotifications }
}
