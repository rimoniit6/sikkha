# MASTER REVERSE ENGINEERING & IMPLEMENTATION BLUEPRINT
## Blog Module — Clone of Lecture Architecture

---

## EXECUTIVE SUMMARY

**Current State:** The Blog module already exists with a functional implementation across ~3,500 lines of code. However, its architecture **diverges significantly** from the Lecture module's patterns. The Blog editor is a monolithic container component; the Lecture editor is a clean presentational component with parent-managed state. The Blog service lives in a feature directory; the Lecture service lives in the centralized services directory.

**Goal:** Align Blog architecture to match Lecture patterns while preserving Blog-specific features (SEO, tags, categories, reading time, etc.)

**Approach:** Refactor existing code, not rebuild from scratch. The Blog module is 80% complete — this is a 20% alignment effort.

---

## PHASE 1: FULL PROJECT DISCOVERY

### 1.1 Complete File Inventory — Lecture Module (24 files)

| # | File Path | Lines | Purpose |
|---|-----------|-------|---------|
| 1 | `prisma/schema.prisma` (Lecture model, lines 211-238) | 28 | Database schema |
| 2 | `prisma/schema.prisma` (Resource model, lines 240-256) | 17 | Child resource schema |
| 3 | `src/app/api/admin/lectures/route.ts` | 263 | Admin CRUD API |
| 4 | `src/app/api/lectures/route.ts` | 163 | Public listing API |
| 5 | `src/app/api/lectures/[id]/route.ts` | 189 | Public detail API |
| 6 | `src/app/api/user/recent-lectures/route.ts` | ~60 | Recently viewed |
| 7 | `src/app/api/admin/analytics/lectures/route.ts` | ~80 | Analytics |
| 8 | `src/app/admin/lectures/page.tsx` | 1 | Route page |
| 9 | `src/components/admin/AdminLecturesPage.tsx` | 357 | Admin state manager |
| 10 | `src/components/admin/lectures/ListView.tsx` | 397 | List view (grid+table) |
| 11 | `src/components/admin/lectures/EditorView.tsx` | 504 | 3-step wizard editor |
| 12 | `src/components/admin/lectures/DeleteConfirm.tsx` | 41 | Delete modal |
| 13 | `src/components/admin/lectures/StepIndicator.tsx` | 51 | Step progress |
| 14 | `src/components/admin/lectures/types.ts` | 53 | Type definitions |
| 15 | `src/services/api/lecture.service.ts` | 67 | API client service |
| 16 | `src/hooks/admin/use-lectures.ts` | 28 | React Query hook |
| 17 | `src/app/lectures/page.tsx` | ~20 | Public route page |
| 18 | `src/app/lectures/loading.tsx` | ~10 | Loading skeleton |
| 19 | `src/app/lecture/[lectureId]/page.tsx` | ~30 | Detail route page |
| 20 | `src/app/lecture/[lectureId]/loading.tsx` | ~10 | Loading skeleton |
| 21 | `src/components/lecture/LectureListPage.tsx` | ~400 | Public list component |
| 22 | `src/components/lecture/LectureViewerPage.tsx` | 727 | Public viewer |
| 23 | `src/components/chapter-hub/tabs/LecturesTab.tsx` | ~100 | Chapter hub tab |
| 24 | `src/components/chapter-hub/cards/LectureCard.tsx` | ~80 | Chapter hub card |

### 1.2 Complete File Inventory — Blog Module (Existing, 22 files)

