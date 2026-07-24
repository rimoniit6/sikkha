# Database

> Complete database schema documentation for শিক্ষা বাংলা. 45+ models, 2000+ lines.

## Overview

SQLite via Prisma 7 ORM with LibSQL adapter. Schema is in `prisma/schema.prisma`.

## Models

### User System

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | User accounts | email (unique), role, learningMode, classLevel, isPremium |
| `Permission` | Granular permissions | name (e.g., 'content.manage') |
| `RolePermission` | Role-permission mapping | roleId, permissionId |

### Content Structure

| Model | Purpose | Relationships |
|-------|---------|---------------|
| `ClassCategory` | Class levels (6-12, SSC, HSC) | has many Subjects |
| `Subject` | Subjects per class | belongs to ClassCategory, has many Chapters |
| `Chapter` | Chapters per subject | belongs to Subject, has many Topics/Lectures/MCQ/CQ |
| `Topic` | Sub-chapters | belongs to Chapter |
| `ContentType` | Content type registry | Dynamic types from DB |

### Content Models

| Model | Purpose | Key Features |
|-------|---------|--------------|
| `Lecture` | Video/text lectures | duration, isPremium, classLevel via chapter |
| `MCQ` | Multiple choice questions | 4 options with images, explanation |
| `CQ` | Creative questions | 4 sub-questions, uddeepok (stimulus), images |
| `KnowledgeQuestion` | Knowledge/comprehension | type (KNOWLEDGE/COMPREHENSION) |
| `Suggestion` | Exam suggestions | classId, content |
| `Resource` | Lecture resources | type, url, lectureId |

### Board System

| Model | Purpose |
|-------|---------|
| `Board` | Board names (Dhaka, Rajshahi, etc.) |
| `ExamYear` | Exam years (2024, 2023, etc.) |
| `BoardYear` | Board+year combinations |

### Exam System

| Model | Purpose |
|-------|---------|
| `Exam` | Custom exams | classLevel, type, duration, totalMarks, passingPercentage |
| `ExamQuestion` | Questions in exams | examId, questionType, questionId, marks |
| `ExamResult` | Student results | score, totalMarks, percentage, timeTaken, answers (JSON) |
| `ExamSession` | Active exam sessions | status (IN_PROGRESS/SUBMITTED/EXPIRED), expiresAt |

### MCQ Exam Packages

| Model | Purpose |
|-------|---------|
| `MCQExamPackage` | Exam packages | title, price, classLevel, totalSets |
| `MCQExamSet` | Sets within packages | duration, totalQuestions, totalMarks |
| `MCQExamSetQuestion` | Questions in sets | marks, order |
| `MCQExamSetResult` | Student results | score, timeTaken, canRetake |
| `MCQExamPackagePurchase` | Purchase records | @@unique([userId, packageId]) |
| `MCQExamRetakeRequest` | Retake requests | status, reviewedBy |

### CQ Exam Packages

| Model | Purpose |
|-------|---------|
| `CQExamPackage` | CQ exam packages | title, price, totalSets |
| `CQExamSet` | CQ exam sets | duration, totalQuestions, totalMarks |
| `CQExamSetQuestion` | CQ questions | marks, type |
| `CQExamSubmission` | Student submissions | answers (JSON), score, status |
| `CQExamAnswer` | Individual answers | marks, answer text |
| `CQExamAnswerImage` | Answer images | url, annotation |
| `CQExamPackagePurchase` | Purchase records | @@unique([userId, packageId]) |
| `CQExamRetakeRequest` | Retake requests | status |

### Course System

| Model | Purpose |
|-------|---------|
| `Course` | Courses | title, price, isPremium, status |
| `CourseLesson` | Course lessons | title, type (LIVE/RECORDED), order |
| `LessonNote` | Lesson notes | content |
| `LessonResource` | Lesson resources | type, url |
| `LessonAssignment` | Assignments | title, description, dueDate |
| `AssignmentSubmission` | Submissions | content, grade, feedback |
| `LessonSchedule` | Lesson schedules | startDate, endDate |
| `CourseExamSchedule` | Exam schedules | examId, startDate |
| `LessonProgress` | Student progress | completed, timeSpent |
| `CourseEnrollment` | Enrollments | status (ACTIVE/COMPLETED/CANCELLED), type (FREE/PAID/GRANTED) |
| `CoursePurchase` | Purchases | @@unique([userId, courseId]) |
| `Certificate` | Course certificates | certificateNumber, issuedAt |

