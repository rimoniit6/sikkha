# Architecture

> Complete technical architecture of শিক্ষা বাংলা.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (React 19)                   │
│  Zustand Router ←→ React Query ←→ Components            │
│  Learning Preference Provider (GLOBAL/CLASS_BASED)       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│                   PROXY LAYER (proxy.ts)                 │
│  JWT Auth → CSRF → Rate Limit → Security Headers        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              NEXT.JS API ROUTES (211 endpoints)          │
│  Auth Guards → Validation → Business Logic → Response    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              PRISMA ORM → SQLite (LibSQL adapter)        │
│  Soft Delete Middleware → HTML Sanitization              │
└─────────────────────────────────────────────────────────┘
```

## UI Layer

### Routing

The app uses a **SPA-in-SSR** pattern. A single `page.tsx` entry point renders all client-side pages via a Zustand-based router with URL synchronization.

```
URL Change → RouteSync (reads URL) → Zustand Store → Component Render
User Click → Zustand Store → AppNavigationBridge → router.push() → URL Update
```

Route definitions are in `src/store/router.ts` (50+ routes). URL mapping is in `src/lib/urls.ts`.

### State Management

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `auth.ts` | User session, login/logout | localStorage (`edu-auth`) |
| `router.ts` | Current route, params, history | In-memory |
| `exam.ts` | Active exam session | In-memory |
| `analytics.ts` | Admin analytics filters | In-memory |

### Provider Hierarchy

```
RootLayout
  ThemeProvider (next-themes)
    QueryProvider (TanStack React Query, dehydrated state)
      AuthProvider (JWT session)
        LearningPreferenceProvider (GLOBAL/CLASS_BASED)
          LoadingProvider (route transition loader)
            RouteSync (URL state sync)
            AppNavigationBridge (SPA navigation bridge)
            {children} (page content)
```

## API Layer

### Request Flow

```
HTTP Request
  → proxy.ts (JWT auth, CSRF, rate limit, security headers)
  → Next.js API Route
    → withAdmin/verifyAuth (authentication)
    → withCsrf (CSRF validation)
    → applyRateLimit (rate limiting)
    → validateBody (Zod validation)
    → Business Logic
    → apiResponse/apiError (standardized response)
  → handleApiError (error classification)
```

### Standardized Response Format

Success:
```json
{ "success": true, "data": { ... }, "pagination": { ... } }
```

Error:
```json
{ "success": false, "error": "Error message in Bangla", "code": "ERROR_CODE" }
```

## Service Layer

Business logic is split between:

- **API Routes** — Request handling, validation, response formatting
- **`src/lib/`** — Shared utilities (auth, errors, validation, payments)
- **`src/services/server/`** — Server-side services (content resolution, purchases)

## Prisma Layer

### Client Configuration

- Singleton pattern via `globalThis` in development
- LibSQL adapter for SQLite
- Soft delete middleware (auto-filters deleted records)
- HTML sanitization middleware (DOMPurify on write)

### Transaction Safety

```typescript
import { safeTransaction } from '@/lib/errors'

await safeTransaction(async (tx) => {
  // All operations use tx, NEVER db
  await tx.payment.update({ ... })
  await tx.userSubscription.create({ ... })
})
```

## Authentication

### Flow

```
Login → POST /api/auth/login → Verify credentials → Sign JWT → Set HttpOnly cookie
Request → proxy.ts → Parse cookie → Verify JWT → Fetch user → Attach to request
```

- JWT via `jose` library (HS256, 7-day expiry)
- HttpOnly, Secure, SameSite=Strict cookies
- Session verified on every request via `proxy.ts`

## Authorization

| Guard | Usage |
|-------|-------|
| `verifyAuth(request)` | Check authentication |
| `withAdmin(request)` | Require ADMIN + rate limiting |
| `withSuperAdmin(request)` | Require SUPER_ADMIN |
| `requirePermission(request, perm)` | Require specific permission |
| `withCsrf(request)` | Validate CSRF token |

## Caching

| Layer | Strategy |
|-------|----------|
| React Query | Client-side cache with server dehydration |
| HTTP | Static assets: 1-year immutable; API: no-store |
| Database | In-memory cache with TTL (content types, CSRF) |

## Premium Access

Access is resolved in this order:
1. Active subscription (by class level)
2. Dedicated purchase (exam packages)
3. Course-granted access
4. Direct payment
5. Bundle ownership
6. Package subscription

## Payment Flow

```
User clicks Buy → Payment Page → Select Method → Enter Transaction ID → Submit
POST /api/payment → Validate → Create Payment (PENDING) → Notify Admin
Admin reviews → Approve/Reject → DB Transaction (atomic)
Create Subscription/Purchase → Notify User → Audit Log
```

## Audit Logging

- `AuditLog` model captures all admin mutations
- Records: action, entityType, entityId, oldData, newData, adminId, IP, userAgent
- Immutable (append-only)
- Created inside transactions for atomicity
