# শিক্ষা বাংলা (Sikkha) — Production Technical Handbook

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> **Complete technical handbook for developers and AI agents working on this project.**
> Every section explains actual implementation, not aspirational architecture.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Architecture](#4-architecture)
5. [Database](#5-database)
6. [Authentication](#6-authentication)
7. [Admin Panel](#7-admin-panel)
8. [Student Side](#8-student-side)
9. [Payment System](#9-payment-system)
10. [Premium System](#10-premium-system)
11. [Learning Preference](#11-learning-preference)
12. [Content System](#12-content-system)
13. [API Documentation](#13-api-documentation)
14. [React Query](#14-react-query)
15. [Transactions](#15-transactions)
16. [Validation](#16-validation)
17. [Security](#17-security)
18. [Caching](#18-caching)
19. [Coding Standards](#19-coding-standards)
20. [How To Add New Features](#20-how-to-add-new-features)
21. [Common Mistakes](#21-common-mistakes)
22. [Testing](#22-testing)
23. [Deployment](#23-deployment)
24. [Troubleshooting](#24-troubleshooting)
25. [Future Roadmap](#25-future-roadmap)

---

## 1. Project Overview

### Purpose

শিক্ষা বাংলা (Sikkha) is a Bangladeshi online learning platform serving students from Class 6 to HSC (Higher Secondary Certificate). It provides MCQ practice, creative questions (CQ), lectures, board exam questions, custom exams, premium content packages, courses, and a complete admin panel for content management.

### Target Users

| User Type | Access Level | Key Features |
|-----------|-------------|--------------|
| **Students** | Free + Premium | Content browsing, MCQ/CQ practice, exam creation, premium packages |
| **Admins** | Full CRUD | Content management, payment approval, user management, analytics |
| **Super Admins** | System-wide | Database operations, system settings, admin management |

### Business Model

- **Freemium**: Free access to basic content, premium packages for advanced content
- **Package Subscriptions**: Time-based access (30 days, 6 months, 1 year) to class-specific content
- **Bundles**: One-time purchase of curated content collections
- **Courses**: Structured learning paths with lessons, assignments, and exams
- **Manual Payment**: Users pay via bKash/Nagad/Rocket, admin approves manually

### High-Level Architecture

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
│              NEXT.JS API ROUTES (223 endpoints)          │
│  Auth Guards → Validation → Business Logic → Response    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              PRISMA ORM → PostgreSQL                     │
│  Soft Delete Middleware → HTML Sanitization              │
└─────────────────────────────────────────────────────────┘
```

### Major Modules

| Module | Location | Description |
|--------|----------|-------------|
| Content Hierarchy | `ClassCategory → Subject → Chapter → Topic` | 5-level content structure |
| MCQ System | `MCQ` model + exam packages | Multiple choice questions with image support |
| CQ System | `CQ` model + exam packages | Creative questions with 4 sub-questions each |
| Lecture System | `Lecture` model | Video/text lectures with resources |
| Board Questions | `Board + ExamYear + BoardYear` | Historical board exam questions |
| Exam System | `Exam + ExamQuestion + ExamResult` | Custom exam creation and taking |
| MCQ Exam Packages | `MCQExamPackage → MCQExamSet → MCQExamSetQuestion` | Timed MCQ exam packages |
| CQ Exam Packages | `CQExamPackage → CQExamSet → CQExamSetQuestion` | CQ exam packages with grading |
| Course System | `Course → CourseLesson → LessonProgress` | Structured learning with assignments |
| Payment System | `Payment + UserSubscription` | Manual payment with admin approval |
| Bundle System | `ContentBundle → BundleItem` | Curated content collections |
| Blog System | `BlogPost → BlogTag → BlogCategory → BlogSeries` | Content blog with tags, categories, series |
| Workflow System | `WorkflowItem → WorkflowTemplate` | Admin workflow automation |
| Trash Management | `TrashItem` | Soft-deleted content recovery |
| Suggestion System | `Suggestion` | Content suggestions with editor views |
| Achievement System | `Achievement → UserAchievement` | Gamification with progress tracking |
| Revision System | `RevisionQueue → SpacedRepetitionCard` | Spaced repetition for learning |
| CMS | `Banner, Notice, FAQ, Testimonial, Navigation` | Content management |
| Analytics | `AnalyticsEvent + AnalyticsSession` | Usage tracking and reporting |
| Audit | `AuditLog` | Admin action history with before/after state |
| Plans | `SubscriptionPlan` | Subscription plan management |

---

## 2. Tech Stack

### Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1 | App Router, API routes, SSR/CSR hybrid |
| React | 19.0 | UI library |
| TypeScript | 5.9 | Type safety (strict mode) |
| Tailwind CSS | 4.0 | Utility-first styling |

### Database & ORM

| Technology | Version | Purpose |
|-----------|---------|---------|
| Prisma | 7.8 | ORM with schema-first approach |
| PostgreSQL | — | Primary database |
| pg | 8.22 | PostgreSQL driver |

### State Management

| Technology | Version | Purpose |
|-----------|---------|---------|
| Zustand | 5.0 | Global state (auth, router, exam, analytics) |
| TanStack React Query | 5.82 | Server state, caching, background refetch |

### UI Components

| Technology | Version | Purpose |
|-----------|---------|---------|
| Radix UI | 1.6 | Accessible primitives (50+ components) |
| shadcn/ui | — | Component library built on Radix |
| Framer Motion | 12.23 | Page transitions, animations |
| Lucide React | 0.525 | Icon library |
| Recharts | 2.15 | Charts and graphs |
| Embla Carousel | 8.6 | Image/content carousels |
| Vaul | 1.1 | Drawer component |
| Cmdk | 1.1 | Command palette |
| Sonner | — | Toast notifications |

### Content & Media

| Technology | Version | Purpose |
|-----------|---------|---------|
| TipTap | 3.28 | Rich text editor (headings, bold, links, tables) |
| KaTeX | 0.16 | Math equation rendering |
| MathJax | 3.x | MathML fallback rendering |
| Markmap | 0.18 | Interactive mind maps |
| DOMPurify | 3.15 | HTML sanitization (isomorphic-dompurify) |
| UploadThing | 7.7 | File uploads (screenshots, images) |
| xlsx | 0.18 | Excel bulk import/export |

### Authentication & Security

| Technology | Version | Purpose |
|-----------|---------|---------|
| jose | 6.2 | JWT token signing/verification |
| bcryptjs | 3.0 | Password hashing |
| @upstash/ratelimit | 2.0 | Rate limiting |
| @upstash/redis | 1.38 | Rate limit state store |
| Sentry | 10.59 | Error monitoring (client + server) |

### Utilities

| Technology | Version | Purpose |
|-----------|---------|---------|
| Zod | 4.0 | Runtime schema validation |
| date-fns | 4.4 | Date manipulation |
| clsx + tailwind-merge | — | Conditional class merging |
| class-variance-authority | 0.7 | Component variant styling |

---

## 3. Folder Structure

### `src/app/` — Next.js App Router

Contains all pages and API routes. Uses App Router with a catch-all `[...slug]` route for SPA navigation.

```
src/app/
  [...slug]/page.tsx    ← Catch-all SPA entry (renders all client-side pages)
  layout.tsx            ← Root layout (providers, fonts, metadata, SEO)
  page.tsx              ← Home page
  premium/page.tsx      ← Premium packages page
  payment/page.tsx      ← Payment form page
  api/                  ← 223 REST API route files
    admin/              ← Admin APIs (107+ files across 53+ sub-directories)
    payment/            ← Payment processing APIs
    user/               ← User profile/dashboard APIs
    auth/               ← Authentication APIs
    blog/               ← Blog system APIs
    courses/            ← Course system APIs
    ...
```

### `src/components/` — React Components

Organized by domain. Each sub-directory contains page-level and reusable components.

```
src/components/
  admin/          ← Admin panel pages (90+ components)
    blog/         ← Blog management
    workflow/     ← Workflow automation
    bulk-import/  ← Bulk content import
    bundles/      ← Bundle management
    cq/           ← Creative question management
    hierarchy/    ← Class/subject/chapter management
    lectures/     ← Lecture management
    mcq/          ← MCQ management
    settings/     ← Site settings tabs
    suggestions/  ← Suggestion management
  auth/           ← Login, register forms
  classes/        ← Class/subject/chapter browsing
  cq/             ← Creative question components
  exam/           ← Exam system (builder, viewer, results)
  home/           ← Homepage sections
  layout/         ← AppShell, Header, Footer, BottomNav
  lecture/        ← Lecture viewer
  mcq/            ← MCQ practice and exams
  payment/        ← Payment forms, steps, verification
  premium/        ← Premium page, package cards, bundle cards
  search/         ← Global search
  shared/         ← RouteSync, AppNavigationBridge, ClassContextBanner
  ui/             ← shadcn/ui primitives (50+ components)
```

### `src/lib/` — Utilities and Services

Core library code. Contains database access, authentication, error handling, validation, and business logic.

```
src/lib/
  db.ts                 ← Prisma client singleton with soft-delete + HTML sanitization middleware
  auth.ts               ← Auth utilities (verifyAuth, withAdmin, withSuperAdmin)
  auth/jwt.ts           ← JWT token signing/verification (jose)
  errors.ts             ← Error class hierarchy + safeTransaction wrapper
  api-utils.ts          ← API helpers (withAdmin, withCsrf, validateBody, apiResponse, apiError)
  validations.ts        ← Zod validation schemas for all API inputs
  rate-limit.ts         ← Rate limiter configuration
  csrf.ts               ← CSRF token generation/validation
  sanitize.ts           ← DOMPurify HTML sanitization
  payment-helpers.ts    ← Shared payment access resolution helpers
  course-access-resolver.ts ← Course-granted content access logic
  query-keys.ts         ← TanStack Query key factory
  soft-delete.ts        ← Soft delete/restore logic for all models
  version-history.ts    ← Content versioning system
  audit.ts              ← Audit logging system
  content-type-labels.ts ← Dynamic content type resolution from DB
  errors.ts             ← Error hierarchy + safeTransaction
  ...
```

### `src/hooks/` — Custom React Hooks

80+ custom hooks for data fetching, UI state, and business logic.

### `src/providers/` — React Context Providers

```
src/providers/
  AuthProvider.tsx          ← JWT session context + auto-refresh
  QueryProvider.tsx         ← TanStack Query + server-side dehydration
  LearningPreferenceProvider.tsx ← GLOBAL/CLASS_BASED mode state
  LoadingProvider.tsx       ← Route transition loading state
  ImageViewerProvider.tsx   ← Image lightbox viewer
```

### `src/store/` — Zustand Stores

```
src/store/
  auth.ts           ← User authentication state (persisted to localStorage)
  router.ts         ← Custom client-side router (50+ routes, URL sync)
  exam.ts           ← Exam session state
  analytics.ts      ← Admin analytics state
  board-filters.ts  ← Board question filter state
  chapter-filters.ts ← Chapter filter state
  focus-mode.ts     ← Focus/distraction-free mode state
  navigation-loader.ts ← Navigation loading state
```

### `src/services/` — Business Logic

```
src/services/
  api/              ← HTTP client service
  server/           ← Server-side services
    content.service.ts   ← Content resolution
    purchase.service.ts  ← Purchase/subscription logic
```

### `src/features/` — Domain-Driven Modules

```
src/features/
  shared/exam-engine/  ← Exam engine (timing, access control, helpers)
  course/              ← Course system (admin + student)
  cq-exam/             ← CQ exam packages (admin, grading, answers)
  mcq-exam/            ← MCQ exam packages (admin)
```

### `prisma/` — Database Schema

```
prisma/
  schema.prisma        ← 2100+ line schema (50+ models)
  seed.ts              ← Database seeding
  seed-content.ts      ← Content data seeding
  seed-data/           ← Seed data files (00-22)
```

---

## 4. Architecture

### Routing

The app uses a **SPA-in-SSR** pattern. A single `page.tsx` entry point renders all client-side pages via a Zustand-based router with URL synchronization.

```
URL Change → RouteSync (reads URL) → Zustand Store → Component Render
User Click → Zustand Store → AppNavigationBridge → router.push() → URL Update
```

**Route definitions** are in `src/store/router.ts` (50+ routes). URL mapping is in `src/lib/urls.ts`.

### Data Flow

```
Component → useQuery/useMutation → API Route → Prisma → SQLite
                ↓
        React Query Cache → UI Update
                ↓
        Zustand Store → Navigation/UI State
```

### State Management

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `auth.ts` | User session, login/logout | localStorage (`edu-auth`) |
| `router.ts` | Current route, params, history | In-memory |
| `exam.ts` | Active exam session | In-memory |
| `analytics.ts` | Admin analytics filters | In-memory |

### API Structure

Every API route follows this pattern:
```typescript
export async function GET/POST/PUT/DELETE(request: Request) {
  try {
    // 1. Auth check (withAdmin/verifyAuth)
    // 2. Rate limiting
    // 3. CSRF validation (mutations)
    // 4. Input validation (validateBody)
    // 5. Business logic
    // 6. Return apiResponse(data)
  } catch (error) {
    return handleApiError(error, 'Context message')
  }
}
```

### Error Handling

Centralized in `src/lib/errors.ts`:

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

`handleApiError()` classifies errors and returns structured JSON responses with Bengali error messages.

---

## 5. Database

PostgreSQL via Prisma 7 ORM. Schema spans 2100+ lines across 50+ models.

### Key Models

#### User System
| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | User accounts | email, role (STUDENT/ADMIN/SUPER_ADMIN), learningMode, classLevel |
| `Permission` | Granular permissions | name (e.g., 'content.manage') |
| `RolePermission` | Role-permission mapping | roleId, permissionId |

#### Content Structure
| Model | Purpose | Relationships |
|-------|---------|---------------|
| `ClassCategory` | Class levels (6-12, SSC, HSC) | has many Subjects |
| `Subject` | Subjects per class | belongs to ClassCategory, has many Chapters |
| `Chapter` | Chapters per subject | belongs to Subject, has many Topics/Lectures/MCQ/CQ |
| `ContentType` | Content type registry | Dynamic types from DB |

#### Content Models
| Model | Purpose | Key Features |
|-------|---------|--------------|
| `Lecture` | Video/text lectures | duration, isPremium, classLevel via chapter |
| `MCQ` | Multiple choice questions | 4 options with images, explanation |
| `CQ` | Creative questions | 4 sub-questions, uddeepok (stimulus), images |
| `KnowledgeQuestion` | Knowledge/comprehension | type (KNOWLEDGE/COMPREHENSION) |

#### Payment & Access
| Model | Purpose | Key Constraints |
|-------|---------|-----------------|
| `Payment` | Payment records | @@unique([userId, contentType, contentId, status]) |
| `UserSubscription` | Package subscriptions | @@unique([userId, packageId, classLevel]) |
| `ContentPackage` | Subscription packages | duration, durationLabel, classLevel |
| `ContentBundle` | Content bundles | has many BundleItems |
| `BundleItem` | Bundle contents | @@unique([bundleId, contentType, contentId]) |
| `MCQExamPackagePurchase` | MCQ exam purchases | @@unique([userId, packageId]) |
| `CQExamPackagePurchase` | CQ exam purchases | @@unique([userId, packageId]) |
| `CoursePurchase` | Course purchases | @@unique([userId, courseId]) |
| `CourseEnrollment` | Course enrollments | @@unique([userId, courseId]) |

#### Exam System
| Model | Purpose |
|-------|---------|
| `MCQExamPackage` | MCQ exam packages |
| `MCQExamSet` | Exam sets within packages |
| `MCQExamSetQuestion` | Questions in sets |
| `MCQExamSetResult` | Student results |
| `CQExamPackage` | CQ exam packages |
| `CQExamSet` | CQ exam sets |
| `CQExamSetQuestion` | CQ questions in sets |
| `CQExamSubmission` | Student CQ submissions |

#### Audit & CMS
| Model | Purpose |
|-------|---------|
| `AuditLog` | Admin action history (oldData/newData JSON) |
| `Banner` | Homepage banners |
| `Notice` | Notice board posts |
| `SiteSetting` | Key-value site configuration |
| `Navigation` | Menu items (header/footer) |

#### Blog System
| Model | Purpose |
|-------|---------|
| `BlogPost` | Blog articles with rich content |
| `BlogTag` | Blog post tags |
| `BlogCategory` | Blog post categories |
| `BlogSeries` | Blog post series/collections |
| `BlogRelatedPost` | Related post mappings |

#### Workflow & Trash
| Model | Purpose |
|-------|---------|
| `WorkflowItem` | Admin workflow automation items |
| `WorkflowTemplate` | Reusable workflow templates |
| `TrashItem` | Soft-deleted content for recovery |

#### Gamification & Learning
| Model | Purpose |
|-------|---------|
| `Achievement` | Achievement definitions |
| `UserAchievement` | User achievement progress |
| `RevisionQueue` | Spaced repetition revision queue |
| `SpacedRepetitionCard` | Flashcard-style spaced repetition |
| `Certificate` | Course completion certificates |

#### Subscription Plans
| Model | Purpose |
|-------|---------|
| `SubscriptionPlan` | Subscription plan management |
| `ContactMessage` | User contact form messages |
| `Testimonial` | User testimonials |

### Database Features

- **Soft Delete**: `deletedAt`, `deletedBy`, `deleteReason` fields on content models. Prisma middleware auto-filters deleted records.
- **HTML Sanitization**: Prisma extension sanitizes HTML fields on write (DOMPurify).
- **Transaction Retry**: `safeTransaction()` retries on P2034 (transaction conflict) with configurable max retries.
- **Audit Logging**: `AuditLog` captures before/after state for all admin mutations.
- **Payment Constraints**: Composite unique constraints prevent duplicate payments and subscriptions.
- **Full-Text Search**: PostgreSQL full-text search for content queries.
- **JSON Fields**: PostgreSQL JSON/JSONB for flexible metadata storage.

---

## 6. Authentication

### Flow

```
Login → POST /api/auth/login → Verify credentials → Sign JWT → Set HttpOnly cookie
                                                                  ↓
Request → proxy.ts → Parse cookie → Verify JWT → Fetch user from DB → Attach to request
                                                                    ↓
                                                            x-user-id, x-user-role headers
```

### JWT Implementation

- **Library**: `jose` (Web Crypto API compatible)
- **Algorithm**: HS256
- **Expiry**: 7 days
- **Cookie**: HttpOnly, Secure (production), SameSite=Strict
- **Secret**: `JWT_SECRET` env var (32+ characters)

### Roles

| Role | Access |
|------|--------|
| `STUDENT` | Free content, premium (if purchased), exams |
| `ADMIN` | Full CRUD on all content, payment approval |
| `SUPER_ADMIN` | System settings, database operations, admin management |

### Route Protection

| Guard | Usage |
|-------|-------|
| `verifyAuth(request)` | Check if user is authenticated |
| `withAdmin(request)` | Require ADMIN or SUPER_ADMIN + rate limiting |
| `withSuperAdmin(request)` | Require SUPER_ADMIN only |
| `requirePermission(request, perm)` | Require specific permission |
| `withCsrf(request)` | Validate CSRF token on mutations |

### Premium Access

Premium content is NOT determined by `user.isPremium` flag. Access is granted through:
1. **Direct payment** — Approved payment for specific content
2. **Subscription** — Active `UserSubscription` for the content's class level
3. **Bundle purchase** — Approved bundle payment containing the content
4. **Course purchase** — Course enrollment grants access to course content

---

## 7. Admin Panel

### Features

| Feature | API Routes | Description |
|---------|-----------|-------------|
| Content Management | `admin/mcq`, `admin/cq`, `admin/lectures` | Full CRUD for all content types |
| Hierarchy Management | `admin/classes`, `admin/subjects`, `admin/chapters` | Class/subject/chapter tree |
| Payment Review | `admin/payments` | Approve/reject payments, create subscriptions |
| User Management | `admin/users` | View/edit users, role management |
| Bundle Management | `admin/bundles` | Create/edit content bundles |
| Package Management | `admin/packages` | Create/edit subscription packages |
| MCQ Exam Packages | `admin/mcq-exam-packages` | Create sets, add questions, bulk upload |
| CQ Exam Packages | `admin/cq-exam-packages` | Create sets, add questions, grading |
| Course Management | `admin/courses` | Create courses, lessons, assignments |
| Blog Management | `admin/blog` | Create/edit blog posts, tags, categories |
| Workflow Automation | `admin/workflow` | Automated content workflows |
| Trash Management | `admin/trash` | Recover soft-deleted content |
| Suggestion System | `admin/suggestions` | Content suggestion editor |
| Teacher Moderators | `admin/teacher-moderators` | Moderator role management |
| Featured Content | `admin/featured` | Featured content curation |
| Content Purchases | `admin/content-purchases` | Purchase tracking |
| Subscription Plans | `admin/plans` | Subscription plan management |
| CMS | `admin/banners`, `admin/notices`, `admin/faqs` | Content management |
| Analytics | `admin/analytics/*` | Revenue, students, retention, conversion |
| Database | `admin/database` | Export, import, reset |
| Audit Logs | `admin/audit-logs` | View admin action history |
| Version History | `admin/version-history` | Content version tracking and rollback |
| Settings | `admin/settings` | Site configuration (General, Security, Payment, etc.) |

### Auth Pattern

All admin routes use:
```typescript
const auth = await withAdmin(request)
if (auth instanceof NextResponse) return auth
// auth.user.id, auth.isAdmin, auth.isSuperAdmin available
```

---

## 8. Student Side

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Featured content, notices, navigation |
| Class List | `/class-list` | Browse all classes |
| Class Hub | `/class-detail` | Subjects for a class |
| Subject Hub | `/subject-detail` | Chapters for a subject |
| Chapter Hub | `/chapter-detail` | Content for a chapter |
| MCQ Practice | `/mcq` | MCQ question practice |
| CQ Practice | `/cq` | Creative question practice |
| Lectures | `/lecture-list` | Video/text lectures |
| Board Questions | `/board-questions` | Historical board questions |
| Exam Center | `/exam-center` | Custom exam creation |
| Exam Session | `/exam-session` | Taking an exam |
| Premium | `/premium` | Premium packages and bundles |
| Payment | `/payment` | Payment form |
| Search | `/search` | Global content search |
| Dashboard | `/user-dashboard` | User profile and stats |
| Learning Dashboard | `/learning-dashboard` | Learning analytics and insights |
| Learning Calendar | `/learning-calendar` | Study schedule and calendar |
| Notes | `/notes` | Personal notes |
| Bookmarks | `/bookmarks` | Saved content |
| Certificates | `/certificates` | Course certificates |
| Achievements | `/achievements` | Gamification achievements |
| Revision | `/revision` | Spaced repetition revision |
| Blog | `/blog` | Educational blog articles |

### Learning Preference System

Two modes control content filtering:

- **GLOBAL** (`সার্বজনীন`): Shows content from all classes. Cannot purchase class-specific packages without selecting a class first.
- **CLASS_BASED**: Shows content only for the selected class. Required for package purchases.

The `LearningPreferenceProvider` wraps the entire app and exposes `learningMode`, `classLevel`, and `setPreference()`.

---

## 9. Payment System

### Flow

```
User clicks Buy → Payment Page → Select Method → Enter Transaction ID → Submit
                                                                        ↓
POST /api/payment → Validate → Create Payment (PENDING) → Notify Admin
                                                              ↓
Admin reviews → Approve/Reject → DB Transaction (atomic)
                                      ↓
                          Create Subscription/Purchase → Notify User → Audit Log
```

### Payment Types

| Type | Model | Post-Approval Action |
|------|-------|---------------------|
| `course` | `CoursePurchase` + `CourseEnrollment` | Enroll user in course |
| `package` | `UserSubscription` | Create/extend subscription |
| `mcq-exam-package` | `MCQExamPackagePurchase` | Grant exam access |
| `cq-exam-package` | `CQExamPackagePurchase` | Grant exam access |
| `bundle` | Direct payment check | Check all bundle items purchased |
| `mcq`, `cq`, etc. | Direct payment check | Grant single content access |

### Transaction Atomicity

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

### Access Resolution

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

### Duplicate Prevention

- Payment: `@@unique([userId, contentType, contentId, status])` + idempotency keys
- Subscription: `@@unique([userId, packageId, classLevel])`
- Exam purchases: `@@unique([userId, packageId])`

---

## 10. Premium System

### Package Subscriptions

- **ContentPackage**: Defines packages (duration, price, class targeting)
- **UserSubscription**: Active subscriptions (userId, packageId, classLevel, endDate)
- Subscription grants access to ALL premium content for the subscribed class
- Renewal extends `endDate` by package duration

### Bundles

- **ContentBundle**: Curated content collections
- **BundleItem**: Individual items in a bundle
- Access requires ALL bundle items to be individually purchased
- Partial access reported (X of Y items purchased)

### MCQ/CQ Exam Packages

- Separate purchase models (`MCQExamPackagePurchase`, `CQExamPackagePurchase`)
- Not covered by subscriptions — require dedicated purchase
- Can also be accessed via course enrollment

### Access Matrix

| Content Type | Subscription | Direct Purchase | Bundle | Course |
|-------------|-------------|----------------|--------|--------|
| MCQ | ✅ | ✅ | ✅ | — |
| CQ | ✅ | ✅ | ✅ | — |
| Lecture | ✅ | ✅ | ✅ | — |
| Exam | ✅ | ✅ | ✅ | — |
| Suggestion | ✅ | ✅ | ✅ | — |
| Short Questions | ✅ | ✅ | ✅ | — |
| Board MCQ/CQ | ✅ | ✅ | ✅ | — |
| MCQ Exam Package | ✅ | ✅ | — | ✅ |
| CQ Exam Package | — | ✅ | — | ✅ |
| Course | — | ✅ | — | — |

---

## 11. Learning Preference

### Modes

| Mode | Bengali | Behavior |
|------|---------|----------|
| `GLOBAL` | সার্বজনীন | Shows all classes. Package purchase requires class selection first. |
| `CLASS_BASED` | শ্রেণি ভিত্তিক | Shows only selected class content. Required for package purchases. |

### Implementation

- **Provider**: `LearningPreferenceProvider` wraps the app
- **State**: `learningMode` + `classLevel` (persisted via API + auth store)
- **API**: `PUT /api/user/learning-preference` saves preference
- **Filtering**: API routes read `auth.user.learningMode` and `auth.user.classLevel` to filter content
- **Premium Page**: Global mode shows banner prompting class selection before purchase

### Business Rules

- Users in GLOBAL mode cannot purchase class-specific packages without selecting a class first
- Selecting a class switches to CLASS_BASED mode automatically
- Switching back to GLOBAL clears the class level
- All content APIs filter by class level when in CLASS_BASED mode

---

## 12. Content System

### Hierarchy

```
ClassCategory (Class 6, 7, 8, SSC, HSC)
  └── Subject (Math, Physics, Chemistry, ...)
        └── Chapter (Algebra, Geometry, ...)
              ├── Lecture (Video/text content)
              ├── MCQ (Multiple choice questions)
              ├── CQ (Creative questions)
              ├── KnowledgeQuestion (Knowledge/comprehension)
              └── Topic (Optional sub-chapter)
```

### Content Types

| Type | Model | Premium | Access Method |
|------|-------|---------|---------------|
| Lecture | `Lecture` | Optional | Direct purchase or subscription |
| MCQ | `MCQ` | Optional | Direct purchase, subscription, or bundle |
| CQ | `CQ` | Optional | Direct purchase, subscription, or bundle |
| Board MCQ | `MCQ` (with board/year) | Optional | Direct purchase, subscription, or bundle |
| Board CQ | `CQ` (with board/year) | Optional | Direct purchase, subscription, or bundle |
| Knowledge | `KnowledgeQuestion` | Optional | Direct purchase or subscription |
| Suggestion | `Suggestion` | Optional | Direct purchase or subscription |
| Exam | `Exam` | Optional | Direct purchase or subscription |

### Board Questions

- `Board` model: Board names (Dhaka, Rajshahi, etc.)
- `ExamYear` model: Exam years (2024, 2023, etc.)
- `BoardYear` model: Board+year combinations
- MCQ/CQ can be tagged with board and year for filtering

---

## 13. API Documentation

### Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

Error format:
```json
{
  "success": false,
  "error": "Error message in Bengali",
  "code": "ERROR_CODE",
  "details": [{ "field": "fieldName", "message": "Specific error" }]
}
```

### Key Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | User login |
| `/api/auth/register` | POST | No | User registration |
| `/api/auth/logout` | POST | Yes | User logout |
| `/api/user/profile` | GET/PUT | Yes | User profile |
| `/api/user/learning-preference` | GET/PUT | Yes | Learning mode preference |
| `/api/payment` | POST | Yes | Create payment |
| `/api/payment/access` | GET | Yes | Check single item access |
| `/api/payment/batch-check` | POST | Yes | Batch access check |
| `/api/admin/payments` | GET/PATCH | Admin | Payment list/review |
| `/api/admin/mcq` | GET/POST/PUT/DELETE | Admin | MCQ CRUD |
| `/api/admin/cq` | GET/POST/PUT/DELETE | Admin | CQ CRUD |
| `/api/admin/lectures` | GET/POST/PUT/DELETE | Admin | Lecture CRUD |
| `/api/admin/bundles` | GET/POST/PUT/DELETE | Admin | Bundle CRUD |
| `/api/admin/packages` | GET/POST/PUT/DELETE | Admin | Package CRUD |
| `/api/admin/users` | GET/PUT | Admin | User management |
| `/api/hierarchy/metadata` | GET | No | Class/subject/chapter tree |

### Validation

All mutation endpoints should use `validateBody()` with Zod schemas defined in `src/lib/validations.ts`.

---

## 14. React Query

### Query Key Factory

All keys defined in `src/lib/query-keys.ts`:
```typescript
export const queryKeys = {
  config: ['config'] as const,
  hierarchyMetadata: ['hierarchyMetadata'] as const,
  subjects: (classSlug: string) => ['subjects', classSlug] as const,
  chapters: (subjectId: string) => ['chapters', subjectId] as const,
  // ... 30+ key factories
}
```

### Cache Invalidation

After mutations, invalidate relevant queries:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.subjects(classSlug) })
```

The `LearningPreferenceProvider` invalidates all content queries when preference changes.

### Dehydration

Server-side prefetch in `layout.tsx`:
```typescript
const queryClient = new QueryClient()
await queryClient.prefetchQuery({ queryKey: queryKeys.config, queryFn: fetchSiteConfig })
const dehydratedState = dehydrate(queryClient)
```

---

## 15. Transactions

### safeTransaction

```typescript
import { safeTransaction } from '@/lib/errors'

await safeTransaction(async (tx) => {
  // All database operations use `tx`, NOT `db`
  await tx.payment.update({ where: { id }, data: { status: 'APPROVED' } })
  await tx.userSubscription.create({ data: { ... } })
  await tx.notification.create({ data: { ... } })
})
```

### Critical Rule

**NEVER use `db` inside a `safeTransaction` callback.** Always use `tx`. Using `db` bypasses the transaction boundary and causes data inconsistency on rollback.

### Retry Logic

- Retries on Prisma `P2034` (transaction conflict/deadlock)
- Max 2 retries by default
- Other errors throw immediately

---

## 16. Validation

### Zod Schemas

Defined in `src/lib/validations.ts`:
```typescript
export const createPaymentSchema = z.object({
  amount: z.coerce.number().min(0),
  method: z.enum(['bkash', 'nagad', 'rocket']),
  transactionId: z.string().min(1).max(100),
  paymentNumber: z.string().min(1).max(20),
  contentType: z.string().optional(),
  contentId: z.string().optional(),
  classLevel: z.string().optional(),
})
```

### Usage

```typescript
import { validateBody } from '@/lib/api-utils'

const validation = validateBody(createPaymentSchema, body)
if ('error' in validation) return validation.error
const { amount, method } = validation.data
```

---

## 17. Security

### Authentication
- JWT in HttpOnly cookies (jose library)
- 7-day expiry, HS256 signing
- Session verified on every request via `proxy.ts`

### Authorization
- Role-based: STUDENT, ADMIN, SUPER_ADMIN
- Granular permissions via `Permission` + `RolePermission` models
- `withAdmin()` guard on all admin mutation endpoints

### CSRF Protection
- JWT-based CSRF tokens signed with `CSRF_SECRET`
- Validated on all POST/PUT/PATCH/DELETE via `withCsrf()`
- Token sent via `x-csrf-token` header or `_csrf` body field

### Rate Limiting
- Upstash Redis-backed rate limiter
- Applied to auth endpoints, API endpoints, admin mutations
- `withAdmin()` auto-applies rate limiting for non-GET requests

### Input Sanitization
- DOMPurify strips scripts/event handlers from HTML at Prisma middleware layer
- Zod validation on all mutation inputs
- SQL injection prevented by Prisma ORM

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- CSP with nonce (via proxy.ts)
- HSTS in production

### Audit Logging
- `AuditLog` model captures all admin mutations
- Records: action, entityType, entityId, oldData, newData, adminId, IP, userAgent
- Immutable (append-only, update/delete blocked at Prisma middleware)

---

## 18. Caching

### React Query

- Server-side prefetch in `layout.tsx` (dehydrated state)
- Client-side cache with default staleTime
- Manual invalidation after mutations via `queryClient.invalidateQueries()`

### HTTP Caching

| Resource | Cache Header |
|----------|-------------|
| Static assets (images, fonts) | `Cache-Control: public, max-age=31536000, immutable` |
| API responses | `Cache-Control: no-store` (dynamic) |
| Site config | Prefetched with `staleTime: 300000` (5 min) |

### Database Caching

- `content-type-labels.ts`: In-memory cache with 5-minute TTL
- `csrf.ts`: In-memory cache for CSRF setting (30-second TTL)

---

## 19. Coding Standards

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `payment-helpers.ts` |
| Components | PascalCase | `PackageCard.tsx` |
| Hooks | camelCase with `use` prefix | `useLearningPreference` |
| API routes | kebab-case directories | `api/admin/mcq-exam-packages/` |
| Zod schemas | camelCase with `Schema` suffix | `createPaymentSchema` |
| Types | PascalCase | `ContentPackage`, `AuthResult` |

### File Placement

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

### API Route Pattern

```typescript
import { withAdmin, withCsrf, validateBody, apiResponse, apiError } from '@/lib/api-utils'
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

---

## 20. How To Add New Features

### New API Route

1. Create `src/app/api/{domain}/route.ts`
2. Define Zod schema in `src/lib/validations.ts`
3. Use `withAdmin()` or `verifyAuth()` for auth
4. Use `validateBody()` for input validation
5. Use `handleApiError()` in catch block
6. Return `apiResponse(data)` or `apiError(message, status)`

### New Database Model

1. Add model to `prisma/schema.prisma`
2. Run `npm run db:push`
3. If soft-delete needed: add to `SOFT_DELETE_MODELS` in `src/lib/soft-delete.ts`
4. If HTML fields: add to `HTML_FIELDS` in `src/lib/db.ts`
5. Add query key to `src/lib/query-keys.ts`

### New Admin Module

1. Create API routes in `src/app/api/admin/{module}/`
2. Create admin page in `src/components/admin/Admin{Module}Page.tsx`
3. Add route to `src/store/router.ts`
4. Add nav item to admin sidebar
5. Use `withAdmin()` on all mutation endpoints

### New Student Feature

1. Create page component in `src/components/{feature}/`
2. Add route to `src/store/router.ts` and `src/lib/urls.ts`
3. Add nav item if needed
4. Use `useQuery()` for data fetching
5. Use `useLearningPreference()` for content filtering

### New Payment Type

1. Add `contentType` handling to `src/app/api/payment/access/route.ts`
2. Add to `src/app/api/payment/batch-check/route.ts`
3. Add purchase model to `prisma/schema.prisma`
4. Add handler in `src/app/api/admin/payments/route.ts` (POST approval)
5. Update `src/lib/payment-helpers.ts` if subscription-based

---

## 21. Common Mistakes

### ❌ Using `db` Instead of `tx` in Transactions

```typescript
// WRONG — bypasses transaction
await safeTransaction(async (tx) => {
  await db.payment.update(...)  // ❌ Uses global client
})

// CORRECT
await safeTransaction(async (tx) => {
  await tx.payment.update(...)  // ✅ Uses transaction client
})
```

### ❌ Missing Cache Invalidation

```typescript
// WRONG — UI shows stale data
await mutateAsync(data)

// CORRECT
await mutateAsync(data)
queryClient.invalidateQueries({ queryKey: queryKeys.something })
```

### ❌ Inconsistent Content Type Handling

Always update BOTH `access/route.ts` AND `batch-check/route.ts` when adding content types. Use shared helpers from `payment-helpers.ts`.

### ❌ Missing handleApiError

```typescript
// WRONG — raw error response
catch (error) {
  return apiError('Error', 500)
}

// CORRECT — centralized error handling
catch (error) {
  return handleApiError(error, 'Context')
}
```

### ❌ Admin Route Without Auth Guard

```typescript
// WRONG — no authentication
export async function POST(request: Request) {
  const body = await request.json()
}

// CORRECT
export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
}
```

---

## 22. Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Test Structure

```
tests/                          # Integration tests (require running server)
  e2e.test.ts                   # Auth endpoint tests
  payment-flow.test.ts          # Payment endpoint tests
  api-response-format.test.ts   # Response format tests

src/lib/__tests__/              # Unit tests
  validations.test.ts           # Zod schema validation
  errors.test.ts                # Error handling
  safe-transaction.test.ts      # Transaction safety
  auth.test.ts                  # Auth utilities
  access-control.test.ts        # Content access
  audit-integrity.test.ts       # Audit logging
  ...

src/features/shared/exam-engine/__tests__/  # Exam engine tests
  time-window.test.ts
  helpers.test.ts
  access.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { createPaymentSchema } from '@/lib/validations'

describe('createPaymentSchema', () => {
  it('accepts valid payment', () => {
    const result = createPaymentSchema.parse({
      amount: 100,
      method: 'bkash',
      transactionId: 'TXN123',
      paymentNumber: '01700000000',
    })
    expect(result.amount).toBe(100)
  })
})
```

---

## 23. Deployment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |
| `CSRF_SECRET` | Yes | CSRF token signing secret (32+ chars) |
| `SUPER_ADMIN_EMAIL` | Yes | Default super admin email |
| `SUPER_ADMIN_PASSWORD` | Yes | Default super admin password |
| `ENABLE_CSRF` | No | Enable CSRF in dev (`true`/`false`) |
| `SENTRY_DSN` | No | Sentry error tracking |
| `STANDALONE_OUTPUT` | No | Enable standalone build |

### Build & Deploy

```bash
# Development
npm run dev

# Production build
STANDALONE_OUTPUT=true npm run build

# Start production
npm run start
```

### Database Migration

```bash
npm run db:push      # Push schema changes
npm run db:generate  # Regenerate Prisma client
npm run db:reset     # Reset and re-seed
```

### Production Checklist

- [ ] `JWT_SECRET` set to strong random value
- [ ] `CSRF_SECRET` set to strong random value
- [ ] `ENABLE_CSRF=true` in production
- [ ] `STANDALONE_OUTPUT=true` for Docker deployment
- [ ] Sentry DSN configured
- [ ] Database backed up
- [ ] Admin accounts created via `npm run create-super-admin`

---

## 24. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `PrismaClientInitializationError` | Missing `DATABASE_URL` | Set `DATABASE_URL` to PostgreSQL connection string in `.env` |
| `CSRF_INVALID` on mutations | CSRF token expired/missing | Refresh page or call `/api/csrf-token` |
| `UNAUTHORIZED` on admin routes | Not logged in as admin | Login with admin account |
| Blank page after login | Zustand store not hydrated | Clear localStorage `edu-auth` key |
| Subscription not created after payment | Admin approval handler missing `tx` | Ensure `handleSubscriptionCreation` uses `tx` parameter |
| Content not filtered by class | `learningMode` not set | Set learning preference via `/api/user/learning-preference` |
| `P2002` unique constraint error | Duplicate payment/subscription | Normal — means user already has this payment/subscription |

---

## 25. Future Roadmap

### Short Term (1-2 sprints)

- [ ] Add unit tests for payment access and batch-check routes
- [ ] Add Zod validation schemas to remaining 36 mutation routes
- [ ] Split oversized files (7 files over 1000 lines)
- [ ] Add rate limiting to user feedback endpoints

### Medium Term (1-2 months)

- [ ] ~~Migrate from SQLite to PostgreSQL for production scaling~~ ✅ Done
- [ ] Add automated payment gateway integration (bKash/Nagad API)
- [ ] Implement real-time notifications via WebSocket
- [ ] Add content versioning UI for admins
- [ ] Implement spaced repetition for MCQ practice ✅ Done (RevisionQueue)

### Long Term (3-6 months)

- [ ] Mobile app (React Native or PWA)
- [ ] Live class/video streaming
- [ ] AI-powered content recommendations
- [ ] Multi-language support (English + Bangla)
- [ ] Parent/guardian dashboard
- [ ] Certificate verification system

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the [Coding Standards](#19-coding-standards)
4. Add tests for new features
5. Run `npm test` and `npm run lint` before committing
6. Commit with descriptive messages
7. Open a Pull Request

## License

ISC
