'use client'

import React, { memo, useState, useCallback } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { blogBlockTypeConfig } from './blog-block-types'
import { BlogBlockPreview } from './BlogBlockPreview'
import { BlogHeadingBlockEditor } from './BlogHeadingBlockEditor'
import { BlogTextBlockEditor } from './BlogTextBlockEditor'
import { BlogImageBlockEditor } from './BlogImageBlockEditor'
import { BlogMathBlockEditor } from './BlogMathBlockEditor'
import { BlogCodeBlockEditor } from './BlogCodeBlockEditor'
import { BlogDataBlockEditor } from './BlogDataBlockEditor'
import { BlogRichTextBlockEditor } from './BlogRichTextBlockEditor'
import { BlogPdfBlockEditor } from './BlogPdfBlockEditor'
import { BlogLinkBlockEditor } from './BlogLinkBlockEditor'
import { BlogMindMapBlockEditor } from './BlogMindMapBlockEditor'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Trash2,
} from 'lucide-react'

export const BlogBlockItem = memo(function BlogBlockItem({
  block,
  blockId,
  onUpdate,
  onRemove,
  onMove,
  onDuplicate,
  isFirst,
  isLast,
  index,
  total: _total,
}: {
  block: BlogContentBlock
  blockId: string
  onUpdate: (id: string, updated: BlogContentBlock) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onDuplicate: (id: string) => void
  isFirst: boolean
  isLast: boolean
  index: number
  total: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = blogBlockTypeConfig[block.type]
  const Icon = config.icon

  const handleChange = useCallback((updated: BlogContentBlock) => {
    onUpdate(blockId, updated)
  }, [blockId, onUpdate])

  const handleRemove = useCallback(() => {
    onRemove(blockId)
  }, [blockId, onRemove])

  const handleMoveUp = useCallback(() => {
    onMove(blockId, 'up')
  }, [blockId, onMove])

  const handleMoveDown = useCallback(() => {
    onMove(blockId, 'down')
  }, [blockId, onMove])

  const handleDuplicate = useCallback(() => {
    onDuplicate(blockId)
  }, [blockId, onDuplicate])

  return (
    <div className="group relative rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all">
      {/* Block Header */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-t-xl border-b border-border/30',
        config.bg,
      )}>
        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />

        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium', config.color)}>
          <Icon className="h-3.5 w-3.5" />
          {config.bnLabel}
        </div>

        <span className="text-[10px] text-muted-foreground/50">
          #{index + 1}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="p-1 rounded-md hover:bg-background/80 text-muted-foreground disabled:opacity-30 transition-colors"
            disabled={isFirst}
            onClick={handleMoveUp}
            title="উপরে সরান"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-background/80 text-muted-foreground disabled:opacity-30 transition-colors"
            disabled={isLast}
            onClick={handleMoveDown}
            title="নিচে সরান"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-background/80 text-muted-foreground transition-colors"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'সম্পাদনা' : 'প্রিভিউ'}
          >
            {collapsed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-background/80 text-muted-foreground transition-colors"
            onClick={handleDuplicate}
            title="ডুপ্লিকেট"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-destructive transition-colors"
            onClick={handleRemove}
            title="মুছুন"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Block Content */}
      <div className="p-3">
        {collapsed ? (
          <div className="py-2 px-1">
            <BlogBlockPreview block={block} />
          </div>
        ) : (
          <>
            {block.type === 'heading' && <BlogHeadingBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'text' && <BlogTextBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'image' && <BlogImageBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'math' && <BlogMathBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'data' && <BlogDataBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'code' && <BlogCodeBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'pdf' && <BlogPdfBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'link' && <BlogLinkBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'richtext' && <BlogRichTextBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'mindmap' && <BlogMindMapBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'divider' && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[11px] text-muted-foreground">বিভাজক</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})
