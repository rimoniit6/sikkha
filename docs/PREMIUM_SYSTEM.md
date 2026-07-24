# Premium System

> Complete premium system documentation for শিক্ষা বাংলা.

## Overview

Premium content access via packages, bundles, exam packages, and courses.

## Package Subscriptions

### ContentPackage Model
- `title`, `slug`, `description`
- `price`, `originalPrice`
- `duration` (days), `durationLabel` ("৩০ দিন", "৬ মাস", "১ বছর")
- `classLevel` (optional — targets specific class)
- `isActive`, `order`

### UserSubscription Model
- `userId`, `packageId`, `classLevel`
- `startDate`, `endDate`
- `isActive`, `paymentId`
- `@@unique([userId, packageId, classLevel])`

### Lifecycle
1. User selects package → Payment page
2. User pays via bKash/Nagad/Rocket → Payment record (PENDING)
3. Admin approves → `handleSubscriptionCreation()` called
4. Subscription created/extended:
   - New: `endDate = startDate + duration`
   - Existing: `endDate = max(currentEnd, startDate) + duration`
5. User gets access to ALL premium content for their class

### Access Check
```typescript
const activeSubscription = await db.userSubscription.findFirst({
  where: {
    userId,
    classLevel: contentClassLevel,
    isActive: true,
    endDate: { gte: new Date() },
  },
})
```

## Bundles

### ContentBundle Model
- `title`, `description`, `price`, `originalPrice`
- `thumbnail`, `isActive`

### BundleItem Model
- `bundleId`, `contentType`, `contentId`, `order`
- `@@unique([bundleId, contentType, contentId])`

### Access Check
Bundle access requires ALL items to be individually purchased:
```typescript
const itemPayments = await db.payment.findMany({
  where: {
    userId,
    status: 'APPROVED',
    OR: bundle.items.map(item => ({
      contentType: item.contentType,
      contentId: item.contentId,
    })),
  },
})
const hasAccess = itemPayments.length === bundle.items.length
```

Partial access reported (X of Y items purchased).

## MCQ Exam Packages

### Models
- `MCQExamPackage` — Package definition
- `MCQExamSet` — Sets within packages
- `MCQExamSetQuestion` — Questions in sets
- `MCQExamSetResult` — Student results
- `MCQExamPackagePurchase` — Purchase records (`@@unique([userId, packageId])`)

### Access Check
```typescript
const purchase = await db.mCQExamPackagePurchase.findFirst({
  where: { userId, packageId: contentId, isActive: true },
})
```

## CQ Exam Packages

Same structure as MCQ but with CQ-specific models:
- `CQExamPackage`, `CQExamSet`, `CQExamSetQuestion`
- `CQExamSubmission`, `CQExamAnswer`, `CQExamAnswerImage`
- `CQExamPackagePurchase`

## Course Purchases

### Models
- `Course` — Course definition
- `CoursePurchase` — Purchase records (`@@unique([userId, courseId])`)
- `CourseEnrollment` — Enrollment records (`@@unique([userId, courseId])`)

### Access Check
```typescript
const enrollment = await db.courseEnrollment.findFirst({
  where: { userId, courseId: contentId, status: 'ACTIVE' },
})
```

## Access Resolution Order

1. Active subscription (by class level)
2. Dedicated purchase (exam packages)
3. Course-granted access
4. Direct payment
5. Bundle ownership
6. Package subscription

## Content Types with Subscription Access

| Type | Subscription | Direct Purchase |
|------|-------------|----------------|
| MCQ | ✅ | ✅ |
| CQ | ✅ | ✅ |
| Lecture | ✅ | ✅ |
| Exam | ✅ | ✅ |
| Suggestion | ✅ | ✅ |
| Short Questions | ✅ | ✅ |
| Board MCQ/CQ | ✅ | ✅ |
| MCQ Exam Package | ✅ | ✅ |
| CQ Exam Package | — | ✅ |
| Course | — | ✅ |

## Duplicate Prevention

| Model | Constraint |
|-------|-----------|
| `UserSubscription` | `@@unique([userId, packageId, classLevel])` |
| `MCQExamPackagePurchase` | `@@unique([userId, packageId])` |
| `CQExamPackagePurchase` | `@@unique([userId, packageId])` |
| `CoursePurchase` | `@@unique([userId, courseId])` |
