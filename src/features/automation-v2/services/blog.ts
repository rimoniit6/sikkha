import { db } from '@/lib/db'
import { sanitizeForStorage } from '@/lib/sanitize'
import { serializeBlocksForStorage } from '@/lib/ai-content-parser'
import type { BlogContentBlock } from '@/features/blog/blocks/blog-block-types'

export interface CreatePostInput {
  title: string
  content: string
  contentBlocks?: string          // JSON string of BlogContentBlock[]
  excerpt?: string
  metaDescription?: string
  tags?: string[]
  authorId: string
  sourceId?: string
  correlationId?: string
}

export interface PublishResult {
  success: boolean
  postId?: string
  error?: string
}

function calculateReadingTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

/**
 * Calculate reading time from blocks instead of raw HTML.
 */
function calculateReadingTimeFromBlocks(blocks: BlogContentBlock[]): number {
  const text = blocks
    .map(b => {
      if ('content' in b && typeof b.content === 'string') return b.content.replace(/<[^>]*>/g, '')
      return ''
    })
    .join(' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

/**
 * Create a blog post as DRAFT.
 * AI-generated content is stored as structured blocks in both `content` and `contentBlocks` fields.
 */
export async function createDraft(input: CreatePostInput) {
  // Generate unique slug
  let slug = input.title
    .toLowerCase()
    .replace(/[^\w০-৯এ-ঔা-ী-ৃে-োৎঐঔ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200) || `post-${Date.now()}`

  const existingSlug = await db.blogPost.findUnique({ where: { slug } })
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  // Use contentBlocks for reading time if available
  const hasBlocks = !!input.contentBlocks
  let readingTime: number

  if (hasBlocks) {
    try {
      const parsedBlocks = JSON.parse(input.contentBlocks!) as BlogContentBlock[]
      readingTime = calculateReadingTimeFromBlocks(parsedBlocks)
    } catch {
      readingTime = calculateReadingTime(input.content)
    }
  } else {
    readingTime = calculateReadingTime(input.content)
  }

  // Create post with tags
  const post = await db.blogPost.create({
    data: {
      title: input.title.substring(0, 500),
      slug,
      excerpt: input.excerpt?.substring(0, 500) || null,
      content: sanitizeForStorage(input.content),
      // Store structured blocks in contentBlocks for proper editor rendering
      contentBlocks: input.contentBlocks || null,
      readingTime,
      authorId: input.authorId,
      status: 'DRAFT',
      metaTitle: input.title.substring(0, 60),
      metaDescription: input.metaDescription?.substring(0, 160) || null,
      automationCorrelationId: input.correlationId || `gen-${input.sourceId || 'manual'}-${Date.now()}`,
      tags: (input.tags || []).slice(0, 10).length > 0 ? {
        create: (input.tags || []).slice(0, 10).map((tag) => {
          const tagSlug = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0980-\u09FF-]/g, '').substring(0, 100) || `tag-${Date.now()}`
          return {
            tag: {
              connectOrCreate: {
                where: { slug: tagSlug },
                create: { name: tag.substring(0, 100), slug: tagSlug },
              },
            },
          }
        }),
      } : undefined,
    },
    include: { tags: { include: { tag: true } } },
  })

  return post
}

/**
 * Publish a draft blog post.
 */
export async function publishPost(postId: string, userId: string): Promise<PublishResult> {
  const post = await db.blogPost.findUnique({ where: { id: postId } })
  if (!post) return { success: false, error: 'Post not found' }
  if (post.status === 'PUBLISHED') return { success: false, error: 'Post already published' }

  // Calculate reading time if not already set
  const updateData: Record<string, unknown> = { status: 'PUBLISHED', publishedAt: new Date() }
  if (!post.readingTime) {
    updateData.readingTime = calculateReadingTime(post.content)
  }

  await db.blogPost.update({
    where: { id: postId },
    data: updateData,
  })

  return { success: true, postId }
}

/**
 * Unpublish a published blog post.
 */
export async function unpublishPost(postId: string): Promise<PublishResult> {
  const post = await db.blogPost.findUnique({ where: { id: postId } })
  if (!post) return { success: false, error: 'Post not found' }
  if (post.status !== 'PUBLISHED') return { success: false, error: 'Post is not published' }

  await db.blogPost.update({
    where: { id: postId },
    data: { status: 'DRAFT', publishedAt: null },
  })

  return { success: true, postId }
}
