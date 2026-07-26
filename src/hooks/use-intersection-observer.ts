'use client'

import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
  /** Root margin for IntersectionObserver (default '0px') */
  rootMargin?: string
  /** Threshold (default 0) */
  threshold?: number
  /** Only trigger once, then disconnect (default true) */
  triggerOnce?: boolean
}

interface UseIntersectionObserverReturn {
  /** Ref to attach to the observed element */
  ref: React.RefObject<HTMLElement | null>
  /** Whether the element is intersecting */
  isIntersecting: boolean
  /** Full IntersectionObserverEntry (null before first observation) */
  entry: IntersectionObserverEntry | null
}

/**
 * Lightweight IntersectionObserver hook.
 *
 * Use to lazy-load heavy sections below the fold:
 *
 *   const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: '100px' })
 *   return <div ref={ref}>{isIntersecting ? <HeavyComponent /> : <Skeleton className="h-48" />}</div>
 *
 * Respects prefers-reduced-motion — always returns isIntersecting=true when reduced motion is preferred
 * (avoids blank placeholders for users who prefer less motion).
 */
export function useIntersectionObserver({
  rootMargin = '0px',
  threshold = 0,
  triggerOnce = true,
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverReturn {
  const ref = useRef<HTMLElement | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Always visible when reduced motion is preferred (UX-friendly)
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true)
          setEntry(entry)
          if (triggerOnce) observer.disconnect()
        } else if (!triggerOnce) {
          setIsIntersecting(false)
          setEntry(null)
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, threshold, triggerOnce])

  return { ref, isIntersecting, entry }
}
