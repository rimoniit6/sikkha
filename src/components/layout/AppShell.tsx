'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Header from './Header'
import Footer from './Footer'
import BottomNav from './BottomNav'
import { FocusModeBar } from '@/components/user/focus/FocusModeBar'
import NoticeBar from '@/components/shared/NoticeBar'
import SpecialNoticePopup from '@/components/home/SpecialNoticePopup'
import ScrollToTop from '@/components/shared/ScrollToTop'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import SyncStatusIndicator from '@/components/pwa/SyncStatusIndicator'
import { isAdminRoute } from '@/store/router'
import { parseUrl } from '@/lib/urls'
import { useFocusMode } from '@/store/focus-mode'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * NetworkStatus — hydration-safe.
 *
 * Server always renders null (isOnline=true, showReconnecting=false).
 * Client reads navigator.onLine only inside useEffect, never during render.
 * This guarantees identical DOM on server and first client render.
 */
function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showReconnecting, setShowReconnecting] = useState(false)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    // Read actual browser state only after hydration
    // Using requestAnimationFrame to avoid synchronous setState in effect
    const raf = requestAnimationFrame(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true
        setIsOnline(navigator.onLine)
      }
    })

    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnecting(true)
      const timer = setTimeout(() => setShowReconnecting(false), 3000)
      return () => clearTimeout(timer)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnecting(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Server and first client render: isOnline=true, showReconnecting=false → returns null
  // Only after useEffect fires does the real state take effect
  if (isOnline && !showReconnecting) return null

  // Show reconnection success
  if (isOnline && showReconnecting) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[200] bg-emerald-500 text-white transition-all duration-300 translate-y-0"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 text-center text-sm font-medium">
          ✅ সংযোগ পুনরুদ্ধার হয়েছে
        </div>
      </div>
    )
  }

  // Show offline banner
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white transition-all duration-300 translate-y-0"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 text-center text-sm font-medium">
        📡 আপনি অফলাইনে আছেন — কিছু ফিচার সীমিত থাকতে পারে
      </div>
    </div>
  )
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const parsed = parseUrl(pathname, searchParams ?? undefined)
  const isAdmin = parsed ? isAdminRoute(parsed.route) : false
  const { active: focusActive } = useFocusMode()

  return (
    <div className={`min-h-screen flex flex-col bg-background text-foreground ${focusActive ? 'focus-mode' : ''}`}>
      <NetworkStatus />
      <div className={isAdmin ? 'h-screen' : 'min-h-screen flex flex-col'}>
        {!isAdmin && !focusActive && <Header />}
        {!isAdmin && !focusActive && <NoticeBar />}

        <main
          key={pathname}
          className={`${
            isAdmin
              ? 'h-full'
              : focusActive
                ? 'flex-1 motion-safe:animate-fade-in'
                : 'flex-1 pt-14 sm:pt-16 pb-24 md:pb-8 safe-bottom motion-safe:animate-fade-in'
          }`}
        >
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
                </div>
              </div>
            }>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>

        {focusActive && <FocusModeBar />}
        {!isAdmin && !focusActive && <SyncStatusIndicator />}
        {!isAdmin && !focusActive && <Footer />}
        {!isAdmin && !focusActive && <BottomNav />}
        {!isAdmin && !focusActive && <SpecialNoticePopup />}
        <ScrollToTop />
      </div>
    </div>
  )
}
