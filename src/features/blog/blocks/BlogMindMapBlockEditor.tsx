'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { BlogContentBlock, BlogMindMapNode } from './blog-block-types'
import {
  parseBlogMindMap,
  addBlogMindMapChild,
  removeBlogMindMapChild,
  updateBlogMindMapNode,
  addBlogMindMapChildAt,
  removeBlogMindMapChildAt,
  blogMindMapNodeCount,
} from './blog-block-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Plus, Upload, X, Loader2 } from 'lucide-react'
import { Markmap } from 'markmap-view'
import { BlogToolbarButton } from './BlogRichTextBlockEditor'

export function BlogMindMapBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'mindmap' }
  onChange: (b: BlogContentBlock) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const markmapRef = useRef<Markmap | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mindMapData, setMindMapData] = useState<BlogMindMapNode>(() => parseBlogMindMap(block.data))
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    if (!svgRef.current) return
    if (!markmapRef.current) {
      markmapRef.current = Markmap.create(svgRef.current, {
        zoom: true,
        pan: true,
        fitRatio: 1,
      }, mindMapData)
    } else {
      markmapRef.current.setData(mindMapData)
      markmapRef.current.fit()
    }
  }, [mindMapData])

  const commit = (node: BlogMindMapNode) => {
    setMindMapData(node)
    onChange({ ...block, data: JSON.stringify(node) })
  }

  const handleNodeChange = (path: number[], content: string) => {
    commit(updateBlogMindMapNode(mindMapData, path, content))
  }

  const handleAddChild = (path: number[]) => {
    commit(addBlogMindMapChildAt(mindMapData, path))
  }

  const handleRemoveChild = (path: number[]) => {
    commit(removeBlogMindMapChildAt(mindMapData, path))
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    setImportError('')

    try {
      const text = await file.text()
      if (!text.trim()) {
        setImportError('ফাইল খালি')
        setImportLoading(false)
        return
      }

      let node: BlogMindMapNode | null = null

      try {
        const parsed = JSON.parse(text)
        if (typeof parsed.content === 'string') {
          node = parsed
        }
      } catch {
        // Not JSON — try markdown
      }

      if (!node) {
        const { Transformer } = await import('markmap-lib')
        const transformer = new Transformer()
        const { root } = transformer.transform(text)
        if (root && typeof root.content === 'string') {
          node = root as unknown as BlogMindMapNode
        }
      }

      if (!node) {
        setImportError('ফাইলের ফরম্যাট সঠিক নয়। JSON বা মার্কডাউন ফাইল ব্যবহার করুন।')
        setImportLoading(false)
        return
      }

      commit(node)
    } catch {
      setImportError('ফাইল পড়তে সমস্যা হয়েছে')
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const renderNodeEditor = (node: BlogMindMapNode, path: number[], depth: number) => (
    <div key={path.join('-')} className="space-y-1.5">
      <div className={cn(
        'flex items-center gap-1.5 rounded-lg transition-colors',
        depth > 0 && 'ml-5 pl-3 border-l-2 border-rose-200/50 dark:border-rose-800/30',
      )}>
        {depth > 0 && (
          <div className="shrink-0 w-2 h-px bg-rose-200/50 dark:bg-rose-800/30" />
        )}
        <Input
          value={node.content}
          onChange={(e) => handleNodeChange(path, e.target.value)}
          placeholder={depth === 0 ? 'মূল বিষয় লিখুন...' : 'উপশাখা লিখুন...'}
          className={cn(
            'h-8 text-xs border-0 bg-muted/20 focus:bg-muted/40 flex-1',
            depth === 0 && 'font-semibold text-sm',
          )}
        />
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:bg-rose-100 dark:hover:bg-rose-900/30" onClick={() => handleAddChild(path)} title="শিশু যোগ">
          <Plus className="h-3 w-3 text-rose-500" />
        </Button>
        {depth > 0 && (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:bg-destructive/10" onClick={() => handleRemoveChild(path)} title="মুছুন">
            <X className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child, idx) =>
            renderNodeEditor(child, [...path, idx], depth + 1)
          )}
        </div>
      )}
    </div>
  )

  if (blogMindMapNodeCount(mindMapData) === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">মাইন্ড ম্যাপে কোনো ডাটা নেই</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md,.txt"
        className="hidden"
        onChange={handleFileImport}
      />

      <div className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground">মাইন্ড ম্যাপ এডিটর</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7 border-rose-300/50 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
            disabled={importLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {importLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {importLoading ? 'ইম্পোর্ট হচ্ছে...' : 'JSON/MD ইম্পোর্ট'}
          </Button>
        </div>
        {renderNodeEditor(mindMapData, [], 0)}
        {mindMapData.children.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7 mt-2 ml-5" onClick={() => handleAddChild([mindMapData.children.length])}>
            <Plus className="h-3 w-3" /> শাখা যোগ
          </Button>
        )}
        {importError && (
          <p className="text-xs text-red-500 flex items-center gap-1 pt-1">
            <X className="h-3 w-3" /> {importError}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
        <div className="bg-muted/20 px-3 py-1.5 border-b border-border/30">
          <Label className="text-xs font-semibold text-muted-foreground">পূর্বরূপ</Label>
        </div>
        <div className="w-full h-[300px]">
          <svg ref={svgRef} className="w-full h-full" />
        </div>
      </div>

      <Input
        placeholder="মাইন্ড ম্যাপের ক্যাপশন (ঐচ্ছিক)..."
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
        className="text-xs border-0 bg-muted/30 focus:bg-muted/50"
      />
    </div>
  )
}

// ─── Mind Map Preview ─────────────────────────────────────────

export function BlogMindMapPreview({ data, title }: { data: string; title: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const mmRef = useRef<Markmap | null>(null)
  const node = useMemo(() => parseBlogMindMap(data), [data])

  useEffect(() => {
    if (!svgRef.current) return
    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        zoom: true,
        pan: true,
        fitRatio: 1,
      }, node)
    } else {
      mmRef.current.setData(node)
      mmRef.current.fit()
    }
  }, [node])

  if (blogMindMapNodeCount(node) === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm italic">(মাইন্ড ম্যাপ)</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {title && <p className="text-xs text-muted-foreground font-medium">{title}</p>}
      <div className="w-full h-[300px] rounded-lg border border-border/30 overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  )
}
