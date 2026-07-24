# Payment System

> Complete payment system documentation for শিক্ষা বাংলা.

## Overview

Manual payment system where users pay via bKash/Nagad/Rocket and admins approve manually. Supports packages, bundles, exam packages, and course purchases.

## Payment Lifecycle

```
User clicks Buy → Payment Page → Select Method → Enter Transaction ID → Submit
                                                                        ↓
POST /api/payment → Validate → Create Payment (PENDING) → Notify Admin
                                                              ↓
Admin reviews → Approve/Reject → DB Transaction (atomic)
                                      ↓
                          Create Subscription/Purchase → Notify User → Audit Log
```

## Payment Types

| Type | Model | Post-Approval Action |
|------|-------|---------------------|
| `course` | `CoursePurchase` + `CourseEnrollment` | Enroll user in course |
| `package` | `UserSubscription` | Create/extend subscription |
| `mcq-exam-package` | `MCQExamPackagePurchase` | Grant exam access |
| `cq-exam-package` | `CQExamPackagePurchase` | Grant exam access |
| `bundle` | Direct payment check | Check all bundle items purchased |
| `mcq`, `cq`, etc. | Direct payment check | Grant single content access |

## Package Subscriptions

### Creation
```typescript
await handleSubscriptionCreation(payment, tx)
```

1. Look up package duration
2. Calculate `endDate = startDate + duration`
3. Check for existing subscription
4. If none: create new `UserSubscription`
5. If exists: extend `endDate` by package duration

### Renewal
Same as creation — extends existing subscription's `endDate`.

### Expiration
Checked via `endDate < new Date()` in access queries.

## Bundle Purchases

1. User purchases bundle → `Payment` record with `contentType: 'bundle'`
2. Admin approves → Payment status changes to `APPROVED`
3. Access check: ALL bundle items must be individually purchased
4. Partial access reported (X of Y items purchased)

## MCQ/CQ Exam Packages

- Separate purchase models (`MCQExamPackagePurchase`, `CQExamPackagePurchase`)
- Not covered by subscriptions — require dedicated purchase
- Can also be accessed via course enrollment

## Course Purchases

1. User purchases course → `CoursePurchase` + `CourseEnrollment` records
2. Admin approves → Payment status changes to `APPROVED`
3. Auto-enrollment in course

## Access Resolution

Two routes provide access checks:

1. **`GET /api/payment/access`** — Single item access check
2. **`POST /api/payment/batch-check`** — Batch access check (50 items max)

Both use shared helpers from `src/lib/payment-helpers.ts`:
- `resolveContentClassLevel()` — Resolve class level for subscription check
- `batchResolveContentClassLevels()` — Batch resolve class levels

Access layers (checked in order):
1. Active subscription (by class level)
2. Dedicated purchase (exam packages)
3. Course-granted access
4. Direct payment
5. Bundle ownership
6. Package subscription

## Duplicate Prevention

| Model | Constraint |
|-------|-----------|
| `Payment` | `@@unique([userId, contentType, contentId, status])` |
| `UserSubscription` | `@@unique([userId, packageId, classLevel])` |
| `MCQExamPackagePurchase` | `@@unique([userId, packageId])` |
| `CQExamPackagePurchase` | `@@unique([userId, packageId])` |
| `CoursePurchase` | `@@unique([userId, courseId])` |

Plus `idempotencyKey` on Payment for client-side deduplication.

## Transactions

All post-approval actions run inside `safeTransaction()`:
```typescript
await safeTransaction(async (tx) => {
  // 1. Update payment status to APPROVED
  // 2. Create subscription/purchase record
  // 3. Create notification
  // 4. Create audit log
  // All atomic — rollback on any failure
})
```

## Notifications

- Payment submitted → Admin notification
- Payment approved → User notification
- Payment rejected → User notification with reason

## Audit Logging

All payment state changes are logged in `AuditLog` with:
- `action`: PAYMENT_APPROVE or PAYMENT_REJECT
- `entityType`: PAYMENT
- `entityId`: Payment ID
- `oldData`: Previous status
- `newData`: New status + admin note
