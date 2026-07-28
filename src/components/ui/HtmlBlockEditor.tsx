'use client'

import React, { useState, useMemo } from 'react'
import { ContentBlock } from './content-block-types'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Eye, Code } from 'lucide-react'

interface HtmlBlockEditorProps {
  block: ContentBlock & { type: 'html' }
  onChange: (b: ContentBlock) => void
}

export function HtmlBlockEditor({ block, onChange }: HtmlBlockEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  // Sanitized HTML for preview — catches XSS attempts
  const sanitizedHtml = useMemo(() => {
    if (!block.content) return ''
    try {
      return sanitizeHtml(block.content)
    } catch {
      return ''
    }
  }, [block.content])

  const handleChange = (content: string) => {
    onChange({ ...block, content })
  }

  const toggleMode = () => {
    setMode(mode === 'edit' ? 'preview' : 'edit')
  }

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-xs font-medium text-purple-600">HTML কাস্টম ব্লক</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              mode === 'edit'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
            )}
          >
            {mode === 'edit' ? (
              <><Eye className="h-3 w-3" /> প্রিভিউ</>
            ) : (
              <><Code className="h-3 w-3" /> সম্পাদনা</>
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground">
            HTML + ইনলাইন CSS লিখুন (JavaScript ব্লক করা হবে)
          </Label>
          <Textarea
            placeholder={`<div style="background:#f5f5f5;padding:20px;border-radius:12px;">\n  <h2 style="color:#2563eb;">শিরোনাম</h2>\n  <p>কন্টেন্ট...</p>\n</div>`}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            rows={8}
            className="font-mono text-sm border-0 bg-zinc-950 text-zinc-100 focus:bg-zinc-900 transition-colors rounded-xl resize-y min-h-[150px]"
            spellCheck={false}
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>ট্যাগ: div, p, h1-h6, table, img, a, ul, ol, li</span>
            <span className="opacity-40">|</span>
            <span>CSS: color, background, padding, margin, border, flex, grid</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground">
            লাইভ প্রিভিউ (স্যানিটাইজড)
          </Label>
          <div
            className="rounded-xl border border-border/40 bg-white p-4 overflow-x-auto min-h-[100px]"
          >
            {sanitizedHtml ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                (HTML কন্টেন্ট দিন)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Render sanitized HTML block in preview mode.
 */
export function HtmlBlockPreview({ content }: { content: string }) {
  if (!content) return null
  const safe = sanitizeHtml(content)
  if (!safe) return <p className="text-sm text-muted-foreground italic">(খালি HTML ব্লক)</p>
  return (
    <div className="html-block-preview" dangerouslySetInnerHTML={{ __html: safe }} />
  )
}
