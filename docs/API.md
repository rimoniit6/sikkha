# API Documentation

> Complete API reference for শিক্ষা বাংলা. 211 endpoints across auth, content, payment, admin, and analytics.

## Standard Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message in Bangla",
  "code": "ERROR_CODE",
  "details": [{ "field": "fieldName", "message": "Specific error" }]
}
```

## Authentication Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/register` | No | User registration |
| POST | `/api/auth/logout` | Yes | User logout |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/csrf-token` | No | Get CSRF token |

## User Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user/profile` | Yes | Get user profile |
| PUT | `/api/user/profile` | Yes | Update user profile |
| GET | `/api/user/dashboard` | Yes | User dashboard stats |
| GET | `/api/user/payments` | Yes | Payment history |
| GET | `/api/user/subscriptions` | Yes | Active subscriptions |
| GET | `/api/user/classes` | Yes | User's classes |
| GET/PUT | `/api/user/learning-preference` | Yes | Learning mode preference |
| GET/POST | `/api/user/feedback` | Yes | Feedback system |
| GET/POST | `/api/user/feedback/[id]/messages` | Yes | Feedback messages |
| GET/POST/DELETE | `/api/notes` | Yes | Personal notes |
| GET/PUT/DELETE | `/api/notes/[id]` | Yes | Individual notes |
| GET/POST/DELETE | `/api/bookmarks` | Yes | Bookmarks |
| GET | `/api/bookmarks/check` | Yes | Check bookmark status |
| POST | `/api/bookmarks/batch-check` | Yes | Batch bookmark check |
| GET | `/api/user/recent-lectures` | Yes | Recent lectures |

## Content Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/classes` | No | List all classes |
| GET | `/api/classes/[slug]` | No | Class details |
| GET | `/api/subjects` | No | List subjects |
| GET | `/api/subjects/[id]` | No | Subject details |
| GET | `/api/subjects/slug/[slug]` | No | Subject by slug |
| GET | `/api/chapters` | No | List chapters |
| GET | `/api/chapters/[id]` | No | Chapter details |
| GET | `/api/chapters/slug/[slug]` | No | Chapter by slug |
| GET | `/api/years` | No | List exam years |
| GET | `/api/hierarchy/metadata` | No | Full hierarchy tree |
| GET | `/api/content-types` | No | Content type registry |

## MCQ Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mcq` | No | List MCQs |
| GET | `/api/mcq/[id]` | No | MCQ details |
| GET | `/api/mcq/exam` | Yes | MCQ exam |

## CQ Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cq` | No | List CQs |
| GET/PUT/DELETE | `/api/cq/[id]` | Yes* | CQ CRUD |

## Lecture Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lectures` | No | List lectures |
| GET | `/api/lectures/[id]` | No | Lecture details |

## Board Question Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/board-questions` | No | List board questions |
| GET | `/api/board-questions/filters` | No | Filter options |
| GET | `/api/board-questions/search-suggestions` | No | Search suggestions |
| GET | `/api/board-years` | No | Board years |
| GET | `/api/boards` | No | List boards |

## Exam Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/exams` | No | List exams |
| GET | `/api/exams/[id]` | No | Exam details |
| DELETE | `/api/exams/[id]/delete` | Yes | Delete exam |
| POST | `/api/exams/session` | Yes | Start exam session |
| GET/PUT | `/api/exams/session/[id]` | Yes | Exam session |
| POST | `/api/exams/results` | Yes | Submit exam results |
| GET | `/api/exams/results` | Yes | Exam results |
| GET | `/api/exams/results/[userId]` | Yes | User results |
| GET | `/api/exams/results/detail` | Yes | Result details |
| GET | `/api/exams/analytics` | Yes | Exam analytics |
| GET | `/api/exams/my-exams` | Yes | User's exams |

## Exam Package Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mcq-exam-packages` | No | List MCQ exam packages |
| GET | `/api/cq-exam-packages` | No | List CQ exam packages |

## Course Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/courses` | No | List courses |
| POST | `/api/courses/enroll` | Yes | Enroll in course |
| POST | `/api/courses/purchase` | Yes | Purchase course |
| GET | `/api/courses/progress` | Yes | Course progress |
| GET | `/api/courses/featured` | No | Featured courses |
| GET/POST | `/api/courses/assignments` | Yes | Course assignments |
| GET | `/api/courses/certificate` | Yes | Course certificate |
| POST | `/api/courses/syllabus/sync` | Yes | Sync syllabus |

## Payment Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payment` | Yes | Create payment |
| GET | `/api/payment` | Yes | List payments |
| GET | `/api/payment/[id]` | Yes | Payment details |
| GET | `/api/payment/access` | Yes | Check single item access |
| POST | `/api/payment/batch-check` | Yes | Batch access check |
| GET | `/api/payment/check` | Yes | Check payment status |
| GET | `/api/payment/content-info` | Yes | Content info for payment |
| GET | `/api/payment/purchases` | Yes | Purchase history |
| GET | `/api/payment/accounts` | Yes | Payment accounts |

