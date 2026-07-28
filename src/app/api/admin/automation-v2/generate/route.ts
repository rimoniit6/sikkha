import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { generateContent } from '@/features/automation-v2/services/generator'
import { createDraft } from '@/features/automation-v2/services/blog'
import { validateBlocks } from '@/lib/ai-content-parser'
import logger from '@/lib/logger'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const generateSchema = z.object({
  sourceId: z.string().optional(),
  providerId: z.string().optional(),
  manualPrompt: z.string().max(2000).optional(),
  tone: z.string().optional(),
  language: z.string().optional(),
  wordCount: z.number().int().min(100).max(10000).optional(),
  publish: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const body = await request.json()
    const validated = validateBody(generateSchema, body)
    if ('error' in validated) return validated.error

    // Resolve source content
    let sourceContent = ''
    let sourceTitle = ''
    let sourceUrl = ''
    let sourceId = validated.data.sourceId

    if (validated.data.sourceId) {
      const source = await db.sourceConfig.findUnique({ where: { id: validated.data.sourceId } })
      if (!source) return apiError('Source not found', 404)
      if (!source.isActive) return apiError('Source is inactive', 400)

      const imported = await db.importedContent.findFirst({
        where: { sourceId: validated.data.sourceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      if (!imported) return apiError('No content in this source. Sync first.', 400)

      sourceContent = imported.extractedText || imported.rawContent || ''
      sourceTitle = imported.title || 'Untitled'
      sourceUrl = imported.sourceUrl || ''
    }

    // Generate content
    const result = await generateContent({
      sourceContent,
      sourceTitle,
      sourceUrl,
      sourceId,
      manualPrompt: validated.data.manualPrompt,
      providerId: validated.data.providerId,
    })

    // Validate blocks before saving — reject if invalid
    const blocksValidation = validateBlocks(result.contentBlocks)
    if (!blocksValidation.valid) {
      logger.error('Generate route: Block validation failed', blocksValidation.error)
      return apiError('AI content could not be parsed into valid blocks. Please try again with different settings.', 422)
    }

    // Create blog post with structured blocks
    const post = await createDraft({
      title: result.title,
      content: result.content,
      contentBlocks: result.contentBlocks ? JSON.stringify(result.contentBlocks) : undefined,
      excerpt: result.excerpt,
      metaDescription: result.metaDescription,
      tags: result.tags,
      authorId: auth.user.id,
      sourceId,
    })

    // Check auto-publish: either request param OR settings flag
    let shouldPublish = validated.data.publish
    if (!shouldPublish) {
      const autoSetting = await db.automationSetting.findUnique({ where: { key: 'auto_publish' } })
      shouldPublish = autoSetting?.value === 'true'
    }

    // Auto-publish if enabled
    if (shouldPublish) {
      const { publishPost } = await import('@/features/automation-v2/services/blog')
      await publishPost(post.id, auth.user.id)
      await invalidateContentCache('blog')
    }

    // Audit
    await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_CONTENT_CREATE, 'blog_post', post.id, undefined, {
      sourceId, providerType: result.model, title: result.title, durationMs: result.durationMs, tags: result.tags, autoPublished: shouldPublish,
    })

    return apiResponse({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
      durationMs: result.durationMs,
      tags: result.tags,
    }, 201)
  } catch (error) {
    return handleApiError(error, 'Generate content')
  }
}