| # | File Path | Lines | Purpose |
|---|-----------|-------|---------|
| 1 | `prisma/schema.prisma` (BlogPost, lines 1933-1981) | 49 | Database schema |
| 2 | `prisma/schema.prisma` (BlogCategory, lines 1905-1922) | 18 | Category schema |
| 3 | `prisma/schema.prisma` (BlogTag, lines 1924-1931) | 8 | Tag schema |
| 4 | `prisma/schema.prisma` (BlogPostTag, lines 1983-1992) | 10 | Join table |
| 5 | `prisma/schema.prisma` (BlogRelatedPost, lines 1994-2004) | 11 | Related posts |
| 6 | `prisma/schema.prisma` (BlogSeries, lines 2006-2017) | 12 | Series schema |
| 7 | `src/app/api/admin/blog/route.ts` | 151 | Admin list+create |
| 8 | `src/app/api/admin/blog/[id]/route.ts` | 174 | Admin get+update+delete |
| 9 | `src/app/api/admin/blog/[id]/publish/route.ts` | 34 | Publish action |
| 10 | `src/app/api/admin/blog/[id]/archive/route.ts` | 34 | Archive action |
| 11 | `src/app/api/admin/blog/[id]/restore/route.ts` | 29 | Restore action |
| 12 | `src/app/api/admin/blog/categories/route.ts` | 144 | Category CRUD |
| 13 | `src/app/api/admin/blog/tags/route.ts` | 119 | Tag CRUD |
| 14 | `src/app/api/blog/route.ts` | ~80 | Public listing |
| 15 | `src/app/api/blog/[slug]/route.ts` | ~60 | Public detail |
| 16 | `src/app/api/blog/[slug]/related/route.ts` | ~50 | Related posts |
| 17 | `src/app/api/blog/categories/route.ts` | ~30 | Public categories |
| 18 | `src/app/api/blog/tags/route.ts` | ~30 | Public tags |
| 19 | `src/features/blog/admin/AdminBlogPage.tsx` | 213 | Admin list page |
| 20 | `src/features/blog/admin/AdminBlogEditor.tsx` | 592 | Admin editor |
| 21 | `src/features/blog/admin/AdminBlogCategoriesPage.tsx` | 151 | Category admin |
| 22 | `src/features/blog/admin/AdminBlogTagsPage.tsx` | 139 | Tag admin |
| 23 | `src/features/blog/services/blog.service.ts` | 59 | API client service |
| 24 | `src/features/blog/hooks/use-admin-blogs.ts` | 89 | Admin hooks |
| 25 | `src/features/blog/hooks/use-blogs.ts` | 37 | Public hooks |
| 26 | `src/features/blog/types/blog.ts` | 86 | Type definitions |
| 27 | `src/features/blog/components/BlogCard.tsx` | 72 | Post card |
| 28 | `src/features/blog/components/BlogSidebar.tsx` | 34 | Sidebar |
| 29 | `src/app/blog/page.tsx` | 69 | Home page (server) |
| 30 | `src/app/blog/BlogHomeClient.tsx` | 246 | Home client |
| 31 | `src/app/blog/[slug]/page.tsx` | 178 | Detail page (server) |
| 32 | `src/app/blog/[slug]/BlogDetailClient.tsx` | 359 | Detail client |
| 33 | `src/app/blog/layout.tsx` | 25 | Layout |
| 34 | `src/app/blog/tag/[slug]/page.tsx` | 58 | Tag page |
| 35 | `src/app/blog/category/[slug]/page.tsx` | 57 | Category page |
| 36 | `src/app/blog/author/[id]/page.tsx` | 53 | Author page |
| 37 | `src/app/blog/rss.xml/route.ts` | ~60 | RSS feed |

### 1.3 Infrastructure Files Used by Both

| File | Lecture Uses | Blog Uses |
|------|:---:|:---:|
| `src/lib/db.ts` | ✓ | ✓ |
| `src/lib/api-utils.ts` | ✓ | ✓ |
| `src/lib/api-client.ts` | ✓ | ✓ |
| `src/lib/errors.ts` | ✓ | ✓ |
| `src/lib/audit.ts` | ✓ | ✓ |
| `src/lib/soft-delete.ts` | ✓ | ✓ |
| `src/lib/cache-invalidate.ts` | ✓ | ✓ |
| `src/lib/cache-headers.ts` | ✓ | ✓ |
| `src/lib/query-keys.ts` | ✓ | ✓ |
| `src/lib/slug.ts` | ✓ | ✓ |
| `src/lib/slug-unique.ts` | ✗ | ✓ |
| `src/lib/sanitize.ts` | ✓ | ✓ |
| `src/lib/premium.ts` | ✓ | ✗ |
| `src/lib/delete-guard.ts` | ✓ | ✗ |
| `src/lib/workflow.ts` | ✓ | ✗ |
| `src/lib/version-history.ts` | ✓ | ✗ |
| `src/lib/featured-content-registry.ts` | ✓ | ✓ |
| `src/lib/seo.ts` | ✓ | ✗ |
| `src/lib/seo-settings.ts` | ✓ | ✓ |
| `src/lib/rate-limit.ts` | ✓ | ✗ |
| `src/lib/access-control.ts` | ✓ | ✗ |
| `src/lib/auth.ts` | ✓ | ✓ |
| `src/store/router.ts` | ✓ | ✓ |
| `src/lib/urls.ts` | ✓ | ✓ |

---

## PHASE 2: REVERSE ENGINEER LECTURE MODULE

### 2.1 Lecture Admin Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  AdminLecturesPage.tsx (STATE OWNER - 357 lines)        │
│  ├── 22 state variables                                 │
│  ├── 14 handler functions                               │
│  ├── 4 useEffect hooks                                  │
│  ├── 3 data fetching calls (classes, subjects, chapters)│
│  └── Renders:                                           │
│       ├── ListView (18 props)                           │
│       ├── EditorView (34 props)                         │
│       └── DeleteConfirm (3 props)                       │
└─────────────────────────────────────────────────────────┘
```

**Key Pattern:** State lives in the page component. Child components are pure presentational (no state, no side effects). All data fetching and mutation logic is in the parent.

### 2.2 Blog Admin Current Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  AdminBlogPage.tsx (213 lines)                          │
│  ├── 2 state variables                                  │
│  ├── 4 handler functions                                │
│  └── Uses useAdminBlogs hook for data                    │
├─────────────────────────────────────────────────────────┤
│  AdminBlogEditor.tsx (592 lines - MONOLITHIC)           │
│  ├── 24 state variables  ← INCONSISTENT                 │
│  ├── 6 handler functions  ← WITH LECTURE PATTERN         │
│  ├── 6 useEffect hooks   ← SELF-CONTAINED               │
│  ├── 4 hook calls (data fetching inside editor)         │
│  ├── Auto-save to localStorage                          │
│  ├── Slug validation via API                            │
│  └── Handles its own create/update navigation           │
└─────────────────────────────────────────────────────────┘
```

