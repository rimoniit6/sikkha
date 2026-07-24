# COMPLETE ARCHITECTURE AUDIT: LECTURE MODULE

## Prepared for Blog Module Parity

---

## PHASE 1 — LECTURE SYSTEM ARCHITECTURE

### 1.1 Full Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/app/admin/lectures/page.tsx                                │
│       │                                                         │
│       ▼                                                         │
│  src/components/admin/AdminShell.tsx                            │
│       │                                                         │
│       ▼                                                         │
│  src/components/admin/AdminLayout.tsx                           │
│       │  (lazy-loads 'admin-lectures' → AdminLecturesPage)      │
│       ▼                                                         │
│  src/components/admin/AdminLecturesPage.tsx                     │
│       │  (state management, data fetching, orchestration)       │
│       ├──► src/hooks/admin/use-lectures.ts                     │
│       │        │                                                │
│       │        ▼                                                │
│       │    src/services/api/lecture.service.ts                  │
│       │        │                                                │
│       │        ▼                                                │
│       │    src/lib/api-client.ts (ApiClient singleton)          │
│       │                                                         │
│       ├──► src/components/admin/lectures/ListView.tsx           │
│       │        └──► src/components/shared/DataTable.tsx         │
│       │                                                         │
│       ├──► src/components/admin/lectures/EditorView.tsx         │
│       │        ├──► src/components/ui/content-block-editor.tsx  │
│       │        │        └──► RichTextBlockEditor.tsx            │
│       │        ├──► src/components/ui/image-uploader.tsx        │
│       │        ├──► src/components/ui/switch.tsx                │
│       │        └──► src/components/admin/lectures/StepIndicator │
│       │                                                         │
│       └──► src/components/admin/lectures/DeleteConfirm.tsx      │
│                └──► src/components/ui/alert-dialog.tsx          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/app/api/admin/lectures/route.ts                            │
│       │  GET (list), POST (create), PUT (update), DELETE (soft) │
│       │                                                         │
│       ├──► src/lib/api-utils.ts                                 │
│       │        (apiResponse, apiError, withAdmin, withCsrf,     │
│       │         validateBody, parseIdsParam, paginatedResponse) │
│       │                                                         │
│       ├──► src/lib/errors.ts (handleApiError)                   │
│       ├──► src/lib/cache-invalidate.ts (invalidateContentCache) │
│       ├──► src/lib/premium.ts (deriveIsPremium)                 │
│       ├──► src/lib/slug.ts (slugify)                            │
│       ├──► src/lib/audit.ts (auditFromRequest)                  │
│       ├──► src/lib/delete-guard.ts (guardDeleteDependencies)    │
│       └──► src/lib/workflow.ts (transitionWorkflow)             │
│                                                                 │
│  src/app/api/lectures/route.ts (public GET)                     │
│  src/app/api/lectures/[id]/route.ts (public GET)                │
│  src/app/api/user/recent-lectures/route.ts                      │
│  src/app/api/admin/analytics/lectures/route.ts                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  prisma/schema.prisma                                           │
│       │                                                         │
│       ├──► model Lecture (211-238)                              │
│       │      Fields: id, title, slug, chapterId, content,       │
│       │      videoUrl, audioUrl, pdfUrl, thumbnail, duration,   │
│       │      order, isPremium, price, viewCount, isActive,      │
│       │      deletedAt/deletedBy/deleteReason, timestamps       │
│       │      Relations: chapter (→Chapter), resources (→Resource[])│
│       │      Indexes: [chapterId,isActive,deletedAt],           │
│       │               [isPremium,isActive,deletedAt]            │
│       │                                                         │
│       ├──► model Resource (240-256)                             │
│       │      Fields: id, lectureId, title, type, url, size,     │
│       │      isActive, deletedAt/deletedBy/deleteReason, createdAt│
│       │                                                         │
│       ├──► model Chapter (134-159) — parent                     │
│       └──► model Subject → model ClassCategory                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/lib/soft-delete.ts        (34 models, cascade rules)       │
│  src/lib/audit.ts              (120+ actions, 47 entity types)  │
│  src/lib/version-history.ts    (13 versionable models)          │
│  src/lib/workflow.ts           (7 states, 8 actions, 13 models) │
│  src/lib/cache-invalidate.ts   (19 content types)               │
│  src/lib/cache-headers.ts      (HTTP cache presets)             │
│  src/lib/query-keys.ts         (React Query key registry)       │
│  src/lib/slug.ts               (Bengali transliteration)        │
│  src/lib/slug-unique.ts        (uniqueness checks)              │
│  src/lib/sanitize.ts           (DOMPurify HTML sanitizer)       │
│  src/lib/sanitize-content.ts   (LaTeX content cleaning)         │
│  src/lib/seo.ts                (route metadata)                 │
│  src/lib/seo.server.ts         (DB-based SEO overrides)         │
│  src/lib/seo-settings.ts       (global site SEO)                │
│  src/lib/featured-content-registry.ts (18 content types)        │
│  src/lib/api-client.ts         (ApiClient with CSRF, retry)     │
│  src/lib/api-utils.ts          (response builders, auth guards) │
│  src/lib/premium.ts            (deriveIsPremium)                │
│  src/lib/errors.ts             (error classes, handleApiError)  │
│  src/lib/logger.ts             (structured logging)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/app/lectures/page.tsx          → LectureListPage            │
│  src/app/lectures/loading.tsx       → PageSkeleton               │
│  src/app/lecture/[lectureId]/page.tsx → LectureViewerPage        │
│  src/app/lecture/[lectureId]/loading.tsx → LectureSkeleton       │
│                                                                 │
│  src/components/lecture/LectureListPage.tsx                      │
│  src/components/lecture/LectureViewerPage.tsx                    │
│  src/components/chapter-hub/tabs/LecturesTab.tsx                │
│  src/components/chapter-hub/cards/LectureCard.tsx                │
│                                                                 │
│  Cross-references (lectures appear in):                         │
│  src/app/api/bookmarks/* (contentType: 'lecture')               │
│  src/app/api/user/dashboard/* (lecture counts/progress)         │
│  src/app/api/search/* (lecture search results)                  │
│  src/app/api/stats/* (total lecture count)                      │
│  src/app/api/pdf/* (lecture PDF access)                         │
│  src/app/api/bundles/* (lecture in bundles)                     │
│  src/app/api/content/bundles-for/* (lecture counts)             │
│  src/app/api/classes/[slug]/* (lectures per subject)            │
│  src/app/api/chapters/[id]/* (lecture counts per chapter)       │
│  src/app/api/user/recent-lectures/* (recently viewed)           │
│  src/app/api/admin/analytics/lectures/* (analytics)             │
│  src/components/analytics/LecturesDashboard.tsx                 │
│  src/components/home/FeaturedContentSection.tsx (featured)      │
│  src/lib/featured-content-registry.ts (lecture registration)    │
│  src/app/sitemap.ts (static /lectures entry only)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 File Inventory

| Layer | Files | Count |
|-------|-------|-------|
| Prisma schema | `prisma/schema.prisma` (Lecture + Resource + Chapter) | 1 |
| Admin API routes | `api/admin/lectures/route.ts` | 1 |
| Public API routes | `api/lectures/route.ts`, `api/lectures/[id]/route.ts` | 2 |
| User API routes | `api/user/recent-lectures/route.ts` | 1 |
| Analytics API | `api/admin/analytics/lectures/route.ts` | 1 |
| Admin pages | `admin/lectures/page.tsx` | 1 |
| Admin components | `AdminLecturesPage.tsx`, `lectures/ListView.tsx`, `lectures/EditorView.tsx`, `lectures/DeleteConfirm.tsx`, `lectures/StepIndicator.tsx`, `lectures/types.ts` | 6 |
| Service | `services/api/lecture.service.ts` | 1 |
| Hook | `hooks/admin/use-lectures.ts` | 1 |
| Frontend pages | `lectures/page.tsx`, `lectures/loading.tsx`, `lecture/[lectureId]/page.tsx`, `lecture/[lectureId]/loading.tsx` | 4 |
| Frontend components | `LectureListPage.tsx`, `LectureViewerPage.tsx`, `LecturesTab.tsx`, `LectureCard.tsx` | 4 |
| Analytics component | `LecturesDashboard.tsx` | 1 |
| **Total lecture-specific** | | **24** |

---

## PHASE 2 — REUSABLE COMPONENTS FOR BLOG

### 2.1 Fully Reusable (No Modification Needed)

| Component | File Path | Used By Lecture | Used By Blog |
|-----------|-----------|:---:|:---:|
| RichTextBlockEditor | `src/components/ui/RichTextBlockEditor.tsx` | Yes | Yes |
| ImageUploader | `src/components/ui/image-uploader.tsx` | Yes | Yes |
| SlugField | `src/components/ui/slug-field.tsx` | No | Yes |
| SlugFieldWithAutoSlug | `src/components/ui/slug-field-with-auto-slug.tsx` | No | Yes |
| Switch | `src/components/ui/switch.tsx` | Yes | Yes |
| Dialog | `src/components/ui/dialog.tsx` | Yes | Yes |
| AlertDialog | `src/components/ui/alert-dialog.tsx` | Yes | No |
| Toast/Toaster | `src/components/ui/toast.tsx`, `toaster.tsx` | Yes | Yes |
| MultiSelect | `src/components/ui/multi-select.tsx` | No | Yes |
| Card | `src/components/ui/card.tsx` | Yes | Yes |
| Tabs | `src/components/ui/tabs.tsx` | Yes | Yes |
| Badge | `src/components/ui/badge.tsx` | Yes | Yes |
| Button | `src/components/ui/button.tsx` | Yes | Yes |
| Input | `src/components/ui/input.tsx` | Yes | Yes |
| Textarea | `src/components/ui/textarea.tsx` | Yes | Yes |
| Label | `src/components/ui/label.tsx` | Yes | Yes |
| Select | `src/components/ui/select.tsx` | Yes | Yes |
| Command | `src/components/ui/command.tsx` | Yes | Yes |
| Popover | `src/components/ui/popover.tsx` | Yes | Yes |
| Separator | `src/components/ui/separator.tsx` | Yes | Yes |
| Skeleton | `src/components/ui/skeleton.tsx` | Yes | Yes |
| Breadcrumb | `src/components/ui/breadcrumb.tsx` | Yes | Yes |
| RichContentRenderer | `src/components/ui/rich-content-renderer.tsx` | No | Yes |
| TableOfContents | `src/components/ui/table-of-contents.tsx` | No | Yes |

### 2.2 Reusable Infrastructure (Server-Side)

| Utility | File Path | Blog Status |
|---------|-----------|-------------|
| Soft Delete | `src/lib/soft-delete.ts` | Registered (blogPost, blogCategory) |
| Audit Logging | `src/lib/audit.ts` | Registered (8 blog actions) |
| Cache Invalidation | `src/lib/cache-invalidate.ts` | Registered (blog type) |
| Slug Generation | `src/lib/slug.ts` | Content-agnostic |
| Slug Uniqueness | `src/lib/slug-unique.ts` | Registered (blogPost, blogCategory) |
| HTML Sanitizer | `src/lib/sanitize.ts` | Content-agnostic |
| Query Keys | `src/lib/query-keys.ts` | Registered (blog namespace) |
| API Client | `src/lib/api-client.ts` | Content-agnostic |
| API Utils | `src/lib/api-utils.ts` | Content-agnostic |
| Error Handler | `src/lib/errors.ts` | Content-agnostic |
| Featured Registry | `src/lib/featured-content-registry.ts` | Registered (blogPost) |
| SEO Settings | `src/lib/seo-settings.ts` | Global |
| Sitemap | `src/app/sitemap.ts` | Registered (posts + categories + tags) |

### 2.3 NOT Reusable (Lecture-Specific)

| Component/Logic | File Path | Why Not Reusable |
|-----------------|-----------|------------------|
| ContentBlockEditor | `src/components/ui/content-block-editor.tsx` | Block-based multi-type content (math, data, mindmap) designed for educational content. Blog uses simpler RichTextBlockEditor. |
| Lecture-specific admin state | `AdminLecturesPage.tsx` | Manages Class→Subject→Chapter cascade. Blog has Category+Tags flat model. |
| StepIndicator | `src/components/admin/lectures/StepIndicator.tsx` | Tied to Lecture's 3-step wizard. Blog uses tabs. |
| DataTable (admin) | `src/components/shared/DataTable.tsx` | Lecture uses grid+table dual view. Blog uses simpler table. |
| Premium toggle + price | EditorView.tsx | Blog has no monetization. |
| Video/Audio/PDF fields | EditorView.tsx | Blog uses featured image + attachments. |
| WorkflowPanel | EditorView.tsx | Blog has no workflow integration. |
| Lecture hierarchy selects | EditorView.tsx | Class→Subject→Chapter cascade doesn't apply to blog. |

---

## PHASE 3 — LECTURE-SPECIFIC LOGIC

| Feature | Location | Why Blog Cannot Reuse |
|---------|----------|----------------------|
| **Class→Subject→Chapter hierarchy** | `EditorView.tsx`, `api/admin/lectures/route.ts` | Blog is flat (Category+Tags), not hierarchical |
| **Video URL field** | `EditorView.tsx` | Blog doesn't have video lectures |
| **Audio URL field** | `EditorView.tsx` | Blog doesn't have audio content |
| **PDF URL field** | `EditorView.tsx` | Blog has file attachments via a different mechanism |
| **Duration field (minutes)** | `EditorView.tsx`, Prisma model | Blog uses readingTime (auto-calculated) |
| **Order field** | Prisma model | Blog doesn't need explicit ordering (uses publishedAt) |
| **Premium/Price fields** | `EditorView.tsx`, `api/admin/lectures/route.ts` | Blog has no monetization |
| **ContentBlock[] multi-block model** | `content-block-editor.tsx` | Blog uses single HTML string |
| **Resource model** | Prisma schema | Blog uses BlogPostTag + file attachments |
| **Workflow integration** | `workflow.ts`, `EditorView.tsx` | Blog has no workflow state machine |
| **Version history** | `version-history.ts`, `api/admin/lectures/route.ts` | Blog has no version tracking |
| **Delete guard dependencies** | `delete-guard.ts` | Blog not registered |
| **Chapter navigation** | `LectureViewerPage.tsx` sidebar | Blog doesn't navigate by chapter |
| **Reading progress tracking** | `LectureViewerPage.tsx` | Blog has reading progress bar but no server-side tracking |
| **Bookmark integration** | `api/bookmarks/*` | Blog doesn't support bookmarks |
| **Note-taking** | `LectureViewerPage.tsx` | Blog doesn't support notes |
| **MCQ/CQ links** | Prisma relations via Chapter | Blog doesn't link to questions |
| **Purchase/access control** | `api/lectures/route.ts`, `LectureViewerPage.tsx` | Blog is free content |
| **Analytics dashboard** | `LecturesDashboard.tsx` | Blog needs its own analytics |
| **Recently viewed tracking** | `api/user/recent-lectures/route.ts` | Blog has no recently viewed |

---

## PHASE 4 — BLOG REQUIREMENTS MAPPING

### 4.1 Admin Feature Parity Matrix

| Lecture Feature | Lecture Implementation | Blog Equivalent | Blog Status |
|----------------|----------------------|-----------------|-------------|
| **List view** | `AdminLecturesPage` + `ListView.tsx` (grid+table) | `AdminBlogPage.tsx` (table only) | Exists, no grid view |
| **Create** | 3-step wizard in `EditorView.tsx` | `AdminBlogEditor.tsx` (tabs) | Exists, different UX |
| **Edit** | Same wizard with `editId` | Same editor with `postId` | Exists |
| **Delete** | `DeleteConfirm.tsx` modal | Inline confirm | Exists, no modal |
| **Restore** | Via API + soft-delete system | Via API + soft-delete system | Exists |
| **Bulk delete** | DataTable selection + bulk API | Not implemented | Missing |
| **Rich editor** | `ContentBlockEditor` (block-based) | `RichTextBlockEditor` (WYSIWYG) | Exists, simpler |
| **Image upload** | `ImageUploader` for thumbnail | `ImageUploader` for featured+OG | Exists |
| **File upload** | PDF via `ImageUploader` | Attachments via UploadThing | Exists |
| **Slug** | Auto from title (hierarchy-based) | Auto from title + manual edit | Exists |
| **SEO** | None in editor | Meta title, description, canonical, OG | Exists |
| **Status** | isActive toggle only | DRAFT/PUBLISHED/ARCHIVED | Exists, richer |
| **Premium** | Toggle + price field | N/A | N/A for blog |
| **Preview** | Step 3 inline preview | Tab with responsive preview | Exists |
| **Draft auto-save** | None | localStorage debounced | Exists |
| **Category** | Via hierarchy (Class→Subject→Chapter) | BlogCategory select | Exists |
| **Tags** | None | MultiSelect with create | Exists |
| **Featured** | Via featured-content-registry | isFeatured + isPinned toggles | Exists |
| **Publish** | Workflow-based | Dedicated publish action | Exists |
| **Schedule** | Workflow schedule action | scheduledAt field | Exists |
| **Workflow** | Full state machine | Not implemented | Gap |
| **Version history** | Full rollback | Not implemented | Gap |
| **Audit log** | Automatic via auditFromRequest | Automatic via auditFromRequest | Exists |
| **Cache invalidation** | invalidateContentCache('lecture') | invalidateContentCache('blog') | Exists |
| **Search** | Included in /api/search | Not included | Gap |
| **Sitemap** | Static /lectures entry | Dynamic per-post entries | Exists |
| **RSS** | None | /blog/rss.xml | Exists |
| **Related posts** | Via chapter siblings | BlogRelatedPost model | Exists |
| **Author** | None (admin-only) | User relation | Exists |
| **Reading time** | None (duration field) | Auto-calculated | Exists |
| **Gallery** | None | gallery field (JSON) | Exists |

### 4.2 Missing Blog Features (Compared to Lecture)

1. **Grid view** in admin list (Lecture has dual grid+table)
2. **Bulk delete** in admin list
3. **Workflow integration** (Lecture has draft→review→approve→publish)
4. **Version history** with rollback
5. **Search integration** (Blog not in /api/search)
6. **Delete guard** (Blog not in delete-guard registry)
7. **Blog-specific analytics** endpoint

---

## PHASE 5 — DATABASE DESIGN

### 5.1 Current Blog Schema (Already Exists)

```prisma
model BlogPost {
  id              String    @id @default(cuid())
  title           String
  slug            String    @unique
  excerpt         String?
  content         String
  featuredImage   String?
  gallery         String?
  authorId        String?
  categoryId      String?
  status          String    @default("DRAFT")
  publishedAt     DateTime?
  scheduledAt     DateTime?
  viewCount       Int       @default(0)
  readingTime     Int?
  isFeatured      Boolean   @default(false)
  isPinned        Boolean   @default(false)
  allowComments   Boolean   @default(true)
  isActive        Boolean   @default(true)
  metaTitle       String?
  metaDescription String?
  canonicalUrl    String?
  ogImage         String?
  robots          String?
  jsonLd          String?
  deletedAt       DateTime?
  deletedBy       String?
  deleteReason    String?
  seriesId        String?
  seriesOrder     Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  // Relations: author, category, series, tags, relatedBy, relatedTo
  // 7 indexes
}

model BlogCategory { /* Full CRUD with soft delete */ }
model BlogTag { /* Many-to-many via BlogPostTag */ }
model BlogPostTag { /* Join table */ }
model BlogRelatedPost { /* Self-referential join */ }
model BlogSeries { /* Series grouping */ }
```

### 5.2 Recommendation: Option A (Separate Blog Model) — Already Implemented

The codebase already uses **Option A: Separate Blog model**. This is the correct choice because:

1. **Different access patterns**: Blog is public/free, Lecture is hierarchical/premium
2. **Different taxonomy**: Blog uses Category+Tags, Lecture uses Class→Subject→Chapter
3. **Different content model**: Blog is single rich-text, Lecture is multi-block
4. **Different lifecycle**: Blog has DRAFT/PUBLISHED/ARCHIVED, Lecture has workflow states
5. **No shared queries**: Blog and Lecture are never queried together
6. **Performance**: Separate models avoid NULL columns and complex JOINs

The schema is well-designed with:
- 7 indexes covering all query patterns
- Proper cascade relationships (blogCategory → blogPost)
- Self-referential related posts
- Series support for post grouping
- Full SEO metadata fields

**No schema changes needed.** The database is production-ready.

---

## PHASE 6 — ADMIN UX AUDIT

### 6.1 Lecture Create/Edit vs Blog Create/Edit

| Field | Lecture Editor | Blog Editor | Parity |
|-------|---------------|-------------|--------|
| **Title** | Input (Step 1) | Input (Tab 1) | Equal |
| **Slug** | Auto from title | Auto from title + manual edit | Blog better |
| **Hierarchy** | Class→Subject→Chapter (Step 1) | Category select (Tab 1) | Different by design |
| **Thumbnail** | ImageUploader (Step 1) | Featured Image (Tab 1) | Equal |
| **OG Image** | None | ImageUploader (Tab 1) | Blog only |
| **Tags** | None | MultiSelect (Tab 1) | Blog only |
| **Excerpt** | None | Textarea (Tab 1) | Blog only |
| **Content** | ContentBlockEditor (Step 2) | RichTextBlockEditor (Tab 1) | Different editors |
| **Video URL** | Input (Step 2) | None | Lecture only |
| **Audio URL** | Input (Step 2) | None | Lecture only |
| **PDF** | ImageUploader (Step 2) | File attachments (Tab 1) | Different approach |
| **Duration** | Number input (Step 2) | Auto readingTime (Tab 2) | Different by design |
| **Premium** | Switch + price (Step 3) | N/A | Lecture only |
| **Active** | Switch (Step 3) | Status select (Tab 1) | Blog richer |
| **Featured** | Via registry | Switch (Tab 3) | Blog only |
| **Pinned** | None | Switch (Tab 3) | Blog only |
| **Comments** | None | Switch (Tab 3) | Blog only |
| **Meta Title** | None | Input (Tab 2) | Blog only |
| **Meta Description** | None | Textarea (Tab 2) | Blog only |
| **Canonical URL** | None | Input (Tab 2) | Blog only |
| **Preview** | Step 3 inline | Tab preview with viewport switch | Blog better |
| **Auto-save** | None | localStorage debounced | Blog only |
| **Workflow** | WorkflowPanel (Step 3) | None | Lecture only |
| **Status** | isActive only | DRAFT/PUBLISHED/ARCHIVED | Blog richer |

### 6.2 Architectural Inconsistencies

1. **Editor architecture**: Lecture editor is a presentational component (props-driven). Blog editor is a monolithic container (self-contained). This is inconsistent.
2. **Navigation model**: Lecture uses wizard (linear). Blog uses tabs (non-linear). Different UX paradigms.
3. **State management**: Lecture delegates to parent. Blog owns state internally. Inconsistent patterns.
4. **Toast notifications**: Blog has them. Lecture admin does not.
5. **Error handling**: Blog uses toast. Lecture uses console.error only.

---

## PHASE 7 — USER SIDE AUDIT

### 7.1 Lecture Frontend

| Page | Route | Components |
|------|-------|------------|
| Lecture List | `/lectures` | `LectureListPage` — grouped by access status, purchase modal |
| Lecture Viewer | `/lecture/:id` | `LectureViewerPage` — sidebar nav, video, PDF, content, bookmarks, notes, progress |
| Chapter Hub Tab | Within `/class/:slug/:subject/:chapter` | `LecturesTab` + `LectureCard` |

### 7.2 Blog Frontend (Already Exists)

| Page | Route | Components |
|------|-------|------------|
| Blog Home | `/blog` | `BlogHomeClient` — featured post, paginated grid, search, sidebar |
| Blog Detail | `/blog/:slug` | `BlogDetailClient` — TOC, share, related posts, reading progress |
| Blog by Tag | `/blog/tag/:slug` | Tag-filtered grid |
| Blog by Category | `/blog/category/:slug` | Category-filtered grid |
| Blog by Author | `/blog/author/:id` | Author-filtered grid |
| RSS Feed | `/blog/rss.xml` | XML RSS feed |
| 404 Page | `/blog/not-found` | Custom not found |
| Error Page | `/blog/error.tsx` | Error boundary |

### 7.3 Blog Frontend Features Already Implemented

- Reading progress bar
- Breadcrumbs
- Featured image
- Category/tag badges
- Author display
- Date + reading time
- Share buttons (copy link, Facebook, WhatsApp)
- Rich content rendering
- Table of contents sidebar
- Prev/next navigation
- Related posts grid
- Search with debounce
- Popular posts sidebar
- Category sidebar
- JSON-LD structured data
- Full SEO metadata (OG, Twitter, canonical, robots)
- RSS feed

---

## PHASE 8 — SEO AUDIT

| SEO Feature | Lecture | Blog | Status |
|-------------|---------|------|--------|
| Dynamic metadata | `seo.ts` route meta | App Router `generateMetadata` | Both work |
| Schema.org | None | BlogPosting + BreadcrumbList JSON-LD | Blog only |
| OG Image | None | ogImage field + fallback | Blog only |
| Twitter Card | None | twitter metadata | Blog only |
| Canonical URL | None | canonicalUrl field | Blog only |
| RSS | None | /blog/rss.xml | Blog only |
| Sitemap | Static /lectures entry | Dynamic per-post | Blog better |
| robots | None | robots field | Blog only |
| Search index | Via /api/search | Not in /api/search | Gap |
| Reading time | N/A (duration field) | Auto-calculated | Blog only |

---

## PHASE 9 — PERFORMANCE AUDIT

| Aspect | Lecture | Blog |
|--------|---------|------|
| HTTP caching | `cacheHeaders.noCache` | `cacheHeaders.noCache` |
| CDN caching | None (dynamic) | None (dynamic) |
| ISR | None | None |
| Image optimization | next/image in viewer | next/image in detail |
| Pagination | Skip/take | Skip/take |
| DB indexes | 2 composite | 7 targeted |
| N+1 risk | Chapter include in list | Author+Category include |
| Bundle size | ContentBlockEditor is heavy | RichTextBlockEditor is lighter |
| Client state | React Query | React Query |
| Version counter | invalidateContentCache | invalidateContentCache |

---

## PHASE 10 — SECURITY AUDIT

| Security Feature | Lecture | Blog |
|------------------|---------|------|
| Authentication | `withAdmin` guard | `withAdmin` guard |
| Authorization | Role check (ADMIN/SUPER_ADMIN) | Role check (ADMIN/SUPER_ADMIN) |
| XSS protection | `sanitizeHtml` via DOMPurify | `sanitizeHtml` via DOMPurify |
| Image validation | ImageUploader (UploadThing) | ImageUploader (UploadThing) |
| Upload validation | File type + size checks | File type + size checks |
| Rate limiting | `apiLimiter` on public routes | Not on public blog routes |
| CSRF | `withCsrf` on mutations | `withCsrf` on mutations |
| Audit logging | `auditFromRequest` | `auditFromRequest` |
| Soft delete | `softDelete` + cascade | `softDelete` + cascade |
| Permission checks | `withAdmin` + role validation | `withAdmin` + role validation |
| Slug uniqueness | Not in slug-unique.ts | In slug-unique.ts |
| Content sanitization | Server-side before storage | Server-side before storage |

---

## PHASE 11 — IMPLEMENTATION STRATEGY

Since the Blog module **already exists** with a comprehensive implementation, the strategy focuses on **gap closure and alignment**, not greenfield development.

### Phase 1: Admin UX Alignment (Priority: High)

- Refactor `AdminBlogEditor` from monolithic container to presentational component (match Lecture pattern)
- Add grid view toggle to `AdminBlogPage` (match Lecture's dual view)
- Add bulk delete to `AdminBlogPage`
- Add delete confirmation modal (match `DeleteConfirm.tsx` pattern)
- Add toast notifications to Lecture admin (for parity)

### Phase 2: Infrastructure Gaps (Priority: Medium)

- Add Blog to delete-guard registry
- Add Blog to search integration (`/api/search` and `/api/search/suggestions`)
- Add Blog analytics endpoint (`/api/admin/analytics/blog`)
- Add rate limiting to public blog routes

### Phase 3: Feature Enhancement (Priority: Low)

- Add workflow integration for blog posts (optional — editorial review process)
- Add version history for blog posts (optional — rollback capability)
- Add blog-specific SEO route meta in `seo.ts`
- Add blog recently-viewed tracking

### Phase 4: Frontend Polish (Priority: Low)

- Add infinite scroll option for blog listing
- Add newsletter subscription block
- Add image zoom/lightbox for blog images
- Add syntax highlighting for code blocks

---

## PHASE 12 — FINAL REPORT

### 1. Lecture Architecture Diagram

```
Admin UI (wizard) → LectureService → ApiClient → REST API → Prisma → SQLite
                                                ↓
                                    handleApiError, auditFromRequest,
                                    invalidateContentCache, transitionWorkflow
