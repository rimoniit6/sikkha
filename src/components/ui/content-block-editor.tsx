'use client'

import {
  ContentBlock,
  MindMapNode,
  blockTypeConfig,
  generateId,
  createBlock,
  serializeBlocks,
  deserializeBlocks,
} from './content-block-types'
import { DataBlockEditor } from './DataBlockEditor'
import { MindMapBlockEditor, MindMapPreview } from './MindMapBlockEditor'
import { RichTextBlockEditor } from './RichTextBlockEditor'
import { Badge } from '@/components/ui/badge'
import ImageUploader from '@/components/ui/image-uploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import MathBlock from '@/components/ui/math-block'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import { Textarea } from '@/components/ui/textarea'
import { detectMathFormat,normalizeMathInput } from '@/lib/math-converter'
import { downloadPdf,getFilenameFromUrl } from '@/lib/pdf-download'
import { cn } from '@/lib/utils'
import { AnimatePresence,motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  ImagePlus,
  Link2,
  Palette,
  Plus,
  Sigma,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import Image from 'next/image'
import React,{ memo,useCallback,useEffect,useRef,useState } from 'react'

// ─── Individual Block Editors ───────────────────────────────────

const HeadingBlockEditor = memo(function HeadingBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'heading' }; onChange: (b: ContentBlock) => void }) {
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

const TextBlockEditor = memo(function TextBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'text' }; onChange: (b: ContentBlock) => void }) {
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

function ImageBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'image' }; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <ImageUploader
        value={block.url}
        onChange={(url) => onChange({ ...block, url })}
        label="ছবি"
        placeholder="ছবি আপলোড করুন বা টেনে আনুন"
      />
      <Input
        placeholder="ছবির ক্যাপশন (ঐচ্ছিক)..."
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
    </div>
  )
}

const MathBlockEditor = memo(function MathBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'math' }; onChange: (b: ContentBlock) => void }) {
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

function PdfBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'pdf' }; onChange: (b: ContentBlock) => void }) {
  return (
    <div className="space-y-3">
      <ImageUploader
        value={block.url}
        onChange={(url) => onChange({ ...block, url })}
        label="পিডিএফ"
        placeholder="পিডিএফ আপলোড করুন বা URL দিন"
      />
      <Input
        placeholder="পিডিএফ শিরোনাম (ঐচ্ছিক)..."
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
    </div>
  )
}

function LinkBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'link' }; onChange: (b: ContentBlock) => void }) {
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

const CodeBlockEditor = memo(function CodeBlockEditor({ block, onChange }: { block: ContentBlock & { type: 'code' }; onChange: (b: ContentBlock) => void }) {
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

// ─── Block Renderer (Preview) ───────────────────────────────────

function BlockPreview({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': {
      const headingId = `heading-${block.id}`
      return (
        <div id={headingId}>
          <RichContentRenderer
            content={block.content || '(হেডিং)'}
            className={cn(
              block.level === 1 && 'text-xl font-bold',
              block.level === 2 && 'text-lg font-semibold',
              block.level === 3 && 'text-base font-medium',
            )}
          />
        </div>
      )
    }
    case 'text':
      return block.content ? (
        <RichContentRenderer content={block.content} className="text-sm leading-relaxed" />
      ) : (
        <p className="text-sm text-muted-foreground italic">(টেক্সট)</p>
      )
    case 'image':
      return (
        <div className="text-center">
          {block.url ? (
            <div className="inline-block">
              <Image src={block.url} alt={block.caption || 'ছবি'} width={800} height={400} className="max-w-full max-h-56 mx-auto rounded-xl shadow-sm" unoptimized />
              {block.caption && <p className="text-xs text-muted-foreground mt-2 italic">{block.caption}</p>}
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center gap-2 text-muted-foreground">
              <ImagePlus className="h-8 w-8 opacity-30" />
              <p className="text-xs">(ছবি যোগ করা হয়নি)</p>
            </div>
          )}
        </div>
      )
    case 'math':
      return block.content ? (
        <div className="text-center overflow-x-auto py-3 px-2">
          <MathBlock content={block.content} displayMode className="text-base" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic text-center py-2">(ম্যাথ সমীকরণ)</p>
      )
    case 'data':
      return (
        <div className="overflow-x-auto">
          {block.caption && <p className="text-xs text-muted-foreground mb-2 font-medium">{block.caption}</p>}
          <table className="w-full border-collapse text-xs rounded-lg overflow-hidden">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="border border-border/50 bg-muted/50 px-3 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/20">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border/30 px-3 py-1.5">
                      <RichContentRenderer content={cell} className="text-xs" inline />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'code':
      return (
        <div className="relative">
          {block.language && (
            <Badge variant="secondary" className="absolute top-2 right-2 text-[9px] h-4 px-1.5 z-10 opacity-70">
              {block.language}
            </Badge>
          )}
          <pre className="bg-zinc-900 text-zinc-100 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">
            {block.content || '(কোড)'}
          </pre>
        </div>
      )
    case 'divider':
      return (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border/50" />
          <Sparkles className="h-3 w-3 text-muted-foreground/40" />
          <div className="flex-1 h-px bg-border/50" />
        </div>
      )
    case 'pdf':
      return block.url ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <FileText className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400 truncate">
              {block.title || 'পিডিএফ ফাইল'}
            </p>
            <p className="text-xs text-orange-500/70 truncate">{block.url}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => downloadPdf(block.url!, block.title || getFilenameFromUrl(block.url!))}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              ডাউনলোড
            </button>
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              খুলুন
            </a>
          </div>
        </div>
      ) : (
        <div className="py-4 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-8 w-8 opacity-30" />
          <p className="text-xs">(পিডিএফ যোগ করা হয়নি)</p>
        </div>
      )
    case 'link':
      return block.url ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-800/30">
          <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <ExternalLink className="h-6 w-6 text-cyan-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400 truncate">
              {block.label || block.url}
            </p>
            <p className="text-xs text-cyan-500/70 truncate">{block.url}</p>
            {block.description && (
              <p className="text-xs text-cyan-600/60 mt-0.5 line-clamp-2">{block.description}</p>
            )}
          </div>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1 shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            খুলুন
          </a>
        </div>
      ) : (
        <div className="py-4 flex flex-col items-center gap-2 text-muted-foreground">
          <Link2 className="h-8 w-8 opacity-30" />
          <p className="text-xs">(লিংক যোগ করা হয়নি)</p>
        </div>
      )
    case 'richtext':
      return block.content ? (
        <RichContentRenderer content={block.content} className="text-sm leading-relaxed" />
      ) : (
        <p className="text-sm text-muted-foreground italic">(রিচ টেক্সট)</p>
      )
    case 'mindmap':
      return <MindMapPreview data={block.data} title={block.title} />
    default:
      return null
  }
}