**Key Inconsistency:** BlogEditor owns all its state and data fetching, unlike Lecture's EditorView which receives everything via props.

---

## PHASE 3: COMPLETE CLONE MATRIX

### 3.1 Admin Component Mapping

| Lecture Component | Lines | Blog Equivalent | Lines | Action Required |
|-------------------|-------|-----------------|-------|-----------------|
| `AdminLecturesPage.tsx` | 357 | `AdminBlogPage.tsx` | 213 | **MODIFY** — Add grid view, bulk delete, state management pattern |
| `lectures/ListView.tsx` | 397 | (inline in AdminBlogPage) | — | **CREATE** — Extract list view to separate component with grid+table |
| `lectures/EditorView.tsx` | 504 | `AdminBlogEditor.tsx` | 592 | **REFACTOR** — Convert from monolithic to presentational (props-driven) |
| `lectures/DeleteConfirm.tsx` | 41 | (inline confirm) | — | **CREATE** — Extract delete modal to match Lecture pattern |
| `lectures/StepIndicator.tsx` | 51 | N/A (uses tabs) | — | **KEEP** — Blog uses tabs, not wizard (different UX by design) |
| `lectures/types.ts` | 53 | `types/blog.ts` | 86 | **MODIFY** — Add missing types, align naming |

### 3.2 Service & Hook Mapping

| Lecture File | Lines | Blog Equivalent | Lines | Action Required |
|--------------|-------|-----------------|-------|-----------------|
| `services/api/lecture.service.ts` | 67 | `features/blog/services/blog.service.ts` | 59 | **MODIFY** — Move to `src/services/api/blog.service.ts`, add missing methods |
| `hooks/admin/use-lectures.ts` | 28 | `features/blog/hooks/use-admin-blogs.ts` | 89 | **MODIFY** — Move to `src/hooks/admin/use-blog.ts`, simplify pattern |

### 3.3 API Route Mapping

| Lecture Endpoint | Lines | Blog Endpoint | Lines | Action Required |
|------------------|-------|---------------|-------|-----------------|
| `api/admin/lectures/route.ts` (GET,POST,PUT,DELETE) | 263 | `api/admin/blog/route.ts` (GET,POST) | 151 | **MODIFY** — Add PUT, DELETE to main route OR keep separate [id] route |
| — | — | `api/admin/blog/[id]/route.ts` (GET,PUT,DELETE) | 174 | **EXISTS** — Different pattern than Lecture (Lecture has all methods in one file) |
| `api/lectures/route.ts` (GET) | 163 | `api/blog/route.ts` (GET) | ~80 | **EXISTS** — Matches pattern |
| `api/lectures/[id]/route.ts` (GET) | 189 | `api/blog/[slug]/route.ts` (GET) | ~60 | **EXISTS** — Different param (ID vs slug) |
| — | — | `api/admin/blog/[id]/publish/route.ts` | 34 | **EXISTS** — Blog-only (Lecture uses workflow) |
| — | — | `api/admin/blog/[id]/archive/route.ts` | 34 | **EXISTS** — Blog-only |
| — | — | `api/admin/blog/[id]/restore/route.ts` | 29 | **EXISTS** — Blog-only |

### 3.4 Frontend Mapping

| Lecture Frontend | Lines | Blog Frontend | Lines | Action Required |
|------------------|-------|---------------|-------|-----------------|
| `app/lectures/page.tsx` | ~20 | `app/blog/page.tsx` | 69 | **EXISTS** — Server component |
| `app/lectures/loading.tsx` | ~10 | (missing) | — | **CREATE** — Add loading skeleton |
| `app/lecture/[id]/page.tsx` | ~30 | `app/blog/[slug]/page.tsx` | 178 | **EXISTS** — More complete than Lecture |
| `app/lecture/[id]/loading.tsx` | ~10 | (missing) | — | **CREATE** — Add loading skeleton |
| `components/lecture/LectureListPage.tsx` | ~400 | `app/blog/BlogHomeClient.tsx` | 246 | **EXISTS** — Different but functional |
| `components/lecture/LectureViewerPage.tsx` | 727 | `app/blog/[slug]/BlogDetailClient.tsx` | 359 | **EXISTS** — Blog has TOC, share, etc. |
| — | — | `app/blog/tag/[slug]/page.tsx` | 58 | **EXISTS** — Blog-only |
| — | — | `app/blog/category/[slug]/page.tsx` | 57 | **EXISTS** — Blog-only |
| — | — | `app/blog/author/[id]/page.tsx` | 53 | **EXISTS** — Blog-only |
| — | — | `features/blog/components/BlogCard.tsx` | 72 | **EXISTS** — Blog-only |
| — | — | `features/blog/components/BlogSidebar.tsx` | 34 | **EXISTS** — Blog-only |
| — | — | `app/blog/rss.xml/route.ts` | ~60 | **EXISTS** — Blog-only |

