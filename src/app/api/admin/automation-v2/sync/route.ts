import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { scrapeUrl, parseRssFeed } from '@/features/automation-v2/services/scraper'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'

const syncSchema = z.object({
  sourceId: z.string().min(1, 'Source ID is required'),
})

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const body = await request.json()
    const validated = validateBody(syncSchema, body)
    if ('error' in validated) return validated.error

    const { sourceId } = validated.data

    const source = await db.sourceConfig.findUnique({ where: { id: sourceId } })
    if (!source) return apiError('Source not found', 404)
    if (!source.isActive) return apiError('Source is inactive', 400)

    let importedCount = 0
    const correlationId = `sync-${sourceId}-${Date.now()}`

    if (source.sourceType === 'RSS') {
      const fetchResult = await scrapeUrl(source.url)
      const items = parseRssFeed(fetchResult.content)

      for (const item of items.slice(0, 10)) {
        const contentHash = createHash('sha256').update(item.link || item.title).digest('hex')

        const existing = await db.importedContent.findFirst({ where: { contentHash, sourceId, deletedAt: null } })
        if (existing) continue // skip duplicate

        let articleContent = item.description
        let articleTitle = item.title

        if (item.link) {
          try {
            const article = await scrapeUrl(item.link)
            articleContent = article.textContent
            articleTitle = article.title
          } catch { /* fall back to feed description */ }
        }

        await db.importedContent.create({
          data: {
            sourceId,
            sourceUrl: item.link || source.url,
            title: articleTitle,
            rawContent: item.description,
            extractedText: articleContent,
            status: 'IMPORTED',
            contentHash,
            correlationId,
          },
        })
        importedCount++
      }
    } else {
      // URL, SITEMAP, MANUAL — fetch page content
      const scraped = await scrapeUrl(source.url)
      const contentHash = createHash('sha256').update(scraped.textContent.substring(0, 10000)).digest('hex')

      const existing = await db.importedContent.findFirst({ where: { contentHash, sourceId, deletedAt: null } })
      if (!existing) {
        await db.importedContent.create({
          data: {
            sourceId,
            sourceUrl: source.url,
            title: scraped.title,
            rawContent: scraped.content,
            extractedText: scraped.textContent,
            status: 'IMPORTED',
            contentHash,
            correlationId,
          },
        })
        importedCount++
      }
    }

    // Update lastFetchedAt
    await db.sourceConfig.update({ where: { id: sourceId }, data: { lastFetchedAt: new Date() } })

    // Audit log
    await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_SOURCE_UPDATE, 'automation_source', sourceId, undefined, { sync: { importedCount, correlationId } })

    return apiResponse({ sourceId, importedCount, correlationId })
  } catch (error) {
    return handleApiError(error, 'Sync source')
  }
}
