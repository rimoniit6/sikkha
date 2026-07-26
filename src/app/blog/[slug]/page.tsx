import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import BlogDetailClient from './BlogDetailClient'
import { serialize } from '@/lib/serialize'
import type { Metadata } from 'next'
import type { BlogPostRecord } from '@/features/blog/types/blog'

interface Props {
  params: Promise<{ slug: string }>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await db.blogPost.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, featuredImage: true, metaTitle: true, metaDescription: true, ogImage: true, canonicalUrl: true, publishedAt: true, updatedAt: true, authorId: true },
  })

  if (!post) return { title: 'পোস্ট পাওয়া যায়নি' }

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      images: post.ogImage || post.featuredImage ? [{ url: post.ogImage || post.featuredImage!, width: 1200, height: 630 }] : [],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt || undefined },
    alternates: { canonical: post.canonicalUrl || `/blog/${slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params

  const post = await db.blogPost.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  })

  if (!post || post.status !== 'PUBLISHED' || post.deletedAt) {
    notFound()
  }

  // Fetch prev/next by publishedAt
  const [prevPost, nextPost] = await Promise.all([
    db.blogPost.findFirst({
      where: {
        status: 'PUBLISHED', isActive: true, deletedAt: null,
        publishedAt: { lt: post.publishedAt ?? undefined },
      },
      select: { slug: true, title: true },
      orderBy: { publishedAt: 'desc' },
    }),
    db.blogPost.findFirst({
      where: {
        status: 'PUBLISHED', isActive: true, deletedAt: null,
        publishedAt: { gt: post.publishedAt ?? undefined },
      },
      select: { slug: true, title: true },
      orderBy: { publishedAt: 'asc' },
    }),
  ])

  const TAG_INCLUDE = { include: { tag: { select: { id: true, name: true, slug: true } } } }

  // Related posts: by category OR shared tags (fallback)
  const relatedPosts = post.categoryId
    ? await db.blogPost.findMany({
        where: {
          id: { not: post.id },
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
          publishedAt: { lte: new Date() },
          categoryId: post.categoryId,
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: TAG_INCLUDE,
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      })
    : await db.blogPost.findMany({
        where: {
          id: { not: post.id },
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
          publishedAt: { lte: new Date() },
          tags: post.tags.length > 0
            ? { some: { tagId: { in: post.tags.map(t => t.tag.id) } } }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: TAG_INCLUDE,
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      })

  // Increment view count asynchronously
  db.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

  const serialized = serialize(post) as unknown as BlogPostRecord
  const serializedRelated = serialize(relatedPosts) as unknown as BlogPostRecord[]

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.ogImage || post.featuredImage || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    author: post.author ? {
      '@type': 'Person',
      name: post.author.name,
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'শিক্ষা বাংলা',
      url: siteUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${post.slug}`,
    },
    ...(post.category ? {
      about: {
        '@type': 'Thing',
        name: post.category.name,
      },
    } : {}),
    wordCount: post.content ? post.content.replace(/<[^>]*>/g, '').split(/\s+/).length : 0,
    timeRequired: post.readingTime ? `PT${post.readingTime}M` : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'ব্লগ', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <BlogDetailClient
        post={serialized}
        relatedPosts={serializedRelated}
        prevPost={prevPost ? { slug: prevPost.slug, title: prevPost.title } : null}
        nextPost={nextPost ? { slug: nextPost.slug, title: nextPost.title } : null}
      />
    </>
  )
}