// ─── Single Block Wrapper ───────────────────────────────────────

const BlockItem = memo(function BlockItem({
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
  block: ContentBlock
  blockId: string
  onUpdate: (id: string, updated: ContentBlock) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onDuplicate: (id: string) => void
  isFirst: boolean
  isLast: boolean
  index: number
  total: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = blockTypeConfig[block.type]
  const Icon = config.icon

  const handleChange = useCallback((updated: ContentBlock) => {
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
    <div
      className="group relative rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all"
    >
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
            <BlockPreview block={block} />
          </div>
        ) : (
          <>
            {block.type === 'heading' && <HeadingBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'text' && <TextBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'image' && <ImageBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'math' && <MathBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'data' && <DataBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'code' && <CodeBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'pdf' && <PdfBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'link' && <LinkBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'richtext' && <RichTextBlockEditor block={block} onChange={handleChange} />}
            {block.type === 'mindmap' && <MindMapBlockEditor block={block} onChange={handleChange} />}
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

// ─── Add Block Menu ─────────────────────────────────────────────

function AddBlockMenu({ onAdd, allowedBlocks }: { onAdd: (type: ContentBlock['type']) => void; allowedBlocks?: ContentBlock['type'][] }) {
  const [open, setOpen] = useState(false)

  const allTypes: ContentBlock['type'][] = Object.keys(blockTypeConfig) as ContentBlock['type'][]
  const types = allowedBlocks ?? allTypes

  return (
    <div className="space-y-0">
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
          'border-2 border-dashed border-border/50 hover:border-emerald-400/60',
          'text-sm text-muted-foreground hover:text-emerald-600',
          'bg-transparent hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10',
          'transition-all duration-200',
        )}
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-4 w-4" />
        ব্লক যোগ করুন
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' } as const}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  ব্লকের ধরন নির্বাচন করুন
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {types.map((type, idx) => {
                  const config = blockTypeConfig[type]
                  const Icon = config.icon
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all',
                        'border border-border/40 hover:border-border',
                        'bg-card hover:shadow-md',
                        'group/card',
                      )}
                      onClick={() => {
                        onAdd(type)
                        setOpen(false)
                      }}
                    >
                      <div className={cn(
                        'p-2.5 rounded-xl transition-transform group-hover/card:scale-110',
                        config.bg,
                      )}>
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{config.bnLabel}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{config.description}</div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3 w-3" />
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Content Block Editor ──────────────────────────────────

interface ContentBlockEditorProps {
  blocks: ContentBlock[]
  onChange?: (blocks: ContentBlock[]) => void
  previewMode?: boolean
  allowedBlocks?: ContentBlock['type'][]
}

export default function ContentBlockEditor({ blocks, onChange, previewMode = false, allowedBlocks }: ContentBlockEditorProps) {
  const noop = useCallback(() => {}, [])
  const onChangeRef = useRef(onChange ?? noop)
  useEffect(() => { onChangeRef.current = onChange ?? noop })

  const blocksRef = useRef(blocks)
  useEffect(() => { blocksRef.current = blocks })

  const updateBlock = useCallback((id: string, updated: ContentBlock) => {
    onChangeRef.current(blocksRef.current.map((b) => (b.id === id ? updated : b)))
  }, [])

  const removeBlock = useCallback((id: string) => {
    onChangeRef.current(blocksRef.current.filter((b) => b.id !== id))
  }, [])

  const addBlock = useCallback((type: ContentBlock['type'], afterId?: string) => {
    const newBlock = createBlock(type)
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
    const newBlock = { ...source, id: generateId() }
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
          <BlockPreview key={block.id} block={block} />
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
        <BlockItem
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

      <AddBlockMenu onAdd={(type) => addBlock(type)} allowedBlocks={allowedBlocks} />

      {blocks.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 pt-1">
          <span>{blocks.length}টি ব্লক</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            {[...new Set(blocks.map(b => b.type))].map(t => {
              const cfg = blockTypeConfig[t]
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

export type { ContentBlock, MindMapNode }
export { blockTypeConfig, generateId, createBlock, serializeBlocks, deserializeBlocks }