---

## PHASE 4: DATABASE ANALYSIS

### 4.1 Lecture Model vs Blog Model — Field Comparison

| Aspect | Lecture Model | BlogPost Model |
|--------|--------------|----------------|
| **Primary key** | `id` (cuid) | `id` (cuid) |
| **Title** | `title` (String) | `title` (String) |
| **Slug** | `slug` (String) | `slug` (String, @unique) |
| **Content** | `content` (String — HTML) | `content` (String — HTML) |
| **Taxonomy** | `chapterId` → Chapter → Subject → Class | `categoryId` → BlogCategory |
| **Tags** | None | `BlogPostTag` (many-to-many) |
| **Thumbnail** | `thumbnail` (String?) | `featuredImage` (String?) |
| **Media** | `videoUrl`, `audioUrl`, `pdfUrl` | `gallery` (JSON?) |
| **SEO** | None | `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`, `robots`, `jsonLd` |
| **Status** | `isActive` (Boolean) | `status` (String: DRAFT/PUBLISHED/ARCHIVED) |
| **Premium** | `isPremium`, `price` | None |
| **Ordering** | `order` (Int) | `publishedAt` (DateTime) |
| **Duration** | `duration` (Int, minutes) | `readingTime` (Int, auto-calculated) |
| **Featured** | Via featured-content-registry | `isFeatured`, `isPinned` |
| **Comments** | None | `allowComments` |
| **Author** | None (admin-only) | `authorId` → User |
| **Scheduling** | Via workflow | `scheduledAt` (DateTime) |
| **View count** | `viewCount` | `viewCount` |
| **Soft delete** | `deletedAt`, `deletedBy`, `deleteReason` | `deletedAt`, `deletedBy`, `deleteReason` |
| **Timestamps** | `createdAt`, `updatedAt` | `createdAt`, `updatedAt` |
| **Indexes** | 2 composite | 7 targeted |
| **Relations** | chapter, resources[] | author, category, series, tags[], relatedBy[], relatedTo[] |

### 4.2 Recommendation

**No schema changes needed.** The BlogPost model is already more complete than the Lecture model (SEO fields, tags, categories, series, scheduling, etc.). The database is production-ready.

---

## PHASE 5: API CLONE PLAN

### 5.1 Lecture API Pattern

```
Lecture API Structure:
├── api/admin/lectures/route.ts          ← ALL methods in one file
│   ├── GET  (list with search/filter/pagination)
│   ├── POST (create with Zod validation)
│   ├── PUT  (update with workflow integration)
│   └── DELETE (soft delete with dependency guard)
├── api/lectures/route.ts                ← Public listing (with access control)
└── api/lectures/[id]/route.ts           ← Public detail (with premium gating)
```

### 5.2 Blog API Current Structure

```
Blog API Structure:
├── api/admin/blog/route.ts              ← GET + POST only
├── api/admin/blog/[id]/route.ts         ← GET + PUT + DELETE
├── api/admin/blog/[id]/publish/route.ts ← POST (publish action)
├── api/admin/blog/[id]/archive/route.ts ← POST (archive action)
├── api/admin/blog/[id]/restore/route.ts ← POST (restore action)
├── api/admin/blog/categories/route.ts   ← GET + POST + PUT + DELETE
├── api/admin/blog/tags/route.ts         ← GET + POST + PUT + DELETE
├── api/blog/route.ts                    ← Public listing
├── api/blog/[slug]/route.ts             ← Public detail
├── api/blog/[slug]/related/route.ts     ← Related posts
├── api/blog/categories/route.ts         ← Public categories
└── api/blog/tags/route.ts               ← Public tags
```

### 5.3 API Alignment Decision

**Keep the Blog's split-route pattern** (`[id]/route.ts` for CRUD, separate routes for lifecycle actions). This is actually cleaner than Lecture's monolithic approach. The Blog already has more endpoints (publish, archive, restore, categories, tags) which justify the split.

**No API changes needed.** The Blog API is already more complete and better organized than the Lecture API.

---

## PHASE 6: ADMIN UI CLONE PLAN

### 6.1 Editor Refactoring — BlogEditor to Match Lecture Pattern

**Current BlogEditor (monolithic, 592 lines):**
- Owns 24 state variables
- Calls 4 hooks for data fetching
- Handles auto-save internally
- Handles slug validation internally
- Navigates on save internally

