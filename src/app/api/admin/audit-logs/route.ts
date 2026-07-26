import { db } from '@/lib/db'
import { apiResponse, paginatedApiResponse, apiError, withAdmin } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuditLog, getClientIP, AuditActions } from '@/lib/audit'

// ============================================================
// Admin Audit Log API
// Supports:
//   - List with pagination, search, date filter, action filter, user filter
//   - Detail view by id
// GET params (list):
//   page, limit          pagination
//   q                    free-text search (action / entityType / entityId)
//   action               exact action filter
//   adminId              admin/user filter
//   entityType           entity type filter
//   sessionId            session ID filter
//   requestId            request ID filter
//   correlationId        correlation ID filter
//   from, to             ISO date range filter (createdAt)
// GET params (detail):
//   id                   single audit log id
// ============================================================

// ── Zod validation schema (exported for testing) ──────────────────
export const auditLogQuerySchema = z.object({
  id: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(20),
  q: z.string().trim().max(500).optional(),
  action: z.string().trim().optional(),
  adminId: z.string().trim().min(1).optional(),
  entityType: z.string().trim().optional(),
  sessionId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  from: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid date format for \"from\"',
  }).optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid date format for \"to\"',
  }).optional(),
  export: z.coerce.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)

    // ── Parse and validate query params with Zod ──────────────────
    let parsed: z.infer<typeof auditLogQuerySchema>
    try {
      const raw = Object.fromEntries(searchParams.entries())
      parsed = auditLogQuerySchema.parse(raw)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
        return apiError('ভ্যালিডেশন ব্যর্থ', 422, 'VALIDATION_ERROR', details)
      }
      throw err
    }

    const { id, page, limit, q, action, adminId, entityType, sessionId, requestId, correlationId, from, to, export: isExport } = parsed

    // ── Detail view ─────────────────────────────────────────────
    if (id) {
      const log = await db.auditLog.findUnique({
        where: { id },
        include: {
          admin: { select: { id: true, name: true, email: true, role: true } },
        },
      })
      if (!log) return apiError('Audit log not found', 404, 'NOT_FOUND')

      // Record the view for audit trail
      void createAuditLog({
        adminId: auth.user.id,
        action: AuditActions.AUDIT_LOG_VIEW,
        entityType: 'audit_log',
        entityId: id,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      })

      return apiResponse(mapLog(log))
    }

    // ── List view ───────────────────────────────────────────────

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (adminId) where.adminId = adminId
    if (entityType) where.entityType = entityType
    if (sessionId) where.sessionId = sessionId
    if (requestId) where.requestId = requestId
    if (correlationId) where.correlationId = correlationId
    if (from || to) {
      where.createdAt = {}
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Record export events for audit trail (fire-and-forget)
    if (isExport) {
      void createAuditLog({
        adminId: auth.user.id,
        action: AuditActions.AUDIT_LOG_EXPORT,
        entityType: 'audit_log',
        entityId: `export-${Date.now()}`,
        newData: { q, action, adminId, entityType, from, to, total, limit } as Record<string, unknown>,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      })
    }

    return paginatedApiResponse(
      data.map(mapLog),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    )
  } catch (error) {
    return handleApiError(error, 'Admin Audit Logs List')
  }
}

function mapLog(log: Record<string, unknown>) {
  return {
    id: log.id,
    adminId: log.adminId,
    admin: log.admin ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    oldData: parseJsonSafe(log.oldData),
    newData: parseJsonSafe(log.newData),
    ipAddress: log.ipAddress ?? null,
    userAgent: log.userAgent ?? null,
    userName: log.userName ?? null,
    userRole: log.userRole ?? null,
    status: log.status ?? 'success',
    duration: log.duration ?? null,
    os: log.os ?? null,
    browser: log.browser ?? null,
    country: log.country ?? null,
    sessionId: log.sessionId ?? null,
    requestId: log.requestId ?? null,
    correlationId: log.correlationId ?? null,
    createdAt: log.createdAt,
    deletedAt: log.deletedAt ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonSafe(value: unknown): any {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
