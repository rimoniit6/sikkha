import type { AiProvider, AiRequest, AiResponse, AiProviderType } from './types'

const DEFAULT_MODEL = 'gemini-2.0-flash'

export class GeminiProvider implements AiProvider {
  readonly name: string
  readonly type: AiProviderType = 'GEMINI'
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(config: { apiKey: string; baseUrl?: string; model?: string; name?: string }) {
    this.name = config.name || 'Gemini'
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
    this.defaultModel = config.model || DEFAULT_MODEL
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const model = request.model || this.defaultModel
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`
    const startTime = Date.now()

    const body = {
      contents: [
        {
          parts: [
            { text: request.systemPrompt ? `${request.systemPrompt}\n\n${request.userPrompt}` : request.userPrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Gemini API error ${response.status}: ${errorBody}`)
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || ''
    const durationMs = Date.now() - startTime
    const promptTokens = data?.usageMetadata?.promptTokenCount ?? 0
    const completionTokens = data?.usageMetadata?.candidatesTokenCount ?? 0

    return {
      content: text,
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      durationMs,
    }
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    try {
      const url = `${this.baseUrl}/models?key=${this.apiKey}`
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      return { ok: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
