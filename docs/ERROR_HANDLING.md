# Error Handling

> Centralized error handling system for শিক্ষা বাংলা.

## Error Class Hierarchy

```
AppError (base)
  ├── ValidationError (400)
  ├── AuthenticationError (401)
  ├── AuthorizationError (403)
  ├── NotFoundError (404)
  ├── ConflictError (409)
  ├── RateLimitError (429)
  ├── PaymentError (400)
  └── DatabaseError (500)
```

## handleApiError

Centralized error handler that classifies errors and returns structured responses.

```typescript
import { handleApiError } from '@/lib/errors'

catch (error) {
  return handleApiError(error, 'Context message')
}
```

### Error Classification

| Error Type | HTTP Status | Code |
|-----------|-------------|------|
| `AppError` | Uses `statusCode` | Uses `code` |
| `ZodError` | 400 | `VALIDATION_ERROR` |
| `PrismaClientKnownRequestError` P2002 | 409 | `CONFLICT` |
| `PrismaClientKnownRequestError` P2003 | 400 | `FOREIGN_KEY` |
| `PrismaClientKnownRequestError` P2025 | 404 | `NOT_FOUND` |
| `PrismaClientValidationError` | 400 | `DB_VALIDATION_ERROR` |
| `SyntaxError` (JSON parse) | 400 | `INVALID_JSON` |
| Generic `Error` | 500 | `INTERNAL_ERROR` |
| Unknown | 500 | `UNKNOWN_ERROR` |

### Response Format

```json
{
  "success": false,
  "error": "Error message in Bangla",
  "code": "ERROR_CODE",
  "details": [{ "field": "fieldName", "message": "Specific error" }]
}
```

## safeTransaction

Wraps database operations in transactions with retry logic.

```typescript
import { safeTransaction } from '@/lib/errors'

await safeTransaction(async (tx) => {
  // All operations use tx, NEVER db
  await tx.payment.update({ ... })
  await tx.userSubscription.create({ ... })
})
```

### Retry Logic
- Retries on Prisma `P2034` (transaction conflict/deadlock)
- Max 2 retries by default
- Other errors throw immediately

### Critical Rule
**NEVER use `db` inside a `safeTransaction` callback.** Always use `tx`.

## API Response Helpers

### apiResponse
```typescript
import { apiResponse } from '@/lib/api-utils'
return apiResponse(data) // { success: true, data }
return apiResponse(data, 201) // { success: true, data } with status 201
```

### apiError
```typescript
import { apiError } from '@/lib/api-utils'
return apiError('Error message', 400, 'ERROR_CODE')
return apiError('Error message', 400, 'ERROR_CODE', { details })
```

## Logging

- `handleApiError` logs via structured logger
- `console.error` used only in inner transaction rollback blocks (intentional)
- All errors logged with context for debugging
