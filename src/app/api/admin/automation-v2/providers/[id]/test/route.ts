import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { GeminiProvider } from '@/features/automation-v2/providers/gemini'
import { OpenAIProvider } from '@/features/automation-v2/providers/openai'
import { OpenRouterProvider } from '@/features/automation-v2/providers/openrouter'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const { id } = await params
    const provider = await db.aiProviderConfig.findUnique({ where: { id } })
    if (!provider) return apiError('Provider not found', 404)
    if (!provider.apiKeyEnc) return apiError('No API key configured', 400)

    const { encryptionService } = await import('@/features/automation-v2/lib/encryption-service')
    let apiKey: string
    try { apiKey = encryptionService.decrypt(provider.apiKeyEnc) } catch { return apiError('Failed to decrypt API key', 500) }

    const startTime = Date.now()
    let result: { ok: boolean; error?: string }

    try {
      switch (provider.providerType) {
        case 'GEMINI':
          result = await new GeminiProvider({ apiKey, baseUrl: provider.baseUrl || undefined, model: provider.defaultModel || undefined }).validate()
          break
        case 'OPENAI':
          result = await new OpenAIProvider({ apiKey, baseUrl: provider.baseUrl || undefined, model: provider.defaultModel || undefined }).validate()
          break
        case 'OPENROUTER':
          result = await new OpenRouterProvider({ apiKey, baseUrl: provider.baseUrl || undefined, model: provider.defaultModel || undefined }).validate()
          break
        default:
          return apiError('Unsupported provider type', 400)
      }
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }

    return apiResponse({ ok: result.ok, message: result.ok ? 'Connection successful' : (result.error || 'Connection failed'), durationMs: Date.now() - startTime })
  } catch (error) {
    return handleApiError(error, 'Test provider')
  }
}
