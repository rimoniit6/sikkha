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

export interface BlogCategoryInput {
  name: string
  slug?: string
  description?: string | null
  color?: string | null
  isActive?: boolean
  order?: number
}

export interface BlogTagRecord {
  id: string
  name: string
  slug: string
  _count?: { posts: number }
  createdAt: string
}

export interface BlogTagInput {
  name: string
  slug?: string
}
