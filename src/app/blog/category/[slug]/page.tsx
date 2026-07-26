import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BlogCard from '@/features/blog/components/BlogCard'
import { serialize } from '@/lib/serialize'
import type { Metadata } from 'next'
import type { BlogPostRecord } from '@/features/blog/types/blog'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await db.blogCategory.findUnique({ where: { slug } })
  if (!category) return { title: 'ক্যাটাগরি পাওয়া যায়নি' }
  return {
    title: `${category.name} - ব্লগ`,
    description: category.description || `${category.name} ক্যাটাগরির ব্লগ পোস্ট সমূহ`,
  }
}

export default async function BlogCategoryPage({ params }: Props) {
  const { slug } = await params
  const category = await db.blogCategory.findUnique({ where: { slug } })
  if (!category) notFound()

  const posts = await db.blogPost.findMany({
    where: { status: 'PUBLISHED', isActive: true, deletedAt: null, categoryId: category.id, publishedAt: { lte: new Date() } },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
    orderBy: { publishedAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-emerald-600 hover:underline">&larr; ব্লগে ফিরুন</Link>
          <h1 className="text-3xl font-bold mt-2">{category.name}</h1>
          {category.description && <p className="text-muted-foreground mt-1">{category.description}</p>}
        </div>

        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">এই ক্যাটাগরিতে কোনো পোস্ট নেই</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard key={post.id} post={serialize(post) as unknown as BlogPostRecord} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
