import {
  BookOpen,
  Eye,
  LayoutGrid,
} from 'lucide-react'
import React from 'react'

export type BlogStepNumber = 1 | 2 | 3

export const blogSteps: { num: BlogStepNumber; label: string; icon: React.ElementType }[] = [
  { num: 1, label: 'মৌলিক তথ্য', icon: BookOpen },
  { num: 2, label: 'কন্টেন্ট ব্লক ও মিডিয়া', icon: LayoutGrid },
  { num: 3, label: 'প্রিভিউ ও প্রকাশ', icon: Eye },
]

export interface BlogPostRecord {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  contentBlocks: string | null
  featuredImage: string | null
  gallery: string | null
  authorId: string | null
  author: { id: string; name: string | null; avatar: string | null } | null
  categoryId: string | null
  category: { id: string; name: string; slug: string; color: string | null } | null
  status: string
  publishedAt: string | null
  scheduledAt: string | null
  viewCount: number
  readingTime: number | null
  isFeatured: boolean
  isPinned: boolean
  allowComments: boolean
  isActive: boolean
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImage: string | null
  tags: Array<{ tag: { id: string; name: string; slug: string } }>
  createdAt: string
  updatedAt: string
}

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface BlogPostInput {
  title: string
  slug?: string
  excerpt?: string | null
  content?: string
  contentBlocks?: string | null
  featuredImage?: string | null
  categoryId?: string | null
  status?: BlogPostStatus
  publishedAt?: string | null
  scheduledAt?: string | null
  isFeatured?: boolean
  isPinned?: boolean
  allowComments?: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  ogImage?: string | null
  robots?: string | null
  tagIds?: string[]
}

export interface BlogCategoryRecord {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  isActive: boolean
  order: number
  _count?: { posts: number }
  createdAt: string
}

export interface BlogTagRecord {
  id: string
  name: string
  slug: string
  _count?: { posts: number }
  createdAt: string
}

export const statusLabels: Record<string, string> = {
  DRAFT: 'খসড়া',
  PUBLISHED: 'প্রকাশিত',
  ARCHIVED: 'আর্কাইভড',
}

export const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}
