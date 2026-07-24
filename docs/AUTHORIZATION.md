# Authorization

> Role-based access control documentation for শিক্ষা বাংলা.

## Roles

| Role | Description | Access Level |
|------|-------------|-------------|
| `STUDENT` | Regular student user | Free content, premium (if purchased), exams |
| `ADMIN` | Content administrator | Full CRUD on all content, payment approval |
| `SUPER_ADMIN` | System administrator | System settings, database operations, admin management |

## Permission System

Granular permissions defined in `Permission` model:
- `content.manage` — Create/update/delete content
- `content.delete` — Delete content
- `system.rbac` — Manage roles and permissions

Mapped via `RolePermission` model.

## Auth Guards

### `verifyAuth(request)`
Checks if user is authenticated. Returns `AuthResult` or `null`.

```typescript
const auth = await verifyAuth(request)
if (!auth) return apiError('Authentication required', 401)
// auth.user.id, auth.isAdmin, auth.isSuperAdmin available
```

### `withAdmin(request)`
Requires ADMIN or SUPER_ADMIN role. Auto-applies rate limiting for non-GET requests.

```typescript
const auth = await withAdmin(request)
if (auth instanceof NextResponse) return auth
```

### `withSuperAdmin(request)`
Requires SUPER_ADMIN role only.

```typescript
const auth = await withSuperAdmin(request)
if (auth instanceof NextResponse) return auth
```

### `requirePermission(request, permission)`
Requires specific permission.

```typescript
await requirePermission(request, 'content.manage')
```

### `withCsrf(request)`
Validates CSRF token on mutations. Auto-skips GET/HEAD.

```typescript
const csrfCheck = await withCsrf(request)
if ('error' in csrfCheck) return csrfCheck.error
```

## Route Protection

| Route Type | Protection |
|-----------|-----------|
| Public GET | None |
| User mutations | `verifyAuth` + `withCsrf` |
| Admin mutations | `withAdmin` + `withCsrf` |
| SuperAdmin operations | `withSuperAdmin` |
| Permission-based | `requirePermission` |

## Premium Access

Premium content access is NOT determined by `user.isPremium` flag. Access is granted through:

1. **Direct payment** — Approved payment for specific content
2. **Subscription** — Active `UserSubscription` for the content's class level
3. **Bundle purchase** — Approved bundle payment containing the content
4. **Course purchase** — Course enrollment grants access to course content

## IDOR Protection

All user endpoints scope queries to `auth.user.id`:
```typescript
const userId = auth.user.id
const notes = await db.note.findMany({ where: { userId } })
```

Payment creation derives userId from session, not request body:
```typescript
const userId = auth.user.id // From session, NOT from body
```
