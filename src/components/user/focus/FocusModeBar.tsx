'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { Clock, X } from 'lucide-react'
import { useFocusMode } from '@/store/focus-mode'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function FocusModeBarComponent() {
  const { startedAt, exitFocusMode } = useFocusMode()
  const [elapsed, setElapsed] = useState(0)
  const [currentTime, setCurrentTime] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Update time display
    const update = () => {
      if (startedAt) {
        setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
      }
      setCurrentTime(
        new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
      )
    }

    // Immediate first tick
    update()
    timerRef.current = setInterval(update, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startedAt])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 motion-safe:animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label="ফোকাস মোড সক্রিয়"
    >
      <div className="mx-3 mb-3 pb-safe">
        <div className="glass rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Timer */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30">
                <Clock className="size-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">ফোকাস টাইমার</p>
                <p className="text-lg font-bold tabular-nums text-foreground tracking-tight">
                  {formatDuration(elapsed)}
                </p>
              </div>
            </div>

            {/* Center: Current time */}
            <div className="hidden sm:block text-center">
              <p className="text-[10px] text-muted-foreground">বর্তমান সময়</p>
              <p className="text-sm font-semibold text-muted-foreground tabular-nums">{currentTime}</p>
            </div>

            {/* Right: Exit button */}
            <button
              onClick={exitFocusMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30 transition-colors min-h-[44px] font-medium text-xs"
              aria-label="ফোকাস মোড থেকে প্রস্থান করুন"
            >
              <X className="size-4" />
              <span className="hidden sm:inline">প্রস্থান</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const FocusModeBar = memo(FocusModeBarComponent)
