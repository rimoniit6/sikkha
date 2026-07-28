import { db } from '@/lib/db'
import { GeminiProvider } from '../providers/gemini'
import { OpenAIProvider } from '../providers/openai'
import { OpenRouterProvider } from '../providers/openrouter'
import type { AiProviderType, AiResponse } from '../providers/types'
import type { BlogContentBlock } from '@/features/blog/blocks/blog-block-types'
import { convertAiToBlogBlocks, validateBlocks, serializeBlocksForStorage } from '@/lib/ai-content-parser'
import {
  getEffectiveSystemPrompt,
  buildPromptVariables,
  injectVariables,
} from './prompt'
import logger from '@/lib/logger'

export interface GenerateInput {
  sourceContent?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceId?: string
  manualPrompt?: string
  providerId?: string
  tone?: string
  language?: string
  wordCount?: number
}

export interface GenerateResult {
  title: string
  content: string
  excerpt: string
  tags: string[]
  metaDescription: string
  contentBlocks: BlogContentBlock[]  // Parse AI output into structured blocks
  model: string
  durationMs: number
}

// SYSTEM_PROMPT is no longer a constant — replaced by PromptService.
// See src/features/automation-v2/services/prompt.ts

/**
 * Resolve an AI provider from a DB config record.
 */
async function resolveProvider(record: { id: string; name: string; providerType: string; apiKeyEnc?: string | null; baseUrl?: string | null; defaultModel?: string | null }) {
  if (!record.apiKeyEnc) throw new Error('API key not configured')

  // Decrypt API key using the encryption service
  const { encryptionService } = await import('@/features/automation-v2/lib/encryption-service')
  const apiKey = encryptionService.decrypt(record.apiKeyEnc)

  const config = { apiKey, baseUrl: record.baseUrl || undefined, name: record.name }

  switch (record.providerType) {
    case 'GEMINI':
      return { provider: new GeminiProvider({ ...config, model: record.defaultModel || undefined }), type: 'GEMINI' as AiProviderType }
    case 'OPENAI':
      return { provider: new OpenAIProvider({ ...config, model: record.defaultModel || undefined }), type: 'OPENAI' as AiProviderType }
    case 'OPENROUTER':
      return { provider: new OpenRouterProvider({ ...config, model: record.defaultModel || undefined }), type: 'OPENROUTER' as AiProviderType }
    default:
      throw new Error(`Unsupported provider type: ${record.providerType}`)
  }
}

/**
 * Generate content from a source using an AI provider.
 */
export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  // Resolve provider from DB
  let providerRecord
  if (input.providerId) {
    providerRecord = await db.aiProviderConfig.findUnique({ where: { id: input.providerId } })
    if (!providerRecord) throw new Error('Provider not found')
    if (!providerRecord.isActive) throw new Error('Provider is inactive')
  } else {
    // Fall back to first active provider
    providerRecord = await db.aiProviderConfig.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!providerRecord) throw new Error('No active provider found. Create and activate a provider first.')
  }

  const { provider } = await resolveProvider(providerRecord)

  // Build prompt — use per-source prompt when available
  const contentForAI = input.sourceContent || input.manualPrompt || ''
  const titleForAI = input.sourceTitle || 'AI Generated Content'

  const userPrompt = `উৎস কন্টেন্ট:\n\nশিরোনাম: ${titleForAI}\nURL: ${input.sourceUrl || 'N/A'}\n\nকন্টেন্ট:\n${contentForAI.substring(0, 15000)}`

  // Resolve effective system prompt (per-source → global → default)
  const { systemPrompt: basePrompt } = await getEffectiveSystemPrompt(
    input.sourceId,
    input.manualPrompt,
  )

  // Inject source-specific variables into the prompt
  const variables = buildPromptVariables({
    title: titleForAI,
    content: contentForAI.substring(0, 5000),
    url: input.sourceUrl,
    source_name: input.sourceId ? (await db.sourceConfig.findUnique({ where: { id: input.sourceId }, select: { name: true } }))?.name : undefined,
    language: input.language || 'bn',
  })
  const systemPrompt = injectVariables(basePrompt, variables)

  // Call AI provider
  const startTime = Date.now()
  const result = await provider.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 8192,
    temperature: 0.7,
  })
  const durationMs = Date.now() - startTime

  // Parse response
  return parseAiResponse(result, titleForAI, durationMs)
}

function parseAiResponse(result: AiResponse, fallbackTitle: string, durationMs: number): GenerateResult {
  try {
    let jsonStr = result.content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1].trim()
    const parsed = JSON.parse(jsonStr)

    const title = parsed.title || fallbackTitle
    const excerpt = parsed.excerpt || result.content.substring(0, 200)
    const metaDescription = parsed.metaDescription || result.content.substring(0, 160)
    const tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : []

    // Parse the content field (now expected to be Markdown) into structured blocks
    const rawContent = parsed.content || result.content
    const blockResult = convertAiToBlogBlocks(rawContent, title)
    const contentBlocks = blockResult.blocks

    // Validate blocks
    const validation = validateBlocks(contentBlocks)
    if (!validation.valid) {
      logger.error('AI Content: Block validation failed', new Error(validation.error || 'Unknown'), { context: 'ai-parser' })
      // Fallback: if parsing fails, create a single richtext block
      return {
        title,
        content: rawContent,
        excerpt,
        tags,
        metaDescription,
        contentBlocks: [{
          id: `block-${Date.now()}-ai`,
          type: 'richtext' as const,
          content: rawContent,
        }],
        model: result.model,
        durationMs,
      }
    }

    if (blockResult.error) {
      logger.warn('AI Content: Partial parse warning', { error: blockResult.error, title })
    }

    return {
      title,
      content: serializeBlocksForStorage(contentBlocks),
      excerpt,
      tags,
      metaDescription,
      contentBlocks,
      model: result.model,
      durationMs,
    }
  } catch (err) {
    // Fallback: treat entire response as raw content wrapped in a richtext block
    logger.error('AI Content: JSON parse failed, using raw fallback', err instanceof Error ? err : new Error('Unknown error'), { context: 'ai-parser' })
    const rawContent = result.content
    return {
      title: fallbackTitle,
      content: rawContent,
      excerpt: rawContent.substring(0, 200),
      tags: [],
      metaDescription: rawContent.substring(0, 160),
      contentBlocks: [{
        id: `block-${Date.now()}-ai`,
        type: 'richtext' as const,
        content: rawContent,
      }],
      model: result.model,
      durationMs,
    }
  }
}
