'use client'

import React, { memo } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const BlogCodeBlockEditor = memo(function BlogCodeBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'code' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">ভাষা</Label>
        <Input
          placeholder="javascript, python..."
          value={block.language}
          onChange={(e) => onChange({ ...block, language: e.target.value })}
          className="h-7 w-36 text-xs border-0 bg-muted/30 focus:bg-muted/50 font-mono"
        />
      </div>
      <Textarea
        placeholder="কোড লিখুন..."
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        rows={5}
        className="font-mono text-sm border-0 bg-zinc-950 text-zinc-100 focus:bg-zinc-900 transition-colors rounded-xl"
      />
    </div>
  )
})
