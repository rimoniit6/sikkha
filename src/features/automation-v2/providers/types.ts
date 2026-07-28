export type AiProviderType = 'GEMINI' | 'OPENAI' | 'OPENROUTER'

export interface AiRequest {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface AiResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  durationMs: number
}

export interface AiProvider {
  readonly name: string
  readonly type: AiProviderType
  generate(request: AiRequest): Promise<AiResponse>
  validate(): Promise<{ ok: boolean; error?: string }>
}
