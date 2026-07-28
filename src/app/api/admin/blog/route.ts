import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf, paginatedApiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import logger from '@/lib/logger'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { sanitizeForStorage } from '@/lib/sanitize'
import { generateUniqueSlug } from '@/lib/slug-unique'
import { validateAllHtmlBlocks } from '@/lib/html-validation'

const createBlogSchema = z.object({
  title: z.string().min(1, 'শিরোনাম আবশ্যক'),
  slug: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().optional().default(''),
  contentBlocks: z.string().nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
  publishedAt: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  isFeatured: z.boolean().optional().default(false),
  isPinned: z.boolean().optional().default(false),
  allowComments: z.boolean().optional().default(true),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  robots: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional().default([]),
})

function calculateReadingTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '') || 'untitled'
}

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const authorId = searchParams.get('authorId')
    const search = searchParams.get('search')
    const featured = searchParams.get('featured')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { deletedAt: null }
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (authorId) where.authorId = authorId
    if (featured === 'true') where.isFeatured = true
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      db.blogPost.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.blogPost.count({ where }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Blog Posts')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validated = validateBody(createBlogSchema, body)
    if ('error' in validated) return validated.error

    const { tagIds, content, contentBlocks, publishedAt, scheduledAt, ...rest } = validated.data

    // Validate HTML block sizes before saving
    if (contentBlocks) {
      try {
        const blocks = JSON.parse(contentBlocks)
        if (Array.isArray(blocks)) {
          const blockErr = validateAllHtmlBlocks(blocks)
          if (blockErr) return apiError(blockErr, 422)
        }
      } catch {
        // Invalid JSON — let sanitizeForStorage handle it
      }
    }

    const slug = rest.slug || generateSlug(rest.title)
    const readingTime = calculateReadingTime(content || '')

    const data = await db.$transaction(async (tx) => {
      const uniqueSlug = await generateUniqueSlug('blogPost', slug, undefined, tx)

      const created = await (tx as any).blogPost.create({
        data: {
          ...rest,
          slug: uniqueSlug,
          content: sanitizeForStorage(content || ''),
          contentBlocks: contentBlocks || null,
          readingTime,
          publishedAt: publishedAt ? new Date(publishedAt) : rest.status === 'PUBLISHED' ? new Date() : null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          authorId: auth.user.id,
          tags: tagIds.length > 0
            ? { create: tagIds.map((tagId: string) => ({ tagId })) }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
      })

      await auditFromRequest(request, auth.user.id, AuditActions.BLOG_CREATE, 'blog_post', created.id, body, undefined, tx as never)
      return created
    })

    await invalidateContentCache('blog')
    return apiResponse(data, 201)
  } catch (error) {
    logger.error('Admin Create Blog Post', error, { route: 'admin/blog', method: 'POST' })
    return handleApiError(error, 'Admin Create Blog Post')
  }
}