## Bundle & Package Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bundles` | No | List bundles |
| GET | `/api/bundles/[id]` | No | Bundle details |
| GET | `/api/packages` | No | List packages |
| GET | `/api/packages/[id]` | No | Package details |
| GET | `/api/packages/suggest` | No | Package suggestions |
| GET | `/api/content/bundles-for` | No | Bundles for content |

## Search Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/search` | No | Global search |
| GET | `/api/search/suggestions` | No | Search suggestions |

## CMS Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/banners` | No | Homepage banners |
| GET | `/api/notices` | No | Notice board |
| GET | `/api/faqs` | No | FAQs |
| GET | `/api/testimonials` | No | Testimonials |
| GET | `/api/teacher-moderators` | No | Teachers |
| GET | `/api/navigation` | No | Navigation menu |
| GET | `/api/config` | No | Site configuration |
| GET | `/api/suggestions` | No | Suggestions |
| GET | `/api/knowledge-questions` | No | Knowledge questions |

## Utility Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/ready` | No | Readiness probe |
| GET | `/api/stats` | No | Public stats |
| GET | `/api/pdf` | No | PDF generation |
| POST | `/api/contact` | No | Contact form |
| POST | `/api/create-exam` | Yes | Create custom exam |
| GET | `/api/create-exam/check-access` | Yes | Check exam access |
| GET | `/api/progress` | Yes | User progress |
| GET | `/api/recently-viewed` | Yes | Recently viewed |
| POST | `/api/local-upload` | Yes | File upload |
| GET | `/api/student/notifications` | Yes | User notifications |

## Admin Endpoints

### Admin Content Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/mcq` | Admin | MCQ CRUD |
| GET/POST/PUT/DELETE | `/api/admin/cq` | Admin | CQ CRUD |
| GET/POST/PUT/DELETE | `/api/admin/lectures` | Admin | Lecture CRUD |
| GET/POST/PUT/DELETE | `/api/admin/exams` | Admin | Exam CRUD |
| GET/POST/PUT/DELETE | `/api/admin/knowledge-questions` | Admin | Knowledge CRUD |
| GET/POST/PUT/DELETE | `/api/admin/suggestions` | Admin | Suggestion CRUD |
| GET/POST/PUT/DELETE | `/api/admin/board-questions` | Admin | Board question CRUD |
| GET/POST/PUT/DELETE | `/api/admin/notices` | Admin | Notice CRUD |
| GET/POST/PUT/DELETE | `/api/admin/faqs` | Admin | FAQ CRUD |
| GET/POST/PUT/DELETE | `/api/admin/testimonials` | Admin | Testimonial CRUD |
| GET/POST/PUT/DELETE | `/api/admin/banners` | Admin | Banner CRUD |
| GET/POST/PUT/DELETE | `/api/admin/bundles` | Admin | Bundle CRUD |
| GET/POST/PUT/DELETE | `/api/admin/packages` | Admin | Package CRUD |
| GET/POST/PUT/DELETE | `/api/admin/featured` | Admin | Featured content CRUD |
| GET/POST/PUT/DELETE | `/api/admin/content-types` | Admin | Content type CRUD |

### Admin Hierarchy Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/classes` | Admin | Class CRUD |
| GET/POST/PUT/DELETE | `/api/admin/subjects` | Admin | Subject CRUD |
| GET/POST/PUT/DELETE | `/api/admin/chapters` | Admin | Chapter CRUD |
| GET/POST/PUT/DELETE | `/api/admin/topics` | Admin | Topic CRUD |
| GET/POST/PUT/DELETE | `/api/admin/boards` | Admin | Board CRUD |
| GET/POST/PUT/DELETE | `/api/admin/board-years` | Admin | Board year CRUD |
| GET/POST/PUT/DELETE | `/api/admin/years` | Admin | Year CRUD |

### Admin User & Payment Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/PUT | `/api/admin/users` | Admin | User management |
| GET/DELETE | `/api/admin/users/export` | Admin | User export |
| GET/PATCH | `/api/admin/payments` | Admin | Payment review |
| GET | `/api/admin/payments/stats` | Admin | Payment stats |
| GET | `/api/admin/exam-results` | Admin | Exam results |
| GET | `/api/admin/subscriptions` | Admin | Subscriptions |
| GET | `/api/admin/content-purchases` | Admin | Content purchases |
| GET | `/api/admin/mcq-exam-purchases` | Admin | MCQ exam purchases |

### Admin Exam Package Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/mcq-exam-packages` | Admin | MCQ exam packages |
| POST | `/api/admin/mcq-exam-packages/bulk-upload-questions` | Admin | Bulk upload MCQ questions |
| GET/POST/PUT/DELETE | `/api/admin/cq-exam-packages` | Admin | CQ exam packages |