**Target Pattern (matching Lecture's EditorView):**
- Zero state variables (all via props)
- Zero hook calls (all data from parent)
- Zero navigation logic (all via callbacks from parent)
- Pure presentational component

**Refactoring Plan:**

The BlogEditor needs to be split into:

1. **`AdminBlogPage.tsx`** (state owner — like `AdminLecturesPage.tsx`)
   - All 24 state variables move here
   - All data fetching (useAdminBlog, useAdminBlogCategories, useAdminBlogTags) moves here
   - Auto-save logic moves here
   - Slug validation moves here
   - Create/update handlers move here
   - Navigation on save moves here

2. **`BlogEditorView.tsx`** (presentational — like `EditorView.tsx`)
   - Zero state
   - Props interface with ~30 fields
   - Renders tabs (Content / SEO / Settings) instead of wizard steps
   - All event handlers are prop callbacks

### 6.2 List View Enhancement — Add Grid View

**Current BlogAdminPage (table only):**
- Simple HTML table with columns
- No grid view option
- No bulk delete

**Target (matching Lecture's dual grid+table):**
- Grid view with card thumbnails
- Table view with columns
- Toggle between views
- Bulk selection and bulk delete
- Search bar
- Pagination

### 6.3 Delete Confirmation — Add Modal

**Current BlogAdminPage (inline confirm):**
```ts
if (confirm('Are you sure?')) { ... }
```

**Target (matching Lecture's DeleteConfirm.tsx):**
- Custom modal overlay with backdrop blur
- Bengali warning text
- Cancel/Delete buttons
- Consistent styling

---

## PHASE 7: FRONTEND CLONE PLAN

### 7.1 Add Missing Loading Skeletons

| File to Create | Based On | Purpose |
|----------------|----------|---------|
| `src/app/blog/loading.tsx` | `src/app/lectures/loading.tsx` | Loading state for blog pages |
| `src/app/blog/[slug]/loading.tsx` | `src/app/lecture/[lectureId]/loading.tsx` | Loading state for blog detail |

### 7.2 Blog Frontend Already Complete

The Blog frontend is already MORE complete than the Lecture frontend:

| Feature | Lecture | Blog |
|---------|---------|------|
| List page | ✓ | ✓ |
| Detail page | ✓ | ✓ |
| Loading skeletons | ✓ | ✗ (MISSING) |
| Tag filtering | ✗ | ✓ |
| Category filtering | ✗ | ✓ |
| Author page | ✗ | ✓ |
| RSS feed | ✗ | ✓ |
| TOC sidebar | ✗ | ✓ |
| Share buttons | ✗ | ✓ |
| Reading progress | ✗ | ✓ |
| Related posts | ✗ | ✓ |
| Search | ✗ | ✓ |
| JSON-LD | ✗ | ✓ |
| OG metadata | ✗ | ✓ |

---

## PHASE 8: REUSE ANALYSIS

### 8.1 Component Reuse Percentage

| Category | Reuse % | Details |
|----------|:---:|---------|
| UI primitives (Button, Input, Card, Badge, etc.) | 100% | All shared from `src/components/ui/` |
| RichTextBlockEditor | 100% | Both use same editor |
| ImageUploader | 100% | Both use same uploader |
| Switch, Dialog, Select, Tabs | 100% | All shared |
| DataTable (admin list) | 0% | Lecture uses it, Blog doesn't (needs creation) |
| DeleteConfirm (admin) | 0% | Lecture has it, Blog doesn't (needs creation) |
| StepIndicator | 0% | Lecture-only (Blog uses tabs) |
| ContentBlockEditor | 0% | Lecture-only (Blog uses RichTextBlockEditor) |
| RichContentRenderer | 100% | Both use for content rendering |
| TableOfContents | 100% | Blog-only component |
| BlogCard | 100% | Blog-only component |
| BlogSidebar | 100% | Blog-only component |
| **Overall UI reuse** | **~75%** | |

### 8.2 Infrastructure Reuse

| Utility | Reuse % | Notes |
|---------|:---:|-------|
| api-client.ts | 100% | Same API client |
| api-utils.ts | 100% | Same response builders, auth guards |
| errors.ts | 100% | Same error handler |
| audit.ts | 100% | Both use auditFromRequest |
| soft-delete.ts | 100% | Both registered |
| cache-invalidate.ts | 100% | Both registered |
| query-keys.ts | 100% | Both have query key definitions |
| slug.ts | 100% | Same slug generation |
| sanitize.ts | 100% | Same HTML sanitizer |
| **Overall infrastructure reuse** | **~95%** | |

### 8.3 Service Reuse

| Service Method | Lecture | Blog | Compatible |
|----------------|---------|------|:---:|
| `api.get()` | ✓ | ✓ | ✓ |
| `api.post()` | ✓ | ✓ | ✓ |
| `api.put()` | ✓ | ✓ | ✓ |
| `api.delete()` | ✓ | ✓ | ✓ |
| Response unwrapping | ✓ | ✓ | ✓ |
| CSRF handling | ✓ | ✓ | ✓ |
| Retry logic | ✓ | ✓ | ✓ |

---

## PHASE 9: SECURITY AUDIT

### 9.1 Security Checklist

| Security Feature | Lecture | Blog | Status |
|------------------|---------|------|:---:|
| Authentication | `withAdmin` | `withAdmin` | ✓ Match |
| Authorization | Role check | Role check | ✓ Match |
| CSRF | `withCsrf` on mutations | `withCsrf` on mutations | ✓ Match |
| Audit logging | `auditFromRequest` | `auditFromRequest` | ✓ Match |
| Soft delete | `softDelete()` | `softDelete()` | ✓ Match |
| HTML sanitization | `sanitizeForStorage` | `sanitizeForStorage` | ✓ Match |
| Slug uniqueness | Not checked | `generateUniqueSlug` | Blog BETTER |
| Image upload | UploadThing | UploadThing | ✓ Match |
| Rate limiting | `apiLimiter` on public | Not on public blog | ⚠ GAP |
| Content access | `batchCheckContentAccess` | N/A (free content) | N/A |
| Delete guard | `guardDeleteDependencies` | Post count guard on category | ✓ Different but adequate |
| Input validation | Zod schemas | Zod schemas | ✓ Match |

### 9.2 Security Gaps to Close

1. **Rate limiting on public blog routes** — Add `applyRateLimit(apiLimiter, request)` to `api/blog/route.ts` and `api/blog/[slug]/route.ts`

---

## PHASE 10: IMPLEMENTATION PLAN

### Phase 1: Refactor BlogEditor to Presentational Pattern (Priority: HIGH)

**Goal:** Make BlogEditor match Lecture's EditorView architecture.

**Files to Create:**
| File | Based On | Purpose |
|------|----------|---------|
| `src/components/admin/blog/BlogEditorView.tsx` | `lectures/EditorView.tsx` | Presentational editor (props-driven) |
| `src/components/admin/blog/BlogListView.tsx` | `lectures/ListView.tsx` | Grid+table list view |
| `src/components/admin/blog/BlogDeleteConfirm.tsx` | `lectures/DeleteConfirm.tsx` | Delete confirmation modal |
| `src/components/admin/blog/types.ts` | `lectures/types.ts` | Blog-specific types |

**Files to Modify:**
| File | Change |
|------|--------|
| `src/features/blog/admin/AdminBlogPage.tsx` | Convert to state owner pattern (like AdminLecturesPage) |
| `src/features/blog/admin/AdminBlogEditor.tsx` | DELETE (replaced by BlogEditorView) |

**Estimated effort:** 4-6 hours

### Phase 2: Add Grid View to Blog Admin (Priority: MEDIUM)

**Goal:** Match Lecture's dual grid+table list view.

**Files to Modify:**
| File | Change |
|------|--------|
| `src/components/admin/blog/BlogListView.tsx` | Add grid view with thumbnail cards |
| `src/components/admin/blog/BlogEditorView.tsx` | Add grid/list toggle button |

**Estimated effort:** 2-3 hours

### Phase 3: Add Bulk Delete (Priority: MEDIUM)

**Goal:** Match Lecture's bulk delete capability.

**Files to Modify:**
| File | Change |
|------|--------|
| `src/components/admin/blog/BlogListView.tsx` | Add selection, bulk actions |
| `src/features/blog/admin/AdminBlogPage.tsx` | Add handleBulkDelete handler |

**Estimated effort:** 1-2 hours

### Phase 4: Add Loading Skeletons (Priority: LOW)

**Goal:** Add missing loading states.

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/app/blog/loading.tsx` | Blog list loading skeleton |
| `src/app/blog/[slug]/loading.tsx` | Blog detail loading skeleton |

**Estimated effort:** 30 minutes

### Phase 5: Add Rate Limiting (Priority: LOW)

**Goal:** Security parity with Lecture.

**Files to Modify:**
| File | Change |
|------|--------|
| `src/app/api/blog/route.ts` | Add `applyRateLimit(apiLimiter, request)` |
| `src/app/api/blog/[slug]/route.ts` | Add `applyRateLimit(apiLimiter, request)` |

**Estimated effort:** 15 minutes

### Phase 6: Align Service Location (Priority: LOW)

**Goal:** Match Lecture's centralized service pattern.

**Files to Move:**
| From | To |
|------|-----|
| `src/features/blog/services/blog.service.ts` | `src/services/api/blog.service.ts` |
| `src/features/blog/hooks/use-admin-blogs.ts` | `src/hooks/admin/use-blog.ts` |
| `src/features/blog/hooks/use-blogs.ts` | `src/hooks/use-blog.ts` |
| `src/features/blog/types/blog.ts` | `src/types/blog.ts` |

**Files to Modify:**
| File | Change |
|------|--------|
| All imports referencing old paths | Update to new paths |

**Estimated effort:** 30 minutes (find-and-replace)

---

## PHASE 11: FINAL MATRICES

### 11.1 Lecture → Blog Clone Matrix

| Lecture Component | Blog Equivalent | Status |
|-------------------|-----------------|--------|
| `AdminLecturesPage` (state owner) | `AdminBlogPage` | Needs refactoring to state owner |
| `EditorView` (presentational) | `AdminBlogEditor` | Needs refactoring to presentational |
| `ListView` (grid+table) | (inline in AdminBlogPage) | Needs extraction to separate component |
| `DeleteConfirm` (modal) | (inline confirm) | Needs creation |
| `StepIndicator` | N/A | Blog uses tabs (different UX) |
| `types.ts` | `types/blog.ts` | Exists, needs minor alignment |
| `lecture.service.ts` | `blog.service.ts` | Exists, needs relocation |
| `use-lectures.ts` | `use-admin-blogs.ts` | Exists, needs relocation |

### 11.2 File Rename Matrix

| Current Location | Target Location |
|------------------|-----------------|
| `src/features/blog/services/blog.service.ts` | `src/services/api/blog.service.ts` |
| `src/features/blog/hooks/use-admin-blogs.ts` | `src/hooks/admin/use-blog.ts` |
| `src/features/blog/hooks/use-blogs.ts` | `src/hooks/use-blog.ts` |
| `src/features/blog/types/blog.ts` | `src/types/blog.ts` |

### 11.3 Component Reuse Matrix

| Component | Lecture Usage | Blog Usage | Reusable? |
|-----------|:---:|:---:|:---:|
| `RichTextBlockEditor` | ✓ | ✓ | 100% |
| `ImageUploader` | ✓ | ✓ | 100% |
| `DataTable` | ✓ | — | 0% (Blog needs own) |
| `DeleteConfirm` | ✓ | — | 0% (Blog needs own) |
| `Card`, `Badge`, `Button` | ✓ | ✓ | 100% |
| `Select`, `Switch`, `Input` | ✓ | ✓ | 100% |
| `Dialog`, `Tabs`, `Separator` | ✓ | ✓ | 100% |
| `RichContentRenderer` | — | ✓ | Blog-only |
| `TableOfContents` | — | ✓ | Blog-only |
| `BlogCard` | — | ✓ | Blog-only |
| `BlogSidebar` | — | ✓ | Blog-only |
| `MultiSelect` | — | ✓ | Blog-only |
| `SlugField` | — | ✓ | Blog-only |

### 11.4 Database Mapping

| Lecture Field | Blog Field | Notes |
|---------------|------------|-------|
| `id` | `id` | Same |
| `title` | `title` | Same |
| `slug` | `slug` | Blog has @unique |
| `content` | `content` | Same (HTML) |
| `chapterId` | `categoryId` | Different taxonomy |
| `thumbnail` | `featuredImage` | Same concept, different name |
| `videoUrl` | — | Lecture-only |
| `audioUrl` | — | Lecture-only |
| `pdfUrl` | — | Lecture-only |
| `duration` | `readingTime` | Lecture: manual, Blog: auto |
| `order` | `publishedAt` | Different ordering strategy |
| `isPremium` | — | Lecture-only |
| `price` | — | Lecture-only |
| `isActive` | `status` | Blog has 3 states |
| `viewCount` | `viewCount` | Same |
| — | `excerpt` | Blog-only |
| — | `gallery` | Blog-only |
| — | `authorId` | Blog-only |
| — | `metaTitle` | Blog-only |
| — | `metaDescription` | Blog-only |
| — | `canonicalUrl` | Blog-only |
| — | `ogImage` | Blog-only |
| — | `isFeatured` | Blog-only |
| — | `isPinned` | Blog-only |
| — | `allowComments` | Blog-only |
| — | `scheduledAt` | Blog-only |
| — | `tags` (relation) | Blog-only |
| — | `relatedBy/relatedTo` | Blog-only |
| — | `series` | Blog-only |

### 11.5 API Mapping

| Lecture Endpoint | Blog Endpoint | Method Match |
|------------------|---------------|:---:|
| `GET /api/admin/lectures` | `GET /api/admin/blog` | ✓ |
| `POST /api/admin/lectures` | `POST /api/admin/blog` | ✓ |
| `PUT /api/admin/lectures` | `PUT /api/admin/blog/:id` | ✓ (different route) |
| `DELETE /api/admin/lectures` | `DELETE /api/admin/blog/:id` | ✓ (different route) |
| `GET /api/lectures` | `GET /api/blog` | ✓ |
| `GET /api/lectures/:id` | `GET /api/blog/:slug` | ✓ (different param) |
| — | `POST /api/admin/blog/:id/publish` | Blog-only |
| — | `POST /api/admin/blog/:id/archive` | Blog-only |
| — | `POST /api/admin/blog/:id/restore` | Blog-only |
| — | `GET /api/blog/:slug/related` | Blog-only |
| — | `GET /api/blog/categories` | Blog-only |
| — | `GET /api/blog/tags` | Blog-only |

### 11.6 Admin UI Mapping

| Lecture Admin | Blog Admin | Action |
|---------------|------------|--------|
| `AdminLecturesPage` (state owner) | `AdminBlogPage` | Refactor to state owner |
| `ListView` (grid+table) | Table only | Add grid view |
| `EditorView` (wizard, 34 props) | `AdminBlogEditor` (monolithic) | Refactor to presentational |
| `DeleteConfirm` (modal) | Inline confirm | Create modal |
| `StepIndicator` | N/A (tabs) | Keep tabs |
| `types.ts` | `types/blog.ts` | Align types |

### 11.7 Frontend Mapping

| Lecture Frontend | Blog Frontend | Status |
|------------------|---------------|--------|
| `/lectures` (list) | `/blog` (home) | ✓ Exists |
| `/lecture/:id` (detail) | `/blog/:slug` (detail) | ✓ Exists |
| Loading skeletons | — | ✗ Missing |
| — | `/blog/tag/:slug` | ✓ Blog-only |
| — | `/blog/category/:slug` | ✓ Blog-only |
| — | `/blog/author/:id` | ✓ Blog-only |
| — | `/blog/rss.xml` | ✓ Blog-only |

### 11.8 Security Checklist

| Check | Status |
|-------|:---:|
| Authentication on admin routes | ✓ |
| Authorization (admin role) | ✓ |
| CSRF on mutations | ✓ |
| Audit logging | ✓ |
| Soft delete | ✓ |
| HTML sanitization | ✓ |
| Input validation (Zod) | ✓ |
| Rate limiting on public routes | ⚠ Missing on blog |
| Image upload validation | ✓ |
| Slug uniqueness | ✓ |

### 11.9 SEO Checklist

| Check | Status |
|-------|:---:|
| Dynamic metadata | ✓ |
| OpenGraph tags | ✓ |
| Twitter card | ✓ |
| Canonical URL | ✓ |
| JSON-LD structured data | ✓ |
| Sitemap entries | ✓ |
| RSS feed | ✓ |
| robots meta | ✓ |
| Reading time | ✓ |
| Breadcrumbs | ✓ |

### 11.10 Performance Checklist

| Check | Status |
|-------|:---:|
| HTTP cache headers | ✓ (noCache) |
| React Query caching | ✓ |
| Image optimization (next/image) | ✓ |
| Pagination | ✓ |
| Debounced search | ✓ |
| Lazy loading (dynamic import) | ✓ |
| DB indexes | ✓ (7 indexes) |
| N+1 prevention | ✓ (include queries) |
| Bundle size (dynamic imports) | ✓ |

### 11.11 Testing Checklist

| Test | Priority | Notes |
|------|:---:|-------|
| Admin CRUD operations | HIGH | Create, read, update, delete blog posts |
| Category CRUD | HIGH | Create, read, update, delete categories |
| Tag CRUD | HIGH | Create, read, update, delete tags |
| Publish/Archive/Restore | HIGH | Lifecycle actions |
| Public listing | MEDIUM | Pagination, search, filtering |
| Public detail | MEDIUM | View count, related posts |
| SEO metadata | MEDIUM | OG tags, JSON-LD, canonical |
| Soft delete cascade | MEDIUM | Category deletion with posts |
| Rate limiting | LOW | Public route protection |
| Loading states | LOW | Skeleton rendering |

### 11.12 Final Production Readiness Score

| Dimension | Score (1-10) | Notes |
|-----------|:---:|-------|
| Schema completeness | 9 | BlogPost has more fields than Lecture |
| API completeness | 9 | Blog has more endpoints (publish, archive, restore, categories, tags) |
| Admin UI completeness | 6 | Needs grid view, bulk delete, delete modal, editor refactoring |
| Frontend completeness | 9 | Blog has TOC, share, related posts, search, RSS |
| SEO completeness | 10 | Full SEO suite (OG, JSON-LD, canonical, sitemap, RSS) |
| Security completeness | 9 | Missing rate limiting on public routes |
| Infrastructure completeness | 9 | All utilities registered and working |
| Code quality | 6 | Editor architecture inconsistent (monolithic vs presentational) |
| **Overall** | **7.8/10** | Blog is production-ready with minor alignment needed |

---

## RECOMMENDATION

The Blog module is already **production-ready**. The architectural alignment (refactoring Editor to presentational pattern, adding grid view, adding bulk delete) is a **quality improvement**, not a blocking requirement.

**Minimum viable alignment (2-3 hours):**
1. Add rate limiting to public blog routes
2. Add loading skeletons

**Full alignment (8-12 hours):**
1. Refactor AdminBlogEditor to presentational pattern
2. Add BlogListView with grid+table
3. Add BlogDeleteConfirm modal
4. Add bulk delete
5. Add loading skeletons
6. Add rate limiting
7. Relocate service/hooks to centralized directories

**The Blog module should NOT be rebuilt.** It should be incrementally aligned with Lecture patterns.
