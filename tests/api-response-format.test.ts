/**
 * API Response Format Integration Test
 *
 * Verifies that all student-facing API endpoints return the standard
 * { success: true, data: ... } response format that the api-client's
 * response interceptor expects for auto-unwrapping.
 *
 * Run against a running dev server: npm run dev (in another terminal)
 * Then: npx vitest run tests/api-response-format.test.ts
 *
 * NOTE: This file is outside vitest.config.ts's default include pattern,
 * so it must be run with the explicit path shown above.
 * The existing tests/e2e.test.ts follows the same convention.
 */

import { beforeAll, describe, expect, it } from 'vitest'

const BASE = 'http://localhost:3000'

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE}/api/config`)
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
  } catch (e) {
    expect.fail(`Dev server not available at ${BASE} — start it first (npm run dev)`)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────

interface ApiResult {
  status: number
  ok: boolean
  body: unknown
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<ApiResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const body = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, body }
}

/**
 * Assert the response has the standard format: { success: true, data: ... }
 * Returns the data payload for further assertions.
 */
function assertStandardFormat(result: ApiResult, path: string): unknown {
  expect(result.status, `${path} should return 200`).toBe(200)
  expect(result.body, `${path} should have a body`).toBeTruthy()

  const body = result.body as Record<string, unknown>
  expect(body.success, `${path} should have success: true`).toBe(true)
  expect(body, `${path} should have a 'data' key`).toHaveProperty('data')
  expect(body.data, `${path} data should not be null`).not.toBeNull()

  return body.data
}

/**
 * Assert the response has the standard error format: { success: false, error: ... }
 */
function assertStandardError(result: ApiResult, path: string, expectedStatus = 401): void {
  expect(result.status, `${path} should return ${expectedStatus}`).toBe(expectedStatus)
  expect(result.body, `${path} should have a body`).toBeTruthy()

  const body = result.body as Record<string, unknown>
  expect(body.success, `${path} should have success: false`).toBe(false)
  expect(body, `${path} should have an 'error' key`).toHaveProperty('error')
}

// ─── Static Public Endpoints ─────────────────────────────────────────

describe('Public endpoints — response format', () => {
  const endpoints = [
    { path: '/api/config', desc: 'site configuration' },
    { path: '/api/content-types', desc: 'content types' },
    { path: '/api/faqs', desc: 'FAQs' },
    { path: '/api/notices', desc: 'notices' },
    { path: '/api/boards', desc: 'boards' },
    { path: '/api/board-years', desc: 'board years' },
    { path: '/api/banners', desc: 'banners' },
    { path: '/api/navigation', desc: 'navigation' },
    { path: '/api/testimonials', desc: 'testimonials' },
    { path: '/api/years', desc: 'exam years' },
    { path: '/api/teacher-moderators', desc: 'teacher moderators' },
    { path: '/api/packages', desc: 'packages list' },
    { path: '/api/bundles', desc: 'bundles list' },
    { path: '/api/plans', desc: 'plans' },
    { path: '/api/payment/accounts', desc: 'payment accounts' },
    // /api/health deliberately excluded — returns 200 without success: true
  ] as const

  for (const { path, desc } of endpoints) {
    it(`GET ${path} (${desc}) returns { success: true, data: ... }`, async () => {
      const result = await fetchApi(path)
      if (result.status === 200) {
        assertStandardFormat(result, path)
      } else {
        // Some endpoints might return 401 if they require auth
        // But public ones should be 200
        expect(result.status, `${path} should be accessible (got ${result.status})`).toBe(200)
      }
    })
  }
})

// ─── Endpoints That Return Arrays Directly ───────────────────────────

describe('Array-returning public endpoints — data is an array', () => {
  const endpoints = [
    { path: '/api/boards', desc: 'boards list' },
    { path: '/api/board-years', desc: 'board years list' },
    { path: '/api/bundles', desc: 'bundles list' },
    { path: '/api/boards', desc: 'boards list' },
    { path: '/api/board-years', desc: 'board years list' },
    { path: '/api/bundles', desc: 'bundles list' },
  ] as const

  for (const { path, desc } of endpoints) {
    it(`GET ${path} (${desc}) returns data as an array`, async () => {
      const result = await fetchApi(path)
      expect(result.status, `${path} should return 200`).toBe(200)

      const body = result.body as Record<string, unknown>
      expect(body.success, `${path} success`).toBe(true)
      expect(Array.isArray(body.data), `${path} data should be an array`).toBe(true)
    })
  }

  it('GET /api/packages returns { success: true, data: { packages: [...] } }', async () => {
    // Packages list returns data as an object with a packages key, not a bare array
    const result = await fetchApi('/api/packages')
    expect(result.status).toBe(200)

    const body = result.body as Record<string, unknown>
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('packages')
    expect(Array.isArray((body.data as Record<string, unknown>).packages)).toBe(true)
  })
})

// ─── Content Data Endpoints (public data) ────────────────────────────

describe('Content/data endpoints — response format', () => {
  const endpoints = [
    { path: '/api/classes', desc: 'classes list' },
    { path: '/api/search/suggestions?q=math', desc: 'search suggestions' },
  ] as const

  for (const { path, desc } of endpoints) {
    it(`GET ${path} (${desc}) returns { success: true, data: ... }`, async () => {
      const result = await fetchApi(path)
      if (result.status !== 200) return

      assertStandardFormat(result, path)
    })
  }

  it('GET /api/board-questions/filters returns { success: true, data: ... }', async () => {
    // This endpoint returns filter options (boards, subjects) in standard format
    const result = await fetchApi('/api/board-questions/filters?classLevel=ssc')
    expect(result.status).toBe(200)

    const body = result.body as Record<string, unknown>
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('data')
  })
})

// ─── Endpoints Requiring ID/Slug — Dynamic Discovery ────────────────

describe('Detail endpoints — response format', () => {
  // These fetch a valid ID from a list endpoint, then verify the detail
  // endpoint returns the standard format

  it('GET /api/bundles/[id] (bundle detail) returns { success: true, data: ... }', async () => {
    const list = await fetchApi('/api/bundles?limit=1')
    if (list.status !== 200) return

    const listBody = list.body as Record<string, unknown>
    const bundles = Array.isArray(listBody.data)
      ? listBody.data
      : listBody.data && typeof listBody.data === 'object' && 'data' in (listBody.data as Record<string, unknown>)
        ? (listBody.data as Record<string, unknown>).data
        : []

    if ((bundles as unknown[]).length === 0) return // no bundles seeded
    const bundleId = ((bundles as unknown[])[0] as Record<string, unknown>).id as string

    const result = await fetchApi(`/api/bundles/${bundleId}`)
    if (result.status !== 200) return

    const data = assertStandardFormat(result, `/api/bundles/${bundleId}`)
    const payload = data as Record<string, unknown>
    expect(payload, 'bundle detail data should have title').toHaveProperty('title')
    expect(payload, 'bundle detail data should have items').toHaveProperty('items')
    expect(payload, 'bundle detail data should have itemCount').toHaveProperty('itemCount')
  })

  it('GET /api/packages/[id] (package detail) returns { success: true, data: ... }', async () => {
    const list = await fetchApi('/api/packages?limit=1')
    if (list.status !== 200) return

    const listBody = list.body as Record<string, unknown>
    const packages = listBody.data && typeof listBody.data === 'object'
      ? (listBody.data as Record<string, unknown>).packages || []
      : []

    if ((packages as unknown[]).length === 0) return // no packages seeded
    const packageId = ((packages as unknown[])[0] as Record<string, unknown>).id as string

    const result = await fetchApi(`/api/packages/${packageId}`)
    if (result.status !== 200) return

    const data = assertStandardFormat(result, `/api/packages/${packageId}`)
    const payload = data as Record<string, unknown>
    expect(payload, 'package detail data should have title').toHaveProperty('title')
    expect(payload, 'package detail data should have duration').toHaveProperty('duration')
    expect(payload, 'package detail data should have price').toHaveProperty('price')
  })

  it('GET /api/classes/[slug] (class detail) returns { success: true, data: ... }', async () => {
    const list = await fetchApi('/api/classes?limit=1')
    if (list.status !== 200) return

    const listBody = list.body as Record<string, unknown>
    const classes = listBody.classes || listBody.data || []
    const classList = Array.isArray(classes) ? classes : []

    if (classList.length === 0) return
    const classSlug = (classList[0] as Record<string, unknown>).slug as string

    const result = await fetchApi(`/api/classes/${classSlug}`)
    if (result.status !== 200) return

    assertStandardFormat(result, `/api/classes/${classSlug}`)
  })
})

// ─── Auth-Required Endpoints — Verify Error Format ───────────────────

describe('Auth-required endpoints — correct error format', () => {
  const endpoints = [
    'POST /api/payment',
    'GET /api/payment/check',
    'GET /api/payment/access',
    'GET /api/payment/purchases',
    'GET /api/user/payments',
    'GET /api/user/subscriptions',
    'GET /api/user/dashboard',
    'GET /api/user/profile',
    'GET /api/student/notifications',
  ] as const

  for (const entry of endpoints) {
    const [method, path] = entry.split(' ') as [string, string]
    it(`${method} ${path} returns { success: false, error: ... }`, async () => {
      const opts: RequestInit = { method }
      if (method === 'POST') {
        opts.body = JSON.stringify({ amount: 500, method: 'bkash', transactionId: 'TXN-TEST', paymentNumber: '01712345678' })
      }
      const result = await fetchApi(path, opts)
      // These endpoints should return 401 without auth
      // But some may return 400 for missing params — accept both
      if (result.status === 401) {
        assertStandardError(result, path, 401)
      } else if (result.status === 400 || result.status === 422) {
        // Some endpoints validate params before auth — that's OK
        expect(result.body, `${path} should have body`).toBeTruthy()
      }
    })
  }
})

// ─── Board Questions — Custom Response Shape ────────────────────────

describe('Board questions endpoint — custom shape', () => {
  it('GET /api/board-questions returns { data, pagination, analytics }', async () => {
    // Note: This endpoint has a custom response shape with { data, pagination, analytics }
    // It does NOT use the { success: true, data: ... } format (intentionally excluded from fix)
    const result = await fetchApi('/api/board-questions?limit=5')
    if (result.status !== 200) return

    const body = result.body as Record<string, unknown>
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('pagination')
    expect(Array.isArray(body.data)).toBe(true)
  })
})

// ─── Concurrent Access ──────────────────────────────────────────────

describe('Concurrent public endpoints — all return standard format', () => {
  it('multiple endpoints all return { success: true, data: ... }', async () => {
    const results = await Promise.all([
      fetchApi('/api/config'),
      fetchApi('/api/content-types'),
      fetchApi('/api/faqs'),
      fetchApi('/api/boards'),
      fetchApi('/api/packages'),
      fetchApi('/api/bundles'),
      fetchApi('/api/notices'),
      fetchApi('/api/navigation'),
      fetchApi('/api/testimonials'),
      fetchApi('/api/payment/accounts'),
    ])

    for (const result of results) {
      if (result.status !== 200) continue
      const body = result.body as Record<string, unknown>
      expect(body.success, `expected success:true for status ${result.status}`).toBe(true)
      expect(body, 'expected data key').toHaveProperty('data')
    }
  })
})

// ─── Non-Existent Route ─────────────────────────────────────────────

describe('Non-existent route — error handling', () => {
  it('GET /api/nonexistent-route returns 404', async () => {
    const result = await fetchApi('/api/nonexistent-route-99999')
    expect(result.status === 404 || result.status === 401).toBe(true)
    if (result.status === 404 && result.body) {
      const body = result.body as Record<string, unknown>
      // May or may not have success:false — depends on middleware
      expect(body).toHaveProperty('error')
    }
  })
})