### Admin Course Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/courses` | Admin | Course CRUD |
| GET/POST/PUT/DELETE | `/api/admin/courses/lessons` | Admin | Lesson CRUD |
| GET/POST/PUT/DELETE | `/api/admin/courses/assignments` | Admin | Assignment CRUD |

### Admin Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/analytics/revenue` | Admin | Revenue analytics |
| GET | `/api/admin/analytics/students` | Admin | Student analytics |
| GET | `/api/admin/analytics/retention` | Admin | Retention analytics |
| GET | `/api/admin/analytics/conversion` | Admin | Conversion analytics |
| GET | `/api/admin/analytics/dropoff` | Admin | Drop-off analytics |
| GET | `/api/admin/analytics/realtime` | Admin | Real-time analytics |
| GET | `/api/admin/analytics/insights` | Admin | AI insights |
| GET | `/api/admin/analytics/predictions` | Admin | Predictions |
| GET | `/api/admin/analytics/alerts` | Admin | Alerts |
| GET/POST | `/api/admin/analytics/reports` | Admin | Reports |
| GET | `/api/admin/analytics/search` | Admin | Search analytics |
| GET | `/api/admin/analytics/devices` | Admin | Device analytics |
| GET | `/api/admin/analytics/geo` | Admin | Geographic analytics |
| GET | `/api/admin/analytics/courses` | Admin | Course analytics |
| GET | `/api/admin/analytics/mcq` | Admin | MCQ analytics |
| GET | `/api/admin/analytics/cq` | Admin | CQ analytics |
| GET | `/api/admin/analytics/payments` | Admin | Payment analytics |
| GET | `/api/admin/analytics/acquisition` | Admin | Acquisition analytics |
| POST | `/api/admin/analytics/track` | Admin | Track event |
| GET/POST | `/api/admin/analytics/export` | Admin | Export analytics |

### Admin System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/PUT | `/api/admin/settings` | Admin | Site settings |
| POST | `/api/admin/settings/seed` | SuperAdmin | Seed settings |
| GET/POST/PUT/DELETE | `/api/admin/navigation` | Admin | Navigation CRUD |
| POST | `/api/admin/navigation/seed` | SuperAdmin | Seed navigation |
| GET/POST/DELETE | `/api/admin/notifications` | Admin | Notification management |
| GET/POST/PUT/DELETE | `/api/admin/feedback` | Admin | Feedback management |
| GET/POST/PUT/DELETE | `/api/admin/contact-messages` | Admin | Contact messages |
| GET/POST/PUT/DELETE | `/api/admin/teacher-moderators` | Admin | Teacher management |
| GET/POST/PUT/DELETE | `/api/admin/blog` | Admin | Blog CRUD |
| GET/POST/PUT/DELETE | `/api/admin/blog/categories` | Admin | Blog categories |
| GET/POST/PUT/DELETE | `/api/admin/blog/tags` | Admin | Blog tags |
| GET | `/api/admin/audit-logs` | Admin | Audit logs |
| POST | `/api/admin/audit-logs/retention` | Admin | Audit log retention |
| GET | `/api/admin/audit-logs/verify` | Admin | Verify audit logs |
| GET | `/api/admin/version-history` | Admin | Version history |
| POST | `/api/admin/version-history/[entityType]/[entityId]/rollback` | Admin | Rollback version |
| GET/POST | `/api/admin/workflow` | Admin | Content workflow |
| GET | `/api/admin/workflow/analytics` | Admin | Workflow analytics |
| POST | `/api/admin/bulk-import` | Admin | Bulk import |
| POST | `/api/admin/mcq/bulk-upload` | Admin | MCQ bulk upload |
| GET/DELETE | `/api/admin/trash` | Admin | Trash management |
| POST | `/api/admin/trash/cleanup` | Admin | Cleanup trash |
| GET | `/api/admin/trash/impact` | Admin | Trash impact |
| GET | `/api/admin/permissions` | Admin | Permission management |
| GET | `/api/admin/stats` | Admin | Admin stats |
| POST | `/api/admin/database/export` | SuperAdmin | Database export |
| POST | `/api/admin/database/import` | SuperAdmin | Database import |
| POST | `/api/admin/database/reset` | SuperAdmin | Database reset |
| POST | `/api/admin/cron/publish-scheduled` | Admin | Publish scheduled content |
| POST | `/api/admin/cron/purge-audit-logs` | Admin | Purge old audit logs |
| POST | `/api/admin/check-slug` | Admin | Check slug uniqueness |
| GET | `/api/admin/exams/questions` | Admin | Question bank |

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `ALREADY_PURCHASED` | Content already purchased |
| `PENDING_PAYMENT` | Payment already pending |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `CSRF_INVALID` | CSRF token invalid |
| `CONFLICT` | Resource conflict (duplicate) |
