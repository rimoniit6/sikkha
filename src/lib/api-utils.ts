import type { Role } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { ZodError,ZodSchema } from 'zod'
import { requireAdmin,requireAuth,requireRole,requireSuperAdmin,type AuthResult } from './auth'
import { csrfMiddleware } from './csrf'
import { apiLimiter,getClientIdentifier,RateLimiter,rateLimitHeaders,type RateLimitResult } from './rate-limit'

export interface PaginationInput {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function apiResponse<T>(data: T, messageOrStatus?: string | number | null, status?: number, headers?: Record<string, string>) {
  let message: string | null = null
  let finalStatus = 200

  if (typeof messageOrStatus === 'number') {
    finalStatus = messageOrStatus
  } else if (typeof messageOrStatus === 'string') {
    message = messageOrStatus
    if (status !== undefined) finalStatus = status
  } else if (messageOrStatus === null) {
    if (status !== undefined) finalStatus = status
  }

  return NextResponse.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status: finalStatus, ...(headers ? { headers } : {}) }
  )
}

export function paginatedApiResponse<T>(data: T, pagination: PaginationInput, status = 200) {
  return NextResponse.json(
    { success: true, data, pagination },
    { status }
  )
}

export function apiError(message: string, status = 400, code?: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
    { status }
  )
}

export function unauthorized(message = 'প্রমাণীকরণ প্রয়োজন। অনুগ্রহ করে লগইন করুন।') {
  return apiError(message, 401, 'UNAUTHORIZED')
}

export function forbidden(message = 'এই কাজের জন্য অনুমতি নেই।') {
  return apiError(message, 403, 'FORBIDDEN')
}

export function notFound(message = 'তথ্য খুঁজে পাওয়া যায়নি।') {
  return apiError(message, 404, 'NOT_FOUND')
}

export function rateLimitExceeded(result: RateLimitResult) {
  const headers = rateLimitHeaders(result)
  return NextResponse.json(
    {
      success: false,
      error: 'অনেক বেশি অনুরোধ। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    { status: 429, headers }
  )
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): { data: T } | { error: NextResponse } {
  try {
    return { data: schema.parse(body) }
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return { error: apiError('ইনপুট ভ্যালিডেশন ব্যর্থ', 422, 'VALIDATION_ERROR', errors) }
    }
    throw err
  }
}

export async function applyRateLimit(limiter: RateLimiter, request: Request): Promise<{ result: RateLimitResult } | { error: NextResponse }> {
  const identifier = getClientIdentifier(request)
  const result = await limiter.limit(identifier)
  if (!result.success) {
    return { error: rateLimitExceeded(result) }
  }
  return { result }
}

export async function withAuth(request: Request): Promise<AuthResult | NextResponse> {
  try {
    return await requireAuth(request)
  } catch {
    return unauthorized()
  }
}

export async function withRole(request: Request, ...roles: Role[]): Promise<AuthResult | NextResponse> {
  try {
    return await requireRole(request, ...roles)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AuthenticationError') return unauthorized()
    return forbidden()
  }
}

export async function withAdmin(request: Request): Promise<AuthResult | NextResponse> {
  try {
    const auth = await requireAdmin(request)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const rateCheck = await applyRateLimit(apiLimiter, request)
      if ('error' in rateCheck) return rateCheck.error
    }
    return auth
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AuthenticationError') return unauthorized()
    return forbidden('এই কাজের জন্য অ্যাডমিন অনুমতি প্রয়োজন।')
  }
}

export async function withSuperAdmin(request: Request): Promise<AuthResult | NextResponse> {
  try {
    return await requireSuperAdmin(request)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AuthenticationError') return unauthorized()
    return forbidden('এই কাজের জন্য সুপার অ্যাডমিন অনুমতি প্রয়োজন।')
  }
}

export function parseIdsParam(searchParams: URLSearchParams): string[] | null {
  const ids = searchParams.get('ids')
  if (!ids) return null
  const parts = ids.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : null
}

export function parseBulkActionBody(body: Record<string, unknown>): {
  ids: string[]
  action?: string
} | { error: NextResponse } {
  const ids = body.ids as string[] | undefined
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: apiError('কমপক্ষে একটি ID প্রয়োজন', 400) }
  }
  return { ids, action: typeof body.action === 'string' ? body.action : undefined }
}

export function parsePaginationParams(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  return { page, limit }
}

export async function assertCsrf(request: Request): Promise<NextResponse | null> {
  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error
  return null
}

export async function withCsrf(request: Request): Promise<{ valid: true } | { error: NextResponse }> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return { valid: true as const }
  }
  const result = await csrfMiddleware(request)
  if (!result.valid) {
    const hasHeader = !!request.headers.get('x-csrf-token')
    let bodyHasCsrf = false
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const ct = request.headers.get('content-type')
      if (ct?.includes('application/json')) {
        try {
          const body = await request.clone().json()
          bodyHasCsrf = !!body._csrf
        } catch { /* ignore */ }
      }
    }
    if (!hasHeader && !bodyHasCsrf) {
      return { error: apiError('CSRF টোকেন প্রদান করা হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।', 403, 'CSRF_MISSING') }
    }
    return { error: apiError('CSRF টোকেন বৈধ নয়। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।', 403, 'CSRF_INVALID') }
  }
  return { valid: true as const }
}