### Payment & Access

| Model | Purpose | Key Constraints |
|-------|---------|-----------------|
| `Payment` | Payment records | @@unique([userId, contentType, contentId, status]) |
| `UserSubscription` | Package subscriptions | @@unique([userId, packageId, classLevel]) |
| `ContentPackage` | Subscription packages | duration, durationLabel, classLevel |
| `ContentBundle` | Content bundles | has many BundleItems |
| `BundleItem` | Bundle contents | @@unique([bundleId, contentType, contentId]) |

### CMS

| Model | Purpose |
|-------|---------|
| `Banner` | Homepage banners |
| `Notice` | Notice board posts |
| `FAQ` | Frequently asked questions |
| `Testimonial` | User testimonials |
| `Suggestion` | Exam suggestions |
| `SiteSetting` | Key-value site configuration |
| `Navigation` | Menu items (header/footer) |
| `FeaturedContent` | Homepage featured items |
| `TeacherModerator` | Teacher profiles |

### User Activity

| Model | Purpose |
|-------|---------|
| `Bookmark` | Saved content | @@unique([userId, contentId, contentType]) |
| `Progress` | Learning progress | contentId, completed, timeSpent |
| `Note` | Personal notes | title, content |
| `RecentlyViewed` | View history | contentId, contentType |
| `Notification` | User notifications | type (INFO/SUCCESS/WARNING/ERROR) |

### Feedback

| Model | Purpose |
|-------|---------|
| `UserFeedback` | Feedback tickets | subject, status (PENDING/REPLIED/CLOSED) |
| `FeedbackMessage` | Feedback messages | senderRole (USER/ADMIN), message |

### Audit & Analytics

| Model | Purpose |
|-------|---------|
| `AuditLog` | Admin action history | action, entityType, entityId, oldData, newData, ipAddress, userAgent |
| `AnalyticsEvent` | Usage events | event, properties (JSON) |
| `AnalyticsSession` | User sessions | startedAt, endedAt |
| `AnalyticsSearchQuery` | Search queries | query, resultCount |
| `AnalyticsAlert` | System alerts | type, message, severity |
| `AnalyticsReport` | Generated reports | type, data (JSON) |

## Indexes

Key indexes for performance:
- `User`: `@@index([role])`, `@@index([classLevel, board])`
- `MCQ`: `@@index([classLevel])`, `@@index([chapterId])`, `@@index([isPremium])`
- `CQ`: `@@index([classLevel])`, `@@index([chapterId])`
- `Lecture`: `@@index([chapterId])`, `@@index([isPremium])`
- `ExamResult`: `@@index([userId])`, `@@index([examId])`, `@@index([userId, examId])`
- `Payment`: `@@index([userId, contentType, contentId])`, `@@index([status, createdAt])`
- `UserSubscription`: `@@index([userId, isActive])`, `@@index([packageId])`

## Soft Delete

Models with soft delete (in `SOFT_DELETE_MODELS`):
- ClassCategory, Subject, Chapter, Topic
- KnowledgeQuestion, Lecture, Resource, MCQ, CQ, Suggestion
- Course, CourseLesson
- Banner, FAQ, Testimonial, Notice, Navigation
- ContentType, FeaturedContent
- ContentBundle, ContentPackage
- MCQExamPackage, CQExamPackage
- TeacherModerator, Board, ExamYear, BoardYear
- Exam, UserSubscription
- MCQExamPackagePurchase, CQExamPackagePurchase
- BlogPost, BlogCategory

Prisma middleware auto-filters `deletedAt: null` for these models.

## Transactions

Use `safeTransaction()` for atomic operations:
```typescript
await safeTransaction(async (tx) => {
  // All operations use tx, NEVER db
  await tx.payment.update({ ... })
  await tx.userSubscription.create({ ... })
})
```

Retries on P2034 (deadlock) with max 2 retries.

## HTML Sanitization

Prisma extension sanitizes HTML fields on write using DOMPurify. Affected models:
- Lecture (content)
- MCQ (question, optionA-D, explanation)
- CQ (uddeepok, question1-4, answer1-4)
- Suggestion (content)
- Notice (content)
- FAQ (question, answer)
- Testimonial (content)
- SiteSetting (value)
- Banner (title, subtitle)
