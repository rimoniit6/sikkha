# Audit Logging

> Audit logging system documentation for শিক্ষা বাংলা.

## Overview

Complete admin action history with before/after state tracking.

## AuditLog Model

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  adminId     String
  action      String   // e.g., 'PAYMENT_APPROVE', 'MCQ_CREATE'
  entityType  String   // e.g., 'PAYMENT', 'MCQ', 'USER'
  entityId    String
  oldData     String?  // JSON: previous state
  newData     String?  // JSON: new state
  ipAddress   String?
  userAgent   String?
  userName    String?
  userRole    String?
  status      String   @default("success")
  duration    Int?     // milliseconds
  os          String?
  browser     String?
  country     String?
  sessionId   String?
  requestId   String?
  createdAt   DateTime @default(now())

  @@index([adminId])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
}
```

## Creating Audit Logs

### Inside Transactions (Recommended)

```typescript
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit'

await safeTransaction(async (tx) => {
  // Business logic...
  
  await createAuditLog({
    adminId: auth.user.id,
    action: AuditActions.PAYMENT_APPROVE,
    entityType: EntityTypes.PAYMENT,
    entityId: payment.id,
    oldData: { status: existing.status },
    newData: { status: 'APPROVED' },
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent'),
    tx,
  })
})
```

### Outside Transactions

```typescript
await createAuditLog({
  adminId: auth.user.id,
  action: 'CONTENT_UPDATE',
  entityType: 'MCQ',
  entityId: mcq.id,
  oldData: { question: oldQuestion },
  newData: { question: newQuestion },
})
```

## Audit Actions

Defined in `AuditActions` enum:
- `PAYMENT_APPROVE`, `PAYMENT_REJECT`
- `MCQ_CREATE`, `MCQ_UPDATE`, `MCQ_DELETE`
- `CQ_CREATE`, `CQ_UPDATE`, `CQ_DELETE`
- `LECTURE_CREATE`, `LECTURE_UPDATE`, `LECTURE_DELETE`
- `USER_UPDATE`, `USER_DELETE`
- `SETTINGS_UPDATE`
- `BUNDLE_CREATE`, `BUNDLE_UPDATE`, `BUNDLE_DELETE`
- `PACKAGE_CREATE`, `PACKAGE_UPDATE`, `PACKAGE_DELETE`
- `COURSE_CREATE`, `COURSE_UPDATE`, `COURSE_DELETE`
- And many more...

## Entity Types

Defined in `EntityTypes` enum:
- `PAYMENT`, `MCQ`, `CQ`, `LECTURE`, `USER`, `SETTINGS`
- `BUNDLE`, `PACKAGE`, `COURSE`, `EXAM`, `NOTICE`
- And more...

## Immutability

AuditLog records are immutable:
- Update/delete operations blocked at Prisma middleware layer
- Only `create` operations allowed
- Append-only design for tamper resistance

## Querying Audit Logs

```typescript
// GET /api/admin/audit-logs
const logs = await db.auditLog.findMany({
  where: { entityType: 'PAYMENT', entityId: paymentId },
  orderBy: { createdAt: 'desc' },
  take: 50,
})
```

## Retention

Audit logs can be purged via:
- `POST /api/admin/audit-logs/retention` — Delete logs older than X days
- `POST /api/admin/cron/purge-audit-logs` — Automated purge
