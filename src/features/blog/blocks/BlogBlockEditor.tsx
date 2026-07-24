'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { blogBlockTypeConfig, blogGenerateId, createBlogBlock } from './blog-block-types'
import { BlogBlockItem } from './BlogBlockItem'
import { BlogAddBlockMenu } from './BlogAddBlockMenu'
import { BlogBlockPreview } from './BlogBlockPreview'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Palette } from 'lucide-react'

interface BlogBlockEditorProps {
  blocks: BlogContentBlock[]
  onChange?: (blocks: BlogContentBlock[]) => void
  previewMode?: boolean
  allowedBlocks?: BlogContentBlock['type'][]
}

export default function BlogBlockEditor({ blocks, onChange, previewMode = false, allowedBlocks }: BlogBlockEditorProps) {
  const noop = useCallback(() => {}, [])
  const onChangeRef = useRef(onChange ?? noop)
  useEffect(() => { onChangeRef.current = onChange ?? noop })

  const blocksRef = useRef(blocks)
  useEffect(() => { blocksRef.current = blocks })

  const updateBlock = useCallback((id: string, updated: BlogContentBlock) => {
    onChangeRef.current(blocksRef.current.map((b) => (b.id === id ? updated : b)))
  }, [])

  const removeBlock = useCallback((id: string) => {
    onChangeRef.current(blocksRef.current.filter((b) => b.id !== id))
  }, [])

  const addBlock = useCallback((type: BlogContentBlock['type'], afterId?: string) => {
    const newBlock = createBlogBlock(type)
    const currentBlocks = blocksRef.current
    if (afterId) {
      const idx = currentBlocks.findIndex((b) => b.id === afterId)
      const newBlocks = [...currentBlocks]
      newBlocks.splice(idx + 1, 0, newBlock)
      onChangeRef.current(newBlocks)
    } else {
      onChangeRef.current([...currentBlocks, newBlock])
    }
  }, [])

  const duplicateBlock = useCallback((id: string) => {
    const currentBlocks = blocksRef.current
    const idx = currentBlocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const source = currentBlocks[idx]
    const newBlock = { ...source, id: blogGenerateId() }
    const newBlocks = [...currentBlocks]
    newBlocks.splice(idx + 1, 0, newBlock)
    onChangeRef.current(newBlocks)
  }, [])

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    const currentBlocks = blocksRef.current
    const idx = currentBlocks.findIndex((b) => b.id === id)
    if (direction === 'up' && idx > 0) {
      const newBlocks = [...currentBlocks]
      ;[newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]]
      onChangeRef.current(newBlocks)
    } else if (direction === 'down' && idx < currentBlocks.length - 1) {
      const newBlocks = [...currentBlocks]
      ;[newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]]
      onChangeRef.current(newBlocks)
    }
  }, [])

  if (previewMode) {
    return (
      <div className="space-y-4">
        {blocks.map((block) => (
          <BlogBlockPreview key={block.id} block={block} />
        ))}
        {blocks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">কোনো কন্টেন্ট ব্লক নেই</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <BlogBlockItem
          key={block.id}
          block={block}
          blockId={block.id}
          onUpdate={updateBlock}
          onRemove={removeBlock}
          onMove={moveBlock}
          onDuplicate={duplicateBlock}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          index={index}
          total={blocks.length}
        />
      ))}

      {blocks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-10 border-2 border-dashed rounded-xl border-border/40 bg-muted/10"
        >
          <Palette className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm font-medium mb-1">কোনো কন্টেন্ট ব্লক নেই</p>
          <p className="text-muted-foreground/60 text-xs">নিচের বাটন থেকে ব্লক যোগ করুন</p>
        </motion.div>
      )}

      <BlogAddBlockMenu onAdd={(type) => addBlock(type)} allowedBlocks={allowedBlocks} />

      {blocks.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 pt-1">
          <span>{blocks.length}টি ব্লক</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            {[...new Set(blocks.map(b => b.type))].map(t => {
              const cfg = blogBlockTypeConfig[t]
              const BIcon = cfg?.icon
              return BIcon ? (
                <span key={t} className={cn('p-0.5 rounded', cfg?.bg)}>
                  <BIcon className={cn('h-2.5 w-2.5', cfg?.color)} />
                </span>
              ) : null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
