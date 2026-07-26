'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseVirtualListOptions<T> {
  /** Full data array */
  items: T[]
  /** Estimated height of each item in px (default 80) */
  itemHeight?: number
  /** Number of extra items to render above/below the visible window (default 5) */
  overscan?: number
  /** Container height in px. If not provided, uses the container's clientHeight */
  containerHeight?: number
}

interface UseVirtualListReturn<T> {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Sliced items to render */
  visibleItems: T[]
  /** Index of the first visible item in the full list */
  startIndex: number
  /** Index of the last visible item in the full list */
  endIndex: number
  /** Total height of the inner spacer (px) — set this on the inner wrapper */
  totalHeight: number
  /** Scroll offset to apply to the first visible item (px) — set as translateY on the first visible item's container */
  offsetY: number
  /** Scroll to a specific item index */
  scrollToIndex: (index: number) => void
}

/**
 * Lightweight virtual list hook — no external dependencies.
 *
 * Renders only items within the visible viewport + overscan buffer.
 *
 * Usage:
 *   const { containerRef, visibleItems, totalHeight, offsetY, scrollToIndex } = useVirtualList({
 *     items: allItems,
 *     itemHeight: 120,
 *     overscan: 5,
 *   })
 *
 *   return (
 *     <div ref={containerRef} style={{ height: '600px', overflowY: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         <div style={{ transform: `translateY(${offsetY}px)` }}>
 *           {visibleItems.map(item => <Item key={item.id} item={item} />)}
 *         </div>
 *       </div>
 *     </div>
 *   )
 */
export function useVirtualList<T>({
  items,
  itemHeight = 80,
  overscan = 5,
  containerHeight: externalContainerHeight,
}: UseVirtualListOptions<T>): UseVirtualListReturn<T> {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [measuredHeight, setMeasuredHeight] = useState<number>(externalContainerHeight || 600)
  const rafRef = useRef<number | null>(null)

  // Use provided height or measure from container
  useEffect(() => {
    if (externalContainerHeight) {
      setMeasuredHeight(externalContainerHeight)
      return
    }
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => {
      setMeasuredHeight(container.clientHeight || 600)
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [externalContainerHeight])

  // Calculate visible range
  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const total = items.length * itemHeight
    if (items.length === 0) return { startIndex: 0, endIndex: 0, totalHeight: 0, offsetY: 0 }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(items.length, Math.ceil((scrollTop + measuredHeight) / itemHeight) + overscan)

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: total,
      offsetY: start * itemHeight,
    }
  }, [items.length, itemHeight, scrollTop, measuredHeight, overscan])

  // Memoize visible items to avoid re-slicing on every render
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex])

  // Handle scroll events with requestAnimationFrame throttling
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current
      if (container) {
        setScrollTop(container.scrollTop)
      }
    })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleScroll])

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current
      if (!container) return
      const target = Math.max(0, Math.min(index, items.length - 1)) * itemHeight
      container.scrollTo({ top: target, behavior: 'smooth' })
    },
    [itemHeight, items.length]
  )

  return {
    containerRef,
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    scrollToIndex,
  }
}