```

### 2. Blog Architecture Diagram

```
Admin UI (tabs) → BlogService → ApiClient → REST API → Prisma → SQLite
                                                ↓
                                    handleApiError, auditFromRequest,
                                    invalidateContentCache, softDelete
```

### 3. Component Reuse Matrix

| Category | Reused | Lecture-Only | Blog-Only | Shared |
|----------|--------|-------------|-----------|--------|
| Rich Editor | RichTextBlockEditor | ContentBlockEditor | — | ✓ |
| Image Upload | ImageUploader | — | — | ✓ |
| Slug | — | — | SlugField, AutoSlug | Blog |
| Status | — | isActive toggle | DRAFT/PUBLISHED/ARCHIVED | Blog richer |
| Taxonomy | — | Class→Subject→Chapter | Category+Tags | Different |
| SEO | — | — | Full SEO suite | Blog only |
| Preview | — | Step 3 inline | Responsive viewport | Blog better |
| Auto-save | — | — | localStorage | Blog only |
| Premium | — | Toggle+price | — | Lecture only |
| Workflow | — | Full state machine | — | Lecture only |
| Version History | — | Full rollback | — | Lecture only |

### 4. Database Recommendation

**Status: Already implemented correctly.** Separate Blog models with proper indexes, relations, and constraints. No schema changes needed.

### 5. API Mapping

| Lecture Endpoint | Blog Equivalent | Status |
|-----------------|-----------------|--------|
| `GET /api/admin/lectures` | `GET /api/admin/blog` | Exists |
| `POST /api/admin/lectures` | `POST /api/admin/blog` | Exists |
| `PUT /api/admin/lectures` | `PUT /api/admin/blog/:id` | Exists |
| `DELETE /api/admin/lectures` | `DELETE /api/admin/blog/:id` | Exists |
| `GET /api/lectures` | `GET /api/blog` | Exists |
| `GET /api/lectures/:id` | `GET /api/blog/:slug` | Exists |
| — | `POST /api/admin/blog/:id/publish` | Blog only |
| — | `POST /api/admin/blog/:id/archive` | Blog only |
| — | `POST /api/admin/blog/:id/restore` | Blog only |
| — | `GET /api/blog/:slug/related` | Blog only |
| — | `GET /api/blog/categories` | Blog only |
| — | `GET /api/blog/tags` | Blog only |
| — | `GET /blog/rss.xml` | Blog only |

### 6. UI Mapping

| Lecture Admin | Blog Admin | Status |
|---------------|------------|--------|
| `AdminLecturesPage` (state owner) | `AdminBlogPage` (simpler) | Blog less feature-rich |
| `ListView` (grid+table) | Table only | Blog missing grid |
| `EditorView` (wizard) | `AdminBlogEditor` (tabs) | Different paradigm |
| `DeleteConfirm` (modal) | Inline confirm | Blog less polished |
| `StepIndicator` | N/A | Lecture only |

### 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Editor architectural inconsistency | Medium | Refactor BlogEditor to presentational pattern |
| Blog not in search | Medium | Add Blog to /api/search |
| Blog not in delete-guard | Low | Add to delete-guard registry |
| No workflow for blog | Low | Optional — only if editorial review needed |
| No version history for blog | Low | Optional — only if rollback needed |
| Rate limiting missing on blog | Low | Add apiLimiter to public blog routes |

### 8. Migration Strategy

No database migration needed. All code changes are additive or refactoring. Blog schema is complete and production-ready.

### 9. Estimated Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/admin/analytics/blog/route.ts` | Blog analytics endpoint |
| `src/components/admin/blog/ListView.tsx` | Grid+table dual view (optional) |
| `src/components/admin/blog/DeleteConfirm.tsx` | Delete confirmation modal |
| `src/components/admin/blog/StepIndicator.tsx` | If converting to wizard (optional) |

