import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { softDelete } from '@/lib/soft-delete'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  fetchInterval: z.number().int().min(5).optional(),
  isActive: z.boolean().optional(),
  promptConfig: z.string().nullable().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const source = await db.sourceConfig.findUnique({ where: { id } })
    if (!source) return apiError('Source not found', 404)
    return apiResponse(source)
  } catch (error) {
    return handleApiError(error, 'GET source')
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

    const existing = await db.sourceConfig.findUnique({ where: { id } })
    if (!existing) return apiError('Source not found', 404)

    // Transform promptConfig into config JSON field
    const { promptConfig, ...rest } = validated.data
    const updateData = { ...rest } as any
    if (promptConfig !== undefined) {
      updateData.config = promptConfig
    }

    const updated = await db.$transaction(async (tx) => {
      const record = await tx.sourceConfig.update({ where: { id }, data: updateData })
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_SOURCE_UPDATE, 'automation_source', id, existing as any, validated.data, tx as never)
      return record
    })

    return apiResponse(updated)
  } catch (error) {
    return handleApiError(error, 'PUT source')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const { id } = await params
    const existing = await db.sourceConfig.findUnique({ where: { id } })
    if (!existing) return apiError('Source not found', 404)

    await db.$transaction(async (tx) => {
      await softDelete(tx, 'sourceConfig', id, auth.user.id)
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_SOURCE_DELETE, 'automation_source', id, undefined, undefined, tx as never)
    })

    return apiResponse({ id })
  } catch (error) {
    return handleApiError(error, 'DELETE source')
  }
}
