'use client'

import React, { memo } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Textarea } from '@/components/ui/textarea'
import { Sigma } from 'lucide-react'

export const BlogTextBlockEditor = memo(function BlogTextBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'text' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Sigma className="h-3 w-3" />
        <span>ম্যাথের জন্য <code className="bg-muted/80 px-1 py-0.5 rounded text-[10px]">$...$</code>, <code className="bg-muted/80 px-1 py-0.5 rounded text-[10px]">$$...$$</code> বা <code className="bg-muted/80 px-1 py-0.5 rounded text-[10px]">&lt;math&gt;...&lt;/math&gt;</code> ব্যবহার করুন</span>
      </div>
      <Textarea
        placeholder="টেক্সট লিখুন... (ম্যাথ: $x^2+1$, MathML: <math>...</math>)"
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        rows={4}
        className="border-0 bg-muted/30 focus:bg-muted/50 transition-colors resize-y min-h-[80px]"
      />
    </div>
  )
})
