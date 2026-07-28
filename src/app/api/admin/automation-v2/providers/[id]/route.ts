import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { softDelete } from '@/lib/soft-delete'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  providerType: z.enum(['GEMINI', 'OPENAI', 'OPENROUTER']).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const provider = await db.aiProviderConfig.findUnique({ where: { id } })
    if (!provider) return apiError('Provider not found', 404)
    return apiResponse({ ...provider, apiKey: provider.apiKeyEnc ? `***${provider.apiKeyEnc.slice(-4)}` : null, apiKeyEnc: undefined })
  } catch (error) {
    return handleApiError(error, 'GET provider')
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(updateSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.aiProviderConfig.findUnique({ where: { id } })
    if (!existing) return apiError('Provider not found', 404)

    const updateData: Record<string, unknown> = { ...validated.data }
    delete updateData.apiKey

    if (validated.data.apiKey) {
      const { encryptionService } = await import('@/features/automation-v2/lib/encryption-service')
      updateData.apiKeyEnc = encryptionService.encrypt(validated.data.apiKey)
    }

    const updated = await db.$transaction(async (tx) => {
      const record = await tx.aiProviderConfig.update({ where: { id }, data: updateData })
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_PROVIDER_UPDATE, 'automation_provider', id, existing as any, updateData, tx as never)
      return record
    })

    return apiResponse({ ...updated, apiKey: updated.apiKeyEnc ? `***${updated.apiKeyEnc.slice(-4)}` : null, apiKeyEnc: undefined })
  } catch (error) {
    return handleApiError(error, 'PUT provider')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const { id } = await params
    const existing = await db.aiProviderConfig.findUnique({ where: { id } })
    if (!existing) return apiError('Provider not found', 404)

    await db.$transaction(async (tx) => {
      await softDelete(tx, 'aiProviderConfig', id, auth.user.id)
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_PROVIDER_DELETE, 'automation_provider', id, undefined, undefined, tx as never)
    })

    return apiResponse({ id })
  } catch (error) {
    return handleApiError(error, 'DELETE provider')
  }
}
