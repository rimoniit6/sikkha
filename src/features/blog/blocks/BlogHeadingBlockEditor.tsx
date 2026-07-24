'use client'

import React, { memo } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const BlogHeadingBlockEditor = memo(function BlogHeadingBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'heading' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">স্তর</Label>
        {[1, 2, 3].map((lvl) => (
          <button
            key={lvl}
            type="button"
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
              block.level === lvl
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                : 'bg-muted/80 text-muted-foreground hover:bg-muted',
            )}
            onClick={() => onChange({ ...block, level: lvl })}
          >
            H{lvl}
          </button>
        ))}
      </div>
      <Input
        placeholder="হেডিং লিখুন..."
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        className={cn(
          'border-0 bg-muted/30 focus:bg-muted/50 transition-colors px-3',
          block.level === 1 && 'text-xl font-bold',
          block.level === 2 && 'text-lg font-semibold',
          block.level === 3 && 'text-base font-medium',
        )}
      />
    </div>
  )
})
