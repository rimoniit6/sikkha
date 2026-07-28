import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, validateBody, paginatedApiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Match existing DB enum values for SourceConfig.sourceType
const SOURCE_TYPES = ['RSS', 'SITEMAP', 'WEBSITE', 'MANUAL_URL'] as const

const sourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sourceType: z.enum(SOURCE_TYPES),
  contentType: z.string().min(1).default('article'),
  url: z.string().min(1, 'URL is required'),
  fetchInterval: z.number().int().min(5).optional().default(60),
  isActive: z.boolean().optional().default(true),
  promptConfig: z.string().nullable().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const where: Record<string, unknown> = { deletedAt: null }
    if (searchParams.get('sourceType')) where.sourceType = searchParams.get('sourceType')
    if (searchParams.get('isActive') === 'true') where.isActive = true
    if (searchParams.get('isActive') === 'false') where.isActive = false

    const [data, total] = await Promise.all([
      db.sourceConfig.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.sourceConfig.count({ where }),
    ])

    return paginatedApiResponse(data, { page, limit, total, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    return handleApiError(error, 'GET sources')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const body = await request.json()
    const validated = validateBody(sourceSchema, body)
    if ('error' in validated) return validated.error

    // Transform promptConfig into config JSON field
    const { promptConfig, ...rest } = validated.data
    const createData = { ...rest } as any
    if (promptConfig) {
      createData.config = promptConfig
    }

    const created = await db.$transaction(async (tx) => {
      const record = await tx.sourceConfig.create({ data: createData })
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_SOURCE_CREATE, 'automation_source', record.id, undefined, { name: validated.data.name, sourceType: validated.data.sourceType }, tx as never)
      return record
    })

    return apiResponse(created, 201)
  } catch (error) {
    return handleApiError(error, 'POST source')
  }
}
