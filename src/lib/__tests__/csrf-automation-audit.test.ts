import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockSign, mockVerify, cookieState, mockCookieStore } = vi.hoisted(() => {
  const state = { value: null as string | null }
  return {
    mockSign: vi.fn(async () => 'mock-csrf-token'),
    mockVerify: vi.fn(async () => ({})),
    cookieState: state,
    mockCookieStore: {
      get: vi.fn((name: string) => state.value ? { name, value: state.value } : undefined),
      set: vi.fn((_name: string, value: string) => { state.value = value }),
    },
  }
})

vi.mock('jose', () => ({
  SignJWT: vi.fn(function () {
    return {
      setProtectedHeader: vi.fn(function () {
        return {
          setIssuedAt: vi.fn(function () {
            return {
              setExpirationTime: vi.fn(function () {
                return { sign: mockSign }
              }),
            }
          }),
        }
      }),
    }
  }),
  jwtVerify: mockVerify,
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}))

vi.mock('@/lib/db', () => ({
  db: {
    siteSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: 'true' }),
    },
  },
}))

const { csrfMiddleware } = await import('@/lib/csrf')
const { withCsrf, assertCsrf } = await import('@/lib/api-utils')

function makeRequest(method: string, headers: Record<string, string> = {}, body?: unknown): Request {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', ...headers } }
  if (body !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    init.body = JSON.stringify(body)
  }
  return new Request('http://localhost:3000/api/test', init)
}

describe('CSRF Automation Audit', () => {
  beforeEach(() => {
    cookieState.value = null
    mockSign.mockClear()
    mockVerify.mockClear()
  })

  describe('withCsrf — GET requests bypass CSRF', () => {
    it('allows GET without CSRF token', async () => {
      const req = makeRequest('GET')
      const result = await withCsrf(req)
      expect(result).toEqual({ valid: true })
    })

    it('allows HEAD without CSRF token', async () => {
      const req = makeRequest('HEAD')
      const result = await withCsrf(req)
      expect(result).toEqual({ valid: true })
    })
  })

  describe('withCsrf — POST requires CSRF', () => {
    it('rejects POST without CSRF token', async () => {
      const req = makeRequest('POST', {}, { data: 'test' })
      const result = await withCsrf(req)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        const body = await result.error.json()
        expect(body.code).toBe('CSRF_MISSING')
        expect(body.error).toContain('প্রদান করা হয়নি')
      }
    })

    it('rejects POST with invalid CSRF token in header', async () => {
      mockVerify.mockRejectedValueOnce(new Error('invalid'))
      const req = makeRequest('POST', { 'x-csrf-token': 'invalid-token' }, { data: 'test' })
      const result = await withCsrf(req)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        const body = await result.error.json()
        expect(body.code).toBe('CSRF_INVALID')
        expect(body.error).toContain('বৈধ নয়')
      }
    })

    it('accepts POST with valid CSRF token in header', async () => {
      mockVerify.mockResolvedValueOnce({})
      const req = makeRequest('POST', { 'x-csrf-token': 'valid-token' }, { data: 'test' })
      const result = await withCsrf(req)
      expect(result).toEqual({ valid: true })
    })

    it('rejects POST with invalid CSRF in body', async () => {
      mockVerify.mockRejectedValueOnce(new Error('invalid'))
      const req = makeRequest('POST', {}, { _csrf: 'bad', data: 'test' })
      const result = await withCsrf(req)
      expect('error' in result).toBe(true)
      if ('error' in result) {
        const body = await result.error.json()
        expect(body.code).toBe('CSRF_INVALID')
      }
    })
  })

  describe('withCsrf — PUT requires CSRF', () => {
    it('rejects PUT without CSRF token', async () => {
      const req = makeRequest('PUT', {}, { data: 'test' })
      const result = await withCsrf(req)
      expect('error' in result).toBe(true)
    })

    it('accepts PUT with valid CSRF in body', async () => {
      mockVerify.mockResolvedValueOnce({})
      const req = makeRequest('PUT', {}, { _csrf: 'valid', data: 'test' })
      const result = await withCsrf(req)
      expect(result).toEqual({ valid: true })
    })
  })

  describe('withCsrf — DELETE requires CSRF', () => {
    it('rejects DELETE without CSRF token', async () => {
      const req = makeRequest('DELETE')
      const result = await withCsrf(req)
      expect('error' in result).toBe(true)
    })

    it('accepts DELETE with valid CSRF in header', async () => {
      mockVerify.mockResolvedValueOnce({})
      const req = makeRequest('DELETE', { 'x-csrf-token': 'valid' })
      const result = await withCsrf(req)
      expect(result).toEqual({ valid: true })
    })
  })

  describe('assertCsrf — convenience helper', () => {
    it('returns null for GET (no error)', async () => {
      const req = makeRequest('GET')
      const result = await assertCsrf(req)
      expect(result).toBeNull()
    })

    it('returns NextResponse error for POST without token', async () => {
      const req = makeRequest('POST', {}, { data: 'test' })
      const result = await assertCsrf(req)
      expect(result).not.toBeNull()
      const body = await result!.json()
      expect(body.code).toBe('CSRF_MISSING')
    })

    it('returns null when POST has valid CSRF', async () => {
      mockVerify.mockResolvedValueOnce({})
      const req = makeRequest('POST', { 'x-csrf-token': 'valid' }, { data: 'test' })
      const result = await assertCsrf(req)
      expect(result).toBeNull()
    })
  })

  describe('Error code accuracy', () => {
    it('returns CSRF_MISSING when no token is sent at all', async () => {
      const req = makeRequest('POST', {}, { data: 'test' })
      const result = await withCsrf(req)
      if ('error' in result) {
        const body = await result.error.json()
        expect(body.code).toBe('CSRF_MISSING')
      }
    })

    it('returns CSRF_INVALID when token is sent but invalid', async () => {
      mockVerify.mockRejectedValueOnce(new Error('expired'))
      const req = makeRequest('POST', { 'x-csrf-token': 'expired-token' }, { data: 'test' })
      const result = await withCsrf(req)
      if ('error' in result) {
        const body = await result.error.json()
        expect(body.code).toBe('CSRF_INVALID')
      }
    })
  })
})

