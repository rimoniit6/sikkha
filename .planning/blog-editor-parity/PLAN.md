# Plan: Blog Editor Parity with Lecture Editor

## Goal

Make the Blog admin editor visually and functionally identical to the Lecture admin editor, using Lecture as a **read-only reference implementation**. No Lecture files will be modified.

## Constraint: Lecture is Read-Only

All files in `src/components/admin/lectures/` and `src/app/api/admin/lectures/` are **production-stable and must not be modified**.

## Current State

| Component | Lecture | Blog | Status |
|-----------|---------|------|--------|
| `StepIndicator` | `lectures/StepIndicator.tsx` | `blog/StepIndicator.tsx` | **100% duplicate** |
| Step definitions | `lectures/types.ts` (`steps`) | `blog/types.ts` (`blogSteps`) | **Identical arrays** |
| Editor layout | `lectures/EditorView.tsx` | `blog/BlogEditorView.tsx` | **Same pattern, different content** |
| `ContentBlockEditor` | `ui/content-block-editor.tsx` | Same | ✅ Shared |
| Empty state / Add block | Inside ContentBlockEditor | Same | ✅ Shared |
| Drag & drop | Inside ContentBlockEditor | Same | ✅ Shared |

No `src/components/admin/shared/` directory exists.

## Plan

### Step 1: Create `src/components/admin/shared/StepIndicator.tsx`

A **single, generic** StepIndicator that both Lecture and Blog can use. Parameterized by a `steps` array prop instead of importing from a specific module's types.

```tsx
// Props:
interface SharedStepIndicatorProps {
  currentStep: number
  steps: Array<{ num: number; label: string; icon: React.ElementType }>
}
```

This is a character-for-character copy of the existing StepIndicator pattern, but with the steps array passed as a prop instead of imported.

### Step 2: Create `src/components/admin/shared/EditorShell.tsx`

A **layout wrapper** that provides the exact outer structure from Lecture's `EditorView` (lines 128-501). This is the shared shell that provides:

- Header (back button, title "ধাপ X/৩", badge, cancel button)
- StepIndicator in a Card
- Step content area (`children` per step)
- Navigation footer (Previous / dots / Next)

```tsx
interface EditorShellProps {
  // Header
  title: string
  editId?: string | null
  currentStep: number
  steps: Array<{ num: number; label: string; icon: React.ElementType }>
  
  // Actions
  onBack: () => void
  onCancel: () => void
  goNext: () => void
  goPrev: () => void
  canGoNext: () => boolean
  saving?: boolean
  
  // Content (rendered conditionally by parent)
  children: React.ReactNode
}
```

The shell renders:
1. Header with back/title/step-counter/badge/cancel — **exact same CSS classes as Lecture**
2. StepIndicator Card — **exact same CSS classes as Lecture**
3. `{children}` — the parent conditionally renders step content
4. Navigation footer — **exact same CSS classes as Lecture**

### Step 3: Rewrite `src/components/admin/blog/BlogEditorView.tsx`

Replace the current 558-line BlogEditorView with a version that:

1. **Imports `EditorShell`** from `@/components/admin/shared/EditorShell`
2. **Uses `blogSteps`** from `./types` (already defined)
3. **Renders `EditorShell`** with blog-specific props
4. **Conditionally renders step content** inside `<EditorShell>`:

**Step 1 content** — matches Lecture's Step 1 Card structure exactly:
- Same `Card className="border-2"` wrapper
- Same `CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30"`
- Same `CardTitle` with `BookOpen` icon
- Same `CardContent className="p-4 sm:p-6 space-y-5"`
- Blog-specific fields: Title, SlugField, Category, Status
- Same input styling: `className="h-11 text-base"`

