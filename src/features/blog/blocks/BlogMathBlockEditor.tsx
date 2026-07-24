'use client'

import React, { memo } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import MathBlock from '@/components/ui/math-block'
import { detectMathFormat, normalizeMathInput } from '@/lib/math-converter'
import { Sigma } from 'lucide-react'

export const BlogMathBlockEditor = memo(function BlogMathBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'math' }
  onChange: (b: BlogContentBlock) => void
}) {
  const format = detectMathFormat(block.content)
  const normalized = normalizeMathInput(block.content)
  const hasPreview = block.content.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sigma className="h-3 w-3" />
          <span>LaTeX বা MathML লিখুন</span>
        </div>
        <div className="flex items-center gap-1.5">
          {block.content && (
            <Badge variant={format === 'mathml' ? 'secondary' : 'default'} className="text-[10px] h-4 px-1.5">
              {format === 'mathml' ? 'MathML' : 'LaTeX'}
            </Badge>
          )}
          {normalized.converted && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-300">
              → LaTeX
            </Badge>
          )}
        </div>
      </div>

      <Textarea
        placeholder="ম্যাথ সমীকরণ লিখুন... (LaTeX: \frac{-b \pm \sqrt{b^2-4ac}}{2a} বা MathML: <math>...</math>)"
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        rows={3}
        className="font-mono text-sm border-0 bg-muted/30 focus:bg-muted/50 transition-colors"
      />

      {hasPreview && (
        <div className="rounded-lg border border-border/40 bg-white p-4">
          <div className="text-[10px] text-muted-foreground mb-2 font-medium">পূর্বরূপ</div>
          <MathBlock content={normalized.content || block.content} displayMode className="text-base" />
        </div>
      )}
    </div>
  )
})
