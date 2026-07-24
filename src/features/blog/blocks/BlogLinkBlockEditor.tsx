'use client'

import React from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function BlogLinkBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'link' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <Input
        placeholder="লিংক URL (https://...)"
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
      <Input
        placeholder="লিংক লেবেল..."
        value={block.label}
        onChange={(e) => onChange({ ...block, label: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
      <Textarea
        placeholder="বিবরণ (ঐচ্ছিক)..."
        value={block.description}
        onChange={(e) => onChange({ ...block, description: e.target.value })}
        rows={2}
        className="border-0 bg-muted/30 focus:bg-muted/50 transition-colors resize-y min-h-[40px] text-sm"
      />
    </div>
  )
}
