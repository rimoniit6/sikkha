import { db } from '@/lib/db'
import BlogHomeClient from './BlogHomeClient'
import { serialize } from '@/lib/serialize'
import type { Metadata } from 'next'
import type { BlogPostRecord, BlogCategoryRecord } from '@/features/blog/types/blog'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'ব্লগ - শিক্ষা বাংলা',
  description: 'শিক্ষা টিপস, গাইড ও আপডেট — শিক্ষা বাংলা ব্লগ।',
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    title: 'ব্লগ - শিক্ষা বাংলা',
    description: 'শিক্ষা টিপস, গাইড ও আপডেট — শিক্ষা বাংলা ব্লগ।',
    url: `${siteUrl}/blog`,
  },
}

export default async function BlogHomePage() {
  const [featured, posts, categories, popularPosts] = await Promise.all([
    db.blogPost.findFirst({
      where: { status: 'PUBLISHED', isActive: true, deletedAt: null, isFeatured: true, publishedAt: { lte: new Date() } },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { publishedAt: 'desc' },
    }),
    db.blogPost.findMany({
      where: { status: 'PUBLISHED', isActive: true, deletedAt: null, publishedAt: { lte: new Date() } },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 12,
    }),
    db.blogCategory.findMany({
      where: { isActive: true, deletedAt: null },
      include: { _count: { select: { posts: { where: { status: 'PUBLISHED', deletedAt: null } } } } },
      orderBy: { order: 'asc' },
    }),
    db.blogPost.findMany({
      where: { status: 'PUBLISHED', isActive: true, deletedAt: null, publishedAt: { lte: new Date() } },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { viewCount: 'desc' },
      take: 5,
    }),
  ])

  const activeCategories = categories.filter(c => c._count.posts > 0)
  const totalPages = Math.ceil(posts.length > 0 ? await db.blogPost.count({
    where: { status: 'PUBLISHED', isActive: true, deletedAt: null, publishedAt: { lte: new Date() } },
  }) / 12 : 1)

  return (
    <BlogHomeClient
      featured={serialize(featured) as unknown as BlogPostRecord | null}
      posts={serialize(posts) as unknown as BlogPostRecord[]}
      categories={serialize(activeCategories) as unknown as BlogCategoryRecord[]}
      popularPosts={serialize(popularPosts) as unknown as BlogPostRecord[]}
      totalPages={totalPages}
    />
  )
}
