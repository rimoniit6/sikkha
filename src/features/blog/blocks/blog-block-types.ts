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
  Code,
} from 'lucide-react'
import React from 'react'

// ─── Blog Block Types ─────────────────────────────────────────

export type BlogContentBlock =
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
  | { id: string; type: 'html'; content: string }

// ─── Mind Map Helpers ─────────────────────────────────────────

export interface BlogMindMapNode {
  content: string
  children: BlogMindMapNode[]
}

export function createDefaultBlogMindMap(): string {
  const root: BlogMindMapNode = { content: 'কেন্দ্রীয় বিষয়', children: [] }
  return JSON.stringify(root)
}

export function parseBlogMindMap(data: string | null): BlogMindMapNode {
  try {
    const parsed = JSON.parse(data ?? '{}')
    if (typeof parsed.content === 'string') return parsed
    return { content: 'কেন্দ্রীয় বিষয়', children: [] }
  } catch {
    return { content: 'কেন্দ্রীয় বিষয়', children: [] }
  }
}

export function addBlogMindMapChild(node: BlogMindMapNode): BlogMindMapNode {
  return {
    ...node,
    children: [...node.children, { content: '', children: [] }],
  }
}

export function removeBlogMindMapChild(node: BlogMindMapNode, index: number): BlogMindMapNode {
  return {
    ...node,
    children: node.children.filter((_, i) => i !== index),
  }
}

export function updateBlogMindMapNode(node: BlogMindMapNode, path: number[], content: string): BlogMindMapNode {
  if (path.length === 0) {
    return { ...node, content }
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? updateBlogMindMapNode(child, rest, content) : child
    ),
  }
}

export function addBlogMindMapChildAt(node: BlogMindMapNode, path: number[]): BlogMindMapNode {
  if (path.length === 0) {
    return addBlogMindMapChild(node)
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? addBlogMindMapChildAt(child, rest) : child
    ),
  }
}

export function removeBlogMindMapChildAt(node: BlogMindMapNode, path: number[]): BlogMindMapNode {
  if (path.length === 1) {
    return removeBlogMindMapChild(node, path[0])
  }
  const [idx, ...rest] = path
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === idx ? removeBlogMindMapChildAt(child, rest) : child
    ),
  }
}

export function blogMindMapNodeCount(node: BlogMindMapNode): number {
  return 1 + node.children.reduce((sum, c) => sum + blogMindMapNodeCount(c), 0)
}

// ─── Block Factory ────────────────────────────────────────────

let blogBlockCounter = 0

export function blogGenerateId() {
  return `blog-block-${Date.now()}-${++blogBlockCounter}`
}

export function createBlogBlock(type: BlogContentBlock['type']): BlogContentBlock {
  switch (type) {
    case 'heading':
      return { id: blogGenerateId(), type: 'heading', level: 2, content: '' }
    case 'text':
      return { id: blogGenerateId(), type: 'text', content: '' }
    case 'image':
      return { id: blogGenerateId(), type: 'image', url: '', caption: '' }
    case 'math':
      return { id: blogGenerateId(), type: 'math', content: '' }
    case 'data':
      return { id: blogGenerateId(), type: 'data', headers: ['কলাম ১', 'কলাম ২'], rows: [['', '']], caption: '' }
    case 'code':
      return { id: blogGenerateId(), type: 'code', language: 'javascript', content: '' }
    case 'divider':
      return { id: blogGenerateId(), type: 'divider' }
    case 'pdf':
      return { id: blogGenerateId(), type: 'pdf', url: '', title: '' }
    case 'link':
      return { id: blogGenerateId(), type: 'link', url: '', label: '', description: '' }
    case 'richtext':
      return { id: blogGenerateId(), type: 'richtext', content: '' }
    case 'mindmap':
      return { id: blogGenerateId(), type: 'mindmap', data: createDefaultBlogMindMap(), title: '' }
    case 'html':
      return { id: blogGenerateId(), type: 'html', content: '' }
    default:
      return { id: blogGenerateId(), type: 'text', content: '' }
  }
}

// ─── Block Type Config ────────────────────────────────────────

export const blogBlockTypeConfig: Record<string, { label: string; bnLabel: string; icon: React.ElementType; color: string; bg: string; description: string }> = {
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
  html: {
    label: 'HTML',
    bnLabel: 'HTML',
    icon: Code,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    description: 'কাস্টম HTML + CSS ডিজাইন',
  },
}
