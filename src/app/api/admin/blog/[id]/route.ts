import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import logger from '@/lib/logger'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { softDelete } from '@/lib/soft-delete'
import { sanitizeForStorage } from '@/lib/sanitize'
import { generateUniqueSlug } from '@/lib/slug-unique'

const updateBlogSchema = z.object({
  title: z.string().min(1, 'শিরোনাম আবশ্যক').optional(),
  slug: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().optional(),
  contentBlocks: z.string().nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  robots: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const data = await db.blogPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    })

    if (!data) {
      return apiError('ব্লগ পোস্ট খুঁজে পাওয়া যায়নি', 404)
    }

    return apiResponse(data)
  } catch (error) {
    return handleApiError(error, 'Admin Get Blog Post')
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(updateBlogSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.blogPost.findUnique({ where: { id } })
    if (!existing) {
      return apiError('ব্লগ পোস্ট খুঁজে পাওয়া যায়নি', 404)
    }

    const { tagIds, content, contentBlocks, publishedAt, scheduledAt, ...rest } = validated.data

    const data = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}

      for (const key of Object.keys(rest)) {
        if (rest[key as keyof typeof rest] !== undefined) {
          updateData[key] = rest[key as keyof typeof rest]
        }
      }

      if (content !== undefined) {
        updateData.content = sanitizeForStorage(content)
        updateData.readingTime = calculateReadingTime(content)
      }

      if (contentBlocks !== undefined) {
        updateData.contentBlocks = contentBlocks
      }

      if (rest.slug) {
        const uniqueSlug = await generateUniqueSlug('blogPost', generateSlug(rest.slug), id, tx)
        updateData.slug = uniqueSlug
      }

      if (publishedAt !== undefined) {
        updateData.publishedAt = publishedAt ? new Date(publishedAt) : null
      }
      if (scheduledAt !== undefined) {
        updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
      }

      if (tagIds !== undefined) {
        await (tx as any).blogPostTag.deleteMany({ where: { postId: id } })
        if (tagIds.length > 0) {
          await (tx as any).blogPostTag.createMany({
            data: tagIds.map((tagId: string) => ({ postId: id, tagId })),
          })
        }
      }

      const updated = await (tx as any).blogPost.update({
        where: { id },
        data: updateData,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
      })

      await auditFromRequest(request, auth.user.id, AuditActions.BLOG_UPDATE, 'blog_post', id, existing, undefined, tx as never)
      return updated
    })

    await invalidateContentCache('blog')
    return apiResponse(data)
  } catch (error) {
    logger.error('Admin Update Blog Post', error, { route: 'admin/blog/[id]', method: 'PUT' })
    return handleApiError(error, 'Admin Update Blog Post')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const existing = await db.blogPost.findUnique({ where: { id } })
    if (!existing) {
      return apiError('ব্লগ পোস্ট খুঁজে পাওয়া যায়নি', 404)
    }

    await db.$transaction(async (tx) => {
      await softDelete(tx, 'blogPost', id, auth.user.id)
      await auditFromRequest(request, auth.user.id, AuditActions.BLOG_DELETE, 'blog_post', id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('blog')
    return apiResponse({ id }, 'ব্লগ পোস্ট সফলভাবে মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Admin Delete Blog Post')
  }
}
