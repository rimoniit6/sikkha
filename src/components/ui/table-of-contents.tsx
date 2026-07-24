'use client'

/**
 * TableOfContents — Auto-generated navigation from blog post headings.
 *
 * - Parses raw HTML for h2/h3 tags and extracts text + generates IDs
 * - Sticky sidebar on desktop (lg+), collapsible at top on mobile
 * - Tracks active heading via IntersectionObserver
 * - Smooth scroll to heading on click
 * - Shows heading hierarchy with indentation (h2 → h3)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TocItem {
  id: string
  text: string
  level: number // 2 or 3
}

/**
 * Parse HTML string to extract h2/h3 heading data.
 * Generates URL-safe IDs from heading text.
 */
function parseHeadings(html: string): TocItem[] {
  if (!html) return []

  const items: TocItem[] = []
  const headingRegex = /<h([23])(?:\s[^>]*)?>(.*?)<\/h[23]>/gi
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10) as 2 | 3
    const rawText = match[2]
    // Strip any inner HTML tags (e.g., <strong>, <em>, <code>)
    const text = rawText.replace(/<[^>]*>/g, '').trim()
    if (!text) continue

    const id = text
      .toLowerCase()
      .replace(/[^\w\u0980-\u09FF\s-]/g, '') // Keep Bengali + alphanumeric + spaces + hyphens
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'heading'

    // Avoid duplicate IDs
    const existing = items.filter((i) => i.id === id).length
    const uniqueId = existing > 0 ? `${id}-${existing + 1}` : id

    items.push({ id: uniqueId, text, level })
  }

  return items
}

interface TableOfContentsProps {
  content?: string // Raw HTML content to parse headings from
  headings?: TocItem[] // Pre-extracted headings (e.g. from content blocks)
}

export default function TableOfContents({ content, headings: externalHeadings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const parsedHeadings = useMemo(() => content ? parseHeadings(content) : [], [content])
  const headings = externalHeadings ?? parsedHeadings

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    // Observe each heading element
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[]

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [headings])

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setIsOpen(false)
    }
  }, [])

  if (headings.length < 2) return null // Don't show for single-section posts

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-6 right-6 z-40 lg:hidden rounded-full shadow-lg gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
        {isOpen ? 'বন্ধ' : 'সূচিপত্র'}
      </Button>

      {/* Mobile overlay panel */}
      {isOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-20 right-4 w-72 max-h-[60vh] overflow-y-auto rounded-xl border border-border/60 bg-card p-4 shadow-xl animate-scale-in">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">সূচিপত্র</h4>
            <TocList
              headings={headings}
              activeId={activeId}
              onItemClick={handleClick}
            />
          </div>
        </div>
      )}

      {/* Desktop sticky sidebar */}
      <aside className="hidden lg:block sticky top-24 w-56 shrink-0">
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin pl-4 border-l-2 border-border/40">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            সূচিপত্র
          </h4>
          <nav className="space-y-1">
            {headings.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => handleClick(h.id)}
                className={cn(
                  'block w-full text-left text-sm py-1 transition-colors rounded',
                  h.level === 3 ? 'pl-4 text-[13px]' : '',
                  activeId === h.id
                    ? 'text-emerald-600 font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {h.text}
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}

/** Shared list rendering for mobile + desktop */
function TocList({
  headings,
  activeId,
  onItemClick,
}: {
  headings: TocItem[]
  activeId: string
  onItemClick: (id: string) => void
}) {
  return (
    <nav className="space-y-1">
      {headings.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onItemClick(h.id)}
          className={cn(
            'block w-full text-left text-sm py-1.5 transition-colors rounded',
            h.level === 3 ? 'pl-5 text-xs' : '',
            activeId === h.id
              ? 'text-emerald-600 font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {h.text}
        </button>
      ))}
    </nav>
  )
}
