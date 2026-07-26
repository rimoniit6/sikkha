'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, X, ChevronRight, Pin } from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { useNotices } from '@/hooks/use-home-data'

export default function NoticeBar() {
  const { data: notices = [] } = useNotices(10)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useRouterStore((s) => s.navigate)

  // Auto-rotate notices every 5 seconds
  useEffect(() => {
    if (notices.length <= 1 || dismissed) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notices.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [notices.length, dismissed])

  const handleDismiss = () => {
    setDismissed(true)
  }

  const handleClick = () => {
    if (notices[currentIndex]) {
      navigate('notice-detail', { noticeId: notices[currentIndex].id })
    }
  }

  const handleViewAll = () => {
    navigate('notices')
  }

  if (dismissed || notices.length === 0) return null

  const currentNotice = notices[currentIndex]
  if (!currentNotice) return null

  return (
    <div className="relative z-40">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-800 dark:via-teal-800 dark:to-cyan-800 overflow-hidden notice-reveal"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-9 gap-3">
            {/* Icon */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="animate-notice-pulse">
                <Megaphone className="h-4 w-4 text-white/90" />
              </div>
              {currentNotice.isPinned && (
                <Pin className="h-3 w-3 text-amber-300" />
              )}
            </div>

            {/* Rotating text */}
            <button
              onClick={handleClick}
              className="flex-1 min-w-0 text-left cursor-pointer group"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentNotice.id}
                  initial={false}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-sm text-white/95 font-medium truncate">
                    {currentNotice.title}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/60 shrink-0 group-hover:text-white/90 transition-colors" />
                </motion.div>
              </AnimatePresence>
            </button>

            {/* Pagination dots */}
            {notices.length > 1 && (
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {notices.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? 'bg-white w-3'
                        : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* View All */}
            <button
              onClick={handleViewAll}
              className="hidden sm:block text-[11px] text-white/70 hover:text-white font-medium shrink-0 transition-colors whitespace-nowrap"
            >
              সব দেখুন
            </button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-white/60 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
