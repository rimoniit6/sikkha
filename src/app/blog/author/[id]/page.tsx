import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BlogCard from '@/features/blog/components/BlogCard'
import { serialize } from '@/lib/serialize'
import type { Metadata } from 'next'
import type { BlogPostRecord } from '@/features/blog/types/blog'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const author = await db.user.findUnique({ where: { id }, select: { name: true } })
  if (!author) return { title: 'লেখক পাওয়া যায়নি' }
  return { title: `${author.name} - ব্লগ` }
}

export default async function BlogAuthorPage({ params }: Props) {
  const { id } = await params
  const author = await db.user.findUnique({ where: { id } })
  if (!author) notFound()

  const posts = await db.blogPost.findMany({
    where: { authorId: id, status: 'PUBLISHED', isActive: true, deletedAt: null, publishedAt: { lte: new Date() } },
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
          <h1 className="text-3xl font-bold mt-2">{author.name}</h1>
          <p className="text-muted-foreground mt-1">{posts.length}টি পোস্ট</p>
        </div>

        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">এই লেখকের কোনো পোস্ট নেই</p>
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