### 10. Estimated Files to Modify

| File | Change |
|------|--------|
| `src/features/blog/admin/AdminBlogPage.tsx` | Add grid view, bulk delete, toast |
| `src/features/blog/admin/AdminBlogEditor.tsx` | Refactor to presentational (optional) |
| `src/app/api/search/route.ts` | Add Blog to search |
| `src/app/api/search/suggestions/route.ts` | Add Blog to suggestions |
| `src/lib/delete-guard.ts` | Add Blog dependency rules |
| `src/app/api/blog/route.ts` | Add rate limiting |
| `src/app/api/blog/[slug]/route.ts` | Add rate limiting |

### 11. Complexity Score

| Dimension | Score (1-10) | Notes |
|-----------|:---:|-------|
| Schema complexity | 3 | Simple flat model, well-indexed |
| API complexity | 4 | Standard CRUD + lifecycle actions |
| Admin UI complexity | 5 | Tabbed editor, no wizard |
| Frontend complexity | 4 | Standard listing + detail |
| SEO complexity | 3 | Already comprehensive |
| Infrastructure complexity | 2 | All utilities already registered |
| **Overall** | **3.5/10** | Blog is 80% complete |

### 12. Production Readiness Plan

The Blog module is **already production-ready**. The existing implementation covers:

- Full admin CRUD with rich editor
- SEO (metadata, OG, canonical, sitemap, RSS)
- Soft delete with cascade
- Audit logging
- Cache invalidation
- Slug generation with uniqueness
- HTML sanitization
- Featured content registry
- Reading time calculation
- Responsive frontend with TOC, share, related posts

**Remaining work is polish, not foundation.** Estimated effort: 2-3 days for gap closure (search integration, delete guard, grid view, bulk delete, toast notifications, rate limiting).
