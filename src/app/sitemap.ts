import { db } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

async function getContentUrls() {
  try {
    const [classes, subjects, chapters, notices, suggestions, blogPosts, blogCategories, blogTags] = await Promise.all([
      db.classCategory.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      db.subject.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true, class: { select: { slug: true } } },
      }),
      db.chapter.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true, subject: { select: { slug: true, class: { select: { slug: true } } } } },
      }),
      db.notice.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true } }),
      db.suggestion.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      db.blogPost.findMany({
        where: { status: 'PUBLISHED', isActive: true, deletedAt: null, publishedAt: { lte: new Date() } },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
      db.blogCategory.findMany({ where: { isActive: true, deletedAt: null }, select: { slug: true, updatedAt: true } }),
      db.blogTag.findMany({ select: { slug: true } }),
    ])
    return { classes, subjects, chapters, notices, suggestions, blogPosts, blogCategories, blogTags }
  } catch {
    return { classes: [], subjects: [], chapters: [], notices: [], suggestions: [], blogPosts: [], blogCategories: [], blogTags: [] }
  }
}

const getCachedUrls = unstable_cache(getContentUrls, ['sitemap-content'], { revalidate: 3600 })

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let content
  try {
    content = await getCachedUrls()
  } catch {
    content = { classes: [], subjects: [], chapters: [], notices: [], suggestions: [], blogPosts: [], blogCategories: [], blogTags: [] }
  }

  const { classes, subjects, chapters, notices, suggestions, blogPosts, blogCategories, blogTags } = content

  const staticPages = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${siteUrl}/classes`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${siteUrl}/premium`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${siteUrl}/notices`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 },
    { url: `${siteUrl}/suggestions`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${siteUrl}/board-questions`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${siteUrl}/search`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${siteUrl}/lectures`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${siteUrl}/cq`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${siteUrl}/knowledge-questions`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${siteUrl}/exams`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${siteUrl}/exams/mcq-packages`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${siteUrl}/exams/cq-packages`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
  ]

  const classPages = classes.map((c) => ({
    url: `${siteUrl}/class/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const subjectPages = subjects.map((s) => ({
    url: `${siteUrl}/class/${s.class.slug}/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const chapterPages = chapters.map((ch) => ({
    url: `${siteUrl}/class/${ch.subject.class.slug}/${ch.subject.slug}/${ch.slug}`,
    lastModified: ch.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const noticePages = notices.map((n) => ({
    url: `${siteUrl}/notices/${n.id}`,
    lastModified: n.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  const suggestionPages = suggestions.map((s) => ({
    url: `${siteUrl}/suggestions/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const blogPages = blogPosts.map((p) => ({
    url: `${siteUrl}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const blogCategoryPages = blogCategories.map((c) => ({
    url: `${siteUrl}/blog/category/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))

  const blogTagPages = blogTags.map((t) => ({
    url: `${siteUrl}/blog/tag/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.3,
  }))

  return [...staticPages, ...classPages, ...subjectPages, ...chapterPages, ...noticePages, ...suggestionPages, ...blogPages, ...blogCategoryPages, ...blogTagPages]
}