**Step 2 content** — matches Lecture's Step 2 Cards exactly:
- Card A: Content blocks with `LayoutGrid` icon + hint bar (`$...$ ম্যাথ | ছবি | ডাটা`)
  - Same `CardContent className="p-4 sm:p-6"` (no `min-h` — Lecture doesn't have it)
  - `<ContentBlockEditor blocks={blocks} onChange={setBlocks} />` — **no `allowedBlocks` prop** (all 11 types)
- Card B: Media with `FileText` icon (blog-specific: Featured Image, OG Image, Tags, Excerpt)
  - Same Card structure as Lecture's "মিডিয়া ও সেটিংস"

**Step 3 content** — matches Lecture's Step 3 Cards structure:
- Preview Card: Same `Card className="border-2 overflow-hidden"` + same gradient header
  - ContentBlockEditor in `previewMode`
  - Empty blocks placeholder: same dashed border
- Publish Card: Same `Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20"`
  - Same Sparkles icon + publish button gradient
  - Blog has both "খসড়া সেভ" + "প্রকাশ" buttons (blog-specific)
- SEO Card + Post Settings Card: Blog-specific, same gradient header pattern

### Step 4: Delete `src/components/admin/blog/StepIndicator.tsx`

Replaced by `src/components/admin/shared/StepIndicator.tsx`.

### Step 5: Update `src/components/admin/blog/types.ts`

- Remove `BlogStepNumber` type (use generic `number`)
- Remove `blogSteps` array (keep it — it's blog-specific step config, just reuse the shared StepIndicator with it)
- Keep all blog-specific types: `BlogPostRecord`, `BlogPostStatus`, `BlogPostInput`, `BlogCategoryRecord`, `BlogTagRecord`, `statusLabels`, `statusColors`

Actually, keep `blogSteps` and `BlogStepNumber` — they're blog-specific step config, not duplicated Lecture code. The shared StepIndicator accepts any steps array.

## Files Summary

| File | Action | Reason |
|------|--------|--------|
| `src/components/admin/shared/StepIndicator.tsx` | **Create** | Generic step indicator (replaces duplicated blog version) |
| `src/components/admin/shared/EditorShell.tsx` | **Create** | Shared layout shell matching Lecture's exact structure |
| `src/components/admin/blog/BlogEditorView.tsx` | **Rewrite** | Use EditorShell, match Lecture's exact CSS structure |
| `src/components/admin/blog/StepIndicator.tsx` | **Delete** | Replaced by shared StepIndicator |
| `src/components/admin/blog/types.ts` | **Keep** | Blog-specific types stay |
| `src/features/blog/admin/AdminBlogEditor.tsx` | **Minor update** | Remove `handleBlocksChange` wrapper, pass `setBlocks` directly |
| ALL files in `src/components/admin/lectures/` | **UNCHANGED** | Lecture is read-only |
| ALL files in `src/features/lectures/` | **UNCHANGED** | Lecture is read-only |

## Lecture Files Confirmed UNCHANGED

- `src/components/admin/lectures/EditorView.tsx` — NOT modified
- `src/components/admin/lectures/StepIndicator.tsx` — NOT modified
- `src/components/admin/lectures/types.ts` — NOT modified
- `src/components/admin/lectures/ListView.tsx` — NOT modified
- `src/components/admin/lectures/DeleteConfirm.tsx` — NOT modified
- `src/components/admin/AdminLecturesPage.tsx` — NOT modified
- `src/app/admin/lectures/page.tsx` — NOT modified
- `src/app/api/admin/lectures/route.ts` — NOT modified

## Duplicated Code (Unavoidable)

| What | Lecture | Blog | Duplication |
|------|---------|------|-------------|
| Step definitions | `steps` array in `lectures/types.ts` | `blogSteps` array in `blog/types.ts` | **Intentional** — same labels, different module ownership |
| Gradient header pattern | `bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30` | Same | **By design** — identical visual language |
| Card structure | `Card className="border-2"` + `CardHeader` gradient | Same | **By design** — matching layout |

The `EditorShell` component eliminates the **layout duplication** (header, step indicator, navigation footer). The **visual patterns** (gradients, card structure) are intentionally identical per requirement.

## Risks

| Risk | Mitigation |
|------|------------|
| Shared StepIndicator breaks Lecture import path | Lecture still uses `lectures/StepIndicator` — no import change |
| EditorShell CSS drift from Lecture over time | Pin exact same CSS classes; document in code comment referencing Lecture's line numbers |
| Blog's ContentBlockEditor dynamic import vs Lecture's static import | Keep Blog's dynamic import — it's a valid optimization for blog-specific bundle splitting |

## Production Readiness Checklist

- [ ] All 11 block types render in Blog (heading, text, image, math, data, code, divider, pdf, link, richtext, mindmap)
- [ ] Empty state shows "কোনো কন্টেন্ট ব্লক নেই" + "নিচের বাটন থেকে ব্লক যোগ করুন"
- [ ] "+ ব্লক যোগ করুন" button opens AddBlockMenu with all 11 types
- [ ] Drag & drop reordering works
- [ ] Block collapse/expand works
- [ ] Block duplicate/delete works
- [ ] Block preview works
- [ ] Step indicator progress bar animates correctly
- [ ] Navigation Previous/Next works with validation
- [ ] Save creates contentBlocks + derived content field
- [ ] Edit loads blocks from contentBlocks with content fallback
- [ ] Draft autosave/recovers blocks
- [ ] Responsive preview modes work (desktop/tablet/mobile)
- [ ] ESLint passes clean
- [ ] No Lecture files modified (git diff confirms)