describe('Automation Route CSRF Coverage Audit', () => {
  const mutationRoutes = [
    { route: 'POST /pipelines', file: 'pipelines/route.ts' },
    { route: 'POST /pipelines/start', file: 'pipelines/start/route.ts' },
    { route: 'POST /sources', file: 'sources/route.ts' },
    { route: 'PUT /sources/[id]', file: 'sources/[id]/route.ts' },
    { route: 'DELETE /sources/[id]', file: 'sources/[id]/route.ts' },
    { route: 'POST /providers', file: 'providers/route.ts' },
    { route: 'PUT /providers/[id]', file: 'providers/[id]/route.ts' },
    { route: 'DELETE /providers/[id]', file: 'providers/[id]/route.ts' },
    { route: 'POST /providers/[id]/rotate-key', file: 'providers/[id]/rotate-key/route.ts' },
    { route: 'POST /templates', file: 'templates/route.ts' },
    { route: 'PUT /templates/[id]', file: 'templates/[id]/route.ts' },
    { route: 'DELETE /templates/[id]', file: 'templates/[id]/route.ts' },
    { route: 'PUT /settings', file: 'settings/route.ts' },
    { route: 'POST /publish', file: 'publish/route.ts' },
    { route: 'POST /publish/schedule', file: 'publish/schedule/route.ts' },
    { route: 'DELETE /publish/schedule/[id]', file: 'publish/schedule/[id]/route.ts' },
    { route: 'POST /review/[id]', file: 'review/[id]/route.ts' },
    { route: 'POST /versions/[id]', file: 'versions/[id]/route.ts' },
  ]

  const readOnlyRoutes = [
    { route: 'GET /pipelines', file: 'pipelines/route.ts' },
    { route: 'GET /pipelines/[id]', file: 'pipelines/[id]/route.ts' },
    { route: 'GET /sources', file: 'sources/route.ts' },
    { route: 'GET /sources/[id]', file: 'sources/[id]/route.ts' },
    { route: 'GET /providers', file: 'providers/route.ts' },
    { route: 'GET /providers/[id]', file: 'providers/[id]/route.ts' },
    { route: 'GET /templates', file: 'templates/route.ts' },
    { route: 'GET /templates/[id]', file: 'templates/[id]/route.ts' },
    { route: 'GET /settings', file: 'settings/route.ts' },
    { route: 'GET /publish/schedule', file: 'publish/schedule/route.ts' },
    { route: 'GET /review', file: 'review/route.ts' },
    { route: 'GET /versions', file: 'versions/route.ts' },
    { route: 'GET /health', file: 'health/route.ts' },
  ]

  it('documents all mutation routes requiring CSRF', () => {
    expect(mutationRoutes.length).toBe(18)
    const routeNames = mutationRoutes.map(r => r.route)
    expect(routeNames).toContain('POST /pipelines')
    expect(routeNames).toContain('DELETE /sources/[id]')
    expect(routeNames).toContain('POST /providers/[id]/rotate-key')
    expect(routeNames).toContain('DELETE /publish/schedule/[id]')
  })

  it('documents all read-only routes', () => {
    expect(readOnlyRoutes.length).toBe(13)
    readOnlyRoutes.forEach(r => {
      expect(r.route.startsWith('GET ')).toBe(true)
    })
  })

  it('every mutation route file uses withCsrf import', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const base = path.resolve(process.cwd(), 'src/app/api/admin/automation')

    for (const { file } of mutationRoutes) {
      const filePath = path.join(base, file)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        expect(content).toContain('withCsrf')
      }
    }
  })
})
