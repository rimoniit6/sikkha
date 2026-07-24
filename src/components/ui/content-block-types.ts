import {
  Code2,
  FileText,
  GitBranch,
  Heading1,
  ImagePlus,
  Link2,
  PenTool,
  Sigma,
  Sparkles,
  Table2,
  Type,
} from 'lucide-react'
import React from 'react'

// ─── Block Types ────────────────────────────────────────────────

export type ContentBlock =
  | { id: string; type: 'heading'; level: number; content: string }
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'image'; url: string; caption: string }
  | { id: string; type: 'math'; content: string }
  | { id: string; type: 'data'; headers: string[]; rows: string[][]; caption: string }
  | { id: string; type: 'code'; language: string; content: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'pdf'; url: string; title: string }
  | { id: string; type: 'link'; url: string; label: string; description: string }
  | { id: string; type: 'richtext'; content: string }
  | { id: string; type: 'mindmap'; data: string; title: string }

export interface MindMapNode {
  content: string
  children: MindMapNode[]
}

export function createDefaultMindMap(): string {
  const root: MindMapNode = { content: 'কেন্দ্রীয় বিষয়', children: [] }
  return JSON.stringify(root)
}

export function parseMindMap(data: string | null): MindMapNode {
  try {
    const parsed = JSON.parse(data ?? '{}')
    if (typeof parsed.content === 'string') return parsed
    return { content: 'কেন্দ্রীয় বিষয়', children: [] }
  } catch {
    return { content: 'কেন্দ্রীয় বিষয়', children: [] }
  }
}

export function addMindMapChild(node: MindMapNode): MindMapNode {
  return {
    ...node,
    children: [...node.children, { content: '', children: [] }],
  }
}

export function removeMindMapChild(node: MindMapNode, index: number): MindMapNode {
  return {
    ...node,
    children: node.children.filter((_, i) => i !== index),
  }
}

export function updateMindMapNode(node: MindMapNode, path: number[], content: string): MindMapNode {
  if (path.length === 0) {
    return { ...node, content }
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? updateMindMapNode(child, rest, content) : child
    ),
  }
}

export function addMindMapChildAt(node: MindMapNode, path: number[]): MindMapNode {
  if (path.length === 0) {
    return addMindMapChild(node)
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? addMindMapChildAt(child, rest) : child
    ),
  }
}

export function removeMindMapChildAt(node: MindMapNode, path: number[]): MindMapNode {
  if (path.length === 1) {
    return removeMindMapChild(node, path[0])
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? removeMindMapChildAt(child, rest) : child
    ),
  }
}

export function mindMapNodeCount(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, c) => sum + mindMapNodeCount(c), 0)
}

let blockCounter = 0
export function generateId() {
  return `block-${Date.now()}-${++blockCounter}`
}

export function createBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'heading':
      return { id: generateId(), type: 'heading', level: 2, content: '' }
    case 'text':
      return { id: generateId(), type: 'text', content: '' }
    case 'image':
      return { id: generateId(), type: 'image', url: '', caption: '' }
    case 'math':
      return { id: generateId(), type: 'math', content: '' }
    case 'data':
      return { id: generateId(), type: 'data', headers: ['কলাম ১', 'কলাম ২'], rows: [['', '']], caption: '' }
    case 'code':
      return { id: generateId(), type: 'code', language: 'javascript', content: '' }
    case 'divider':
      return { id: generateId(), type: 'divider' }
    case 'pdf':
      return { id: generateId(), type: 'pdf', url: '', title: '' }
    case 'link':
      return { id: generateId(), type: 'link', url: '', label: '', description: '' }
    case 'richtext':
      return { id: generateId(), type: 'richtext', content: '' }
    case 'mindmap':
      return { id: generateId(), type: 'mindmap', data: createDefaultMindMap(), title: '' }
    default:
      return { id: generateId(), type: 'text', content: '' }
  }
}

// ─── Block Type Config ──────────────────────────────────────────

export const blockTypeConfig: Record<string, { label: string; bnLabel: string; icon: React.ElementType; color: string; bg: string; description: string }> = {
  heading: {
    label: 'Heading',
    bnLabel: 'হেডিং',
    icon: Heading1,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    description: 'শিরোনাম বা সাবটাইটেল',
  },
  text: {
    label: 'Text',
    bnLabel: 'টেক্সট',
    icon: Type,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    description: 'ম্যাথ সাপোর্ট সহ টেক্সট',
  },
  image: {
    label: 'Image',
    bnLabel: 'ছবি',
    icon: ImagePlus,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    description: 'ছবি আপলোড বা URL',
  },
  math: {
    label: 'Math',
    bnLabel: 'ম্যাথ',
    icon: Sigma,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    description: 'KaTeX সমীকরণ',
  },
  data: {
    label: 'Data',
    bnLabel: 'ডাটা',
    icon: Table2,
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    description: 'টেবিল বা ডাটা গ্রিড',
  },
  code: {
    label: 'Code',
    bnLabel: 'কোড',
    icon: Code2,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    description: 'কোড স্নিপেট',
  },
  divider: {
    label: 'Divider',
    bnLabel: 'বিভাজক',
    icon: Sparkles,
    color: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    description: 'বিভাজক রেখা',
  },
  pdf: {
    label: 'PDF',
    bnLabel: 'পিডিএফ',
    icon: FileText,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    description: 'পিডিএফ ফাইল সংযুক্তি',
  },
  link: {
    label: 'Link',
    bnLabel: 'লিংক',
    icon: Link2,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    description: 'বাহ্যিক লিংক বা রেফারেন্স',
  },
  richtext: {
    label: 'Rich Text',
    bnLabel: 'রিচ টেক্সট',
    icon: PenTool,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    description: 'ব্লগ স্টাইল রিচ টেক্সট',
  },
  mindmap: {
    label: 'Mind Map',
    bnLabel: 'মাইন্ড ম্যাপ',
    icon: GitBranch,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    description: 'মাইন্ড ম্যাপ বা ধারণা চিত্র',
  },
}

// ─── Serialize / Deserialize ────────────────────────────────────

export function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks)
}

export function deserializeBlocks(content: string | null): ContentBlock[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    return [{ id: generateId(), type: 'text', content }]
  } catch {
    return [{ id: generateId(), type: 'text', content }]
  }
}

/** Extract h2/h3 headings from blocks for TableOfContents */
export function headingsFromBlocks(blocks: ContentBlock[]): { id: string; text: string; level: number }[] {
  const items: { id: string; text: string; level: number }[] = []
  for (const block of blocks) {
    if (block.type === 'heading' && block.level >= 2 && block.level <= 3 && block.content) {
      const text = block.content.replace(/<[^>]*>/g, '').trim()
      if (!text) continue
      const id = text
        .toLowerCase()
        .replace(/[^\w\u0980-\u09FF\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'heading'
      const existing = items.filter((i) => i.id === id).length
      const uniqueId = existing > 0 ? `${id}-${existing + 1}` : id
      items.push({ id: uniqueId, text, level: block.level })
    }
  }
  return items
}
