import type { AiProvider, AiRequest, AiResponse, AiProviderType } from './types'

const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements AiProvider {
  readonly name: string
  readonly type: AiProviderType = 'OPENROUTER'
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(config: { apiKey: string; baseUrl?: string; model?: string; name?: string }) {
    this.name = config.name || 'OpenRouter'
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.defaultModel = config.model || DEFAULT_MODEL
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const model = request.model || this.defaultModel
    const url = `${this.baseUrl}/chat/completions`
    const startTime = Date.now()

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ]

    const body = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://sikkha.app',
        'X-Title': 'Sikkha AI Automation',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`)
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    const text = data?.choices?.[0]?.message?.content || ''
    const durationMs = Date.now() - startTime
    const promptTokens = data?.usage?.prompt_tokens ?? 0
    const completionTokens = data?.usage?.completion_tokens ?? 0

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
      const url = `${this.baseUrl}/models`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      })
      return { ok: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
