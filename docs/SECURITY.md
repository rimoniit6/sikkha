# Security

> Security documentation for শিক্ষা বাংলা.

## Authentication

### JWT Implementation
- **Library**: `jose` (Web Crypto API compatible)
- **Algorithm**: HS256
- **Expiry**: 7 days
- **Cookie**: HttpOnly, Secure (production), SameSite=Strict
- **Secret**: `JWT_SECRET` env var (32+ characters)

### Flow
```
Login → Verify credentials → Sign JWT → Set HttpOnly cookie
Request → proxy.ts → Parse cookie → Verify JWT → Fetch user → Attach to request
```

## Authorization

### Roles
| Role | Access |
|------|--------|
| `STUDENT` | Free content, premium (if purchased), exams |
| `ADMIN` | Full CRUD on all content, payment approval |
| `SUPER_ADMIN` | System settings, database operations |

### Guards
- `verifyAuth(request)` — Check authentication
- `withAdmin(request)` — Require ADMIN + rate limiting
- `withSuperAdmin(request)` — Require SUPER_ADMIN
- `requirePermission(request, perm)` — Require specific permission
- `withCsrf(request)` — Validate CSRF token

## CSRF Protection

- JWT-based tokens signed with `CSRF_SECRET`
- Validated on all POST/PUT/PATCH/DELETE via `withCsrf()`
- Token sent via `x-csrf-token` header or `_csrf` body field
- Auto-skips GET/HEAD requests

## Rate Limiting

- Upstash Redis-backed rate limiter
- Applied to: auth endpoints, API endpoints, admin mutations
- `withAdmin()` auto-applies rate limiting for non-GET requests

## Input Sanitization

- DOMPurify strips scripts/event handlers from HTML at Prisma middleware layer
- Zod validation on all mutation inputs
- SQL injection prevented by Prisma ORM

## Security Headers

Set in `next.config.ts` and `proxy.ts`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- CSP with nonce (via proxy.ts)
- HSTS in production

## IDOR Protection

All user endpoints scope queries to `auth.user.id`:
```typescript
const userId = auth.user.id
const notes = await db.note.findMany({ where: { userId } })
```

Payment creation derives userId from session, not request body.

## Audit Logging

- `AuditLog` model captures all admin mutations
- Records: action, entityType, entityId, oldData, newData, adminId, IP, userAgent
- Immutable (append-only, update/delete blocked at Prisma middleware)
- Created inside transactions for atomicity
