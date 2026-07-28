import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody, paginatedApiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SUPPORTED_TYPES = ['GEMINI', 'OPENAI', 'OPENROUTER'] as const

const providerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  providerType: z.enum(SUPPORTED_TYPES),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const where: Record<string, unknown> = { deletedAt: null }
    if (searchParams.get('isActive') === 'true') where.isActive = true
    if (searchParams.get('isActive') === 'false') where.isActive = false

    const [data, total] = await Promise.all([
      db.aiProviderConfig.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.aiProviderConfig.count({ where }),
    ])

    return paginatedApiResponse(
      data.map(p => ({ ...p, apiKey: p.apiKeyEnc ? `***${p.apiKeyEnc.slice(-4)}` : null, apiKeyEnc: undefined })),
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    )
  } catch (error) {
    return handleApiError(error, 'GET providers')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const body = await request.json()
    const validated = validateBody(providerSchema, body)
    if ('error' in validated) return validated.error

    const { apiKey, ...data } = validated.data
    const { encryptionService } = await import('@/features/automation-v2/lib/encryption-service')
    const encryptedKey = encryptionService.encrypt(apiKey)

    const created = await db.$transaction(async (tx) => {
      const record = await tx.aiProviderConfig.create({
        data: { ...data, apiKeyEnc: encryptedKey, displayName: data.name },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_PROVIDER_CREATE, 'automation_provider', record.id, undefined, { providerType: data.providerType, name: data.name }, tx as never)
      return record
    })

    return apiResponse({ ...created, apiKey: `***${created.apiKeyEnc?.slice(-4)}`, apiKeyEnc: undefined }, 201)
  } catch (error) {
    return handleApiError(error, 'POST provider')
  }
}
