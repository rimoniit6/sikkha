# Project Structure

> Complete folder structure documentation for শিক্ষা বাংলা.

## Root

```
sikkha/
├── docs/                    # Documentation
├── prisma/                  # Database schema and seeds
├── public/                  # Static assets
├── scripts/                 # Build and utility scripts
├── src/                     # Source code
├── tests/                   # Integration tests
├── .env                     # Environment variables
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
└── vitest.config.ts         # Test configuration
```

## `src/app/` — Next.js App Router

Contains all pages and API routes.

```
src/app/
├── [...slug]/page.tsx       # Catch-all SPA entry
├── layout.tsx               # Root layout (providers, fonts, SEO)
├── page.tsx                 # Home page
├── globals.css              # Tailwind CSS entry
├── sitemap.ts               # Dynamic sitemap
├── error.tsx                # Route error boundary
├── global-error.tsx         # Root error boundary
├── loading.tsx              # Route loading state
├── not-found.tsx            # 404 page
├── admin/                   # Admin panel pages
├── api/                     # 211 REST API endpoints
├── premium/                 # Premium packages page
├── payment/                 # Payment form page
├── classes/                 # Class browsing
├── courses/                 # Course pages
├── exams/                   # Exam system
├── mcq/                     # MCQ practice
├── cq/                      # CQ practice
├── lecture/                 # Lecture viewer
├── search/                  # Global search
├── dashboard/               # User dashboard
├── notes/                   # Personal notes
├── bookmarks/               # Saved content
└── ...
```

## `src/components/` — React Components

Organized by domain.

```
src/components/
├── admin/                   # Admin panel pages (30+)
├── auth/                    # Login, register
├── classes/                 # Class/subject/chapter
├── cq/                      # Creative questions
├── exam/                    # Exam system
├── home/                    # Homepage sections
├── layout/                  # AppShell, Header, Footer
├── lecture/                 # Lecture viewer
├── mcq/                     # MCQ practice
├── payment/                 # Payment forms
├── premium/                 # Premium page, cards
├── search/                  # Global search
├── shared/                  # Shared components
├── ui/                      # shadcn/ui primitives
└── ...
```

## `src/lib/` — Core Utilities

```
src/lib/
├── db.ts                    # Prisma client singleton
├── auth.ts                  # Auth utilities
├── auth/jwt.ts              # JWT implementation
├── errors.ts                # Error classes + safeTransaction
├── api-utils.ts             # API helpers
├── validations.ts           # Zod schemas
├── payment-helpers.ts       # Payment access resolution
├── soft-delete.ts           # Soft delete logic
├── rate-limit.ts            # Rate limiting
├── csrf.ts                  # CSRF protection
├── sanitize.ts              # HTML sanitization
├── query-keys.ts            # React Query keys
├── featured-content-registry.ts # Featured content system
├── course-access-resolver.ts # Course access logic
├── content-type-labels.ts   # Content type resolution
├── version-history.ts       # Content versioning
├── audit.ts                 # Audit logging
├── logger.ts                # Structured logging
├── fetch-json.ts            # HTTP client
├── cache-headers.ts         # Cache header presets
├── seo-settings.ts          # SEO configuration
└── ...
```

## `src/hooks/` — Custom React Hooks

```
src/hooks/
├── use-learning-preference.ts   # Learning mode (GLOBAL/CLASS_BASED)
├── use-content-types.ts         # Content type resolution
├── use-hierarchy-metadata.ts    # Class/subject/chapter tree
├── use-table-selection.ts       # Table row selection
├── use-toast.ts                 # Toast notifications
├── use-csrf.ts                  # CSRF token management
├── use-bulk-content-selection.ts # Bulk content selection
├── admin/
│   ├── use-exam-results.ts      # Exam results data
│   ├── use-exams.ts             # Exams data
│   └── ...
└── ...
```

## `src/store/` — Zustand Stores

```
src/store/
├── auth.ts                 # User session (persisted)
├── router.ts               # Custom client-side router
├── exam.ts                 # Exam session state
├── analytics.ts            # Admin analytics filters
├── board-filters.ts        # Board question filters
└── chapter-filters.ts      # Chapter filters
```

## `src/providers/` — React Context

```
src/providers/
├── AuthProvider.tsx             # JWT session context
├── QueryProvider.tsx            # TanStack Query + dehydration
├── LearningPreferenceProvider.tsx # GLOBAL/CLASS_BASED mode
├── LoadingProvider.tsx          # Route loading state
└── ImageViewerProvider.tsx      # Image lightbox
```

## `src/services/` — Business Logic

```
src/services/
├── api/
│   └── exam-result.service.ts   # HTTP client for exam results
└── server/
    ├── content.service.ts        # Content resolution
    └── purchase.service.ts       # Purchase/subscription logic
```

## `src/features/` — Domain Modules

```
src/features/
├── shared/exam-engine/          # Exam engine (timing, access)
├── course/                      # Course system
├── cq-exam/                     # CQ exam packages
└── mcq-exam/                    # MCQ exam packages
```

## `prisma/` — Database

```
prisma/
├── schema.prisma            # 2000+ line schema (45+ models)
├── seed.ts                  # Database seeding
├── seed-content.ts          # Content data seeding
└── seed-data/               # Seed data files
```

## `tests/` — Integration Tests

```
tests/
├── e2e.test.ts              # Auth endpoint tests
├── payment-flow.test.ts     # Payment endpoint tests
└── api-response-format.test.ts # Response format tests
```
