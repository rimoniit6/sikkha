# Developer Guide

> Coding standards and development practices for শিক্ষা বাংলা.

## Coding Style

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- No `any` types (use `unknown` or specific types)

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `payment-helpers.ts` |
| Components | PascalCase | `PackageCard.tsx` |
| Hooks | camelCase with `use` prefix | `useLearningPreference` |
| API routes | kebab-case directories | `api/admin/mcq-exam-packages/` |
| Zod schemas | camelCase with `Schema` suffix | `createPaymentSchema` |
| Types | PascalCase | `ContentPackage`, `AuthResult` |

### Imports

```typescript
// External libraries first
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

// Internal libraries
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'

// Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Types
import type { ContentPackage } from './types'
```

## Folder Rules

| Type | Location |
|------|----------|
| Page components | `src/components/{domain}/` |
| Shared components | `src/components/shared/` |
| UI primitives | `src/components/ui/` |
| API routes | `src/app/api/{domain}/` |
| Business logic | `src/lib/` or `src/services/` |
| Custom hooks | `src/hooks/` |
| State stores | `src/store/` |
| Types | `src/types/` or co-located |
| Validation schemas | `src/lib/validations.ts` |

## Component Rules

- Use `'use client'` directive for client components
- Extract reusable logic into custom hooks
- Keep components under 300 lines (split if larger)
- Use TypeScript interfaces for props
- Co-locate related files (component + test + types)

## API Rules

### Standard Pattern

```typescript
import { withAdmin, withCsrf, validateBody, apiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { someSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth
    
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    
    const body = await request.json()
    const validation = validateBody(someSchema, body)
    if ('error' in validation) return validation.error
    
    // Business logic...
    
    return apiResponse(result)
  } catch (error) {
    return handleApiError(error, 'Context message')
  }
}
```

### Rules
1. Always use `handleApiError` in catch blocks
2. Always use `validateBody` for mutation inputs
3. Always use `withAdmin` for admin routes
4. Always use `withCsrf` for mutations
5. Return `apiResponse` for success, `apiError` for errors
6. Use meaningful context strings in `handleApiError`

## Transaction Rules

```typescript
import { safeTransaction } from '@/lib/errors'

// CORRECT: Use tx for all operations
await safeTransaction(async (tx) => {
  await tx.payment.update({ ... })
  await tx.userSubscription.create({ ... })
})

// WRONG: Never use db inside transaction
await safeTransaction(async (tx) => {
  await db.payment.update({ ... }) // ❌
})
```

## Testing Rules

- Write tests for all new API endpoints
- Use Vitest for unit tests
- Mock external dependencies
- Test both success and error paths
- Aim for >80% coverage on critical paths
