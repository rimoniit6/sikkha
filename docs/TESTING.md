# Testing

> Testing strategy documentation for শিক্ষা বাংলা.

## Test Framework

- **Unit Tests**: Vitest
- **Integration Tests**: Vitest with HTTP requests
- **Coverage**: `@vitest/coverage-v8`

## Running Tests

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
```

## Test Structure

```
tests/                              # Integration tests
├── e2e.test.ts                     # Auth endpoint tests
├── payment-flow.test.ts            # Payment endpoint tests
└── api-response-format.test.ts     # Response format tests

src/lib/__tests__/                  # Unit tests
├── validations.test.ts             # Zod schema validation (26 tests)
├── errors.test.ts                  # Error handling (34 tests)
├── safe-transaction.test.ts        # Transaction safety (5 tests)
├── auth.test.ts                    # Auth utilities
├── access-control.test.ts          # Content access
├── audit-integrity.test.ts         # Audit logging
├── workflow-concurrency.test.ts    # Workflow concurrency
├── notification-service.test.ts    # Notifications
├── content-diff.test.ts            # Content diffing
├── version-history-stress.test.ts  # Version history stress
├── version-history-integrity.test.ts # Version history integrity
├── error-history.test.ts           # Error history
├── slug-unique.test.ts             # Slug uniqueness
├── api-client.test.ts              # HTTP client
└── scheduled-publish.test.ts       # Scheduled publishing

src/features/shared/exam-engine/__tests__/
├── time-window.test.ts             # Exam timing
├── helpers.test.ts                 # Exam helpers
└── access.test.ts                  # Exam access

src/services/__tests__/
└── exam-service.test.ts            # Exam service

src/services/server/__tests__/
└── purchase.service.test.ts        # Purchase service

src/hooks/__tests__/
└── use-bulk-content-selection.test.ts # Bulk selection

src/app/api/admin/audit-logs/__tests__/
└── validation.test.ts              # Audit log validation

src/app/api/admin/version-history/__tests__/
└── rollback.test.ts                # Version rollback

src/app/api/admin/workflow/analytics/__tests__/
└── route.test.ts                   # Workflow analytics
```

## Writing Tests

### Unit Test

```typescript
import { describe, it, expect } from 'vitest'
import { createPaymentSchema } from '@/lib/validations'

describe('createPaymentSchema', () => {
  it('accepts valid payment', () => {
    const result = createPaymentSchema.parse({
      amount: 100,
      method: 'bkash',
      transactionId: 'TXN123',
      paymentNumber: '01700000000',
    })
    expect(result.amount).toBe(100)
  })

  it('rejects negative amount', () => {
    expect(() => createPaymentSchema.parse({
      amount: -10,
      method: 'bkash',
      transactionId: 'TXN123',
      paymentNumber: '01700000000',
    })).toThrow()
  })
})
```

### Integration Test

```typescript
import { describe, it, expect } from 'vitest'

describe('GET /api/auth/me', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch('http://localhost:3000/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

## Coverage

Current coverage: ~14% of routes (29 test files / 211 routes).

### Priority Areas for Testing
1. Payment access resolution
2. Batch-check pipeline
3. Subscription management
4. Auth flow
5. Content access control
