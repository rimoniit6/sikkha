'use client'

import React from 'react'
import type { BlogContentBlock } from './blog-block-types'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import MathBlock from '@/components/ui/math-block'
import { BlogMindMapPreview } from './BlogMindMapBlockEditor'
import { downloadPdf, getFilenameFromUrl } from '@/lib/pdf-download'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import {
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Link2,
  Sparkles,
} from 'lucide-react'

export function BlogBlockPreview({ block }: { block: BlogContentBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <RichContentRenderer
          content={block.content || '(হেডিং)'}
          className={
            block.level === 1 ? 'text-xl font-bold' :
            block.level === 2 ? 'text-lg font-semibold' :
            'text-base font-medium'
          }
        />
      )
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
      return <BlogMindMapPreview data={block.data} title={block.title} />
    case 'html':
      return block.content ? (
        <RichContentRenderer content={block.content} className="text-sm leading-relaxed" />
      ) : (
        <p className="text-sm text-muted-foreground italic">(HTML)</p>
      )
    default:
      return null
  }
}
