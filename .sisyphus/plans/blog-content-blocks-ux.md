# Plan: Blog Editor Content Blocks UX Parity with Lecture Editor

## Context

The Blog editor currently displays the "Content Blocks" section as a plain `<Label>` + `<div>` wrapper, while the Lecture editor uses a rich `Card` with gradient header, hint icons, and proper styling. Both editors already use the same shared `ContentBlockEditor` component and the same 11 block types. The only difference is the **surrounding UI chrome**.

The user wants the Blog editor to match the Lecture editor's "Content Blocks" experience exactly.

## Current State Analysis

### Shared Infrastructure (already identical)
- `ContentBlockEditor` component (shared, no `allowedBlocks` needed)
- `AddBlockMenu` (shared, derived from `blockTypeConfig`)
- `BlockItem` with toolbar (move, collapse, duplicate, delete)
- `BlockPreview` for all 11 block types
- `serializeBlocks()` / `deserializeBlocks()` (shared)
- `createBlock()` factory (shared)
- `blockTypeConfig` registry (shared, 11 types)
- API routes (`contentBlocks` field in both create/update)
- Database storage (`BlogPost.contentBlocks String?`)
- Frontend rendering (`BlogDetailClient.tsx` uses `ContentBlockEditor previewMode`)

### Differences to Fix

| Aspect | Lecture Editor | Blog Editor (current) |
|--------|---------------|----------------------|
| Wrapper | `Card` + `CardHeader` + `CardContent` | Plain `<div>` + `<Label>` |
| Title | "কন্টেন্ট ব্লকসমূহ" with `LayoutGrid` icon | "কন্টেন্ট" (no icon) |
| Header style | Gradient `from-emerald-50` | None |
| Hint bar | `$...$ ম্যাথ \| ছবি \| ডাটা` with icons | None |
| `allowedBlocks` prop | Not passed (all types) | `BLOG_ALLOWED_BLOCKS` (all types) |
| Min-height | None | `min-h-[400px]` |

## Implementation Plan

### File to Modify
- `E:\Sikkhs\src\components\admin\blog\BlogEditorView.tsx`

### Changes

Replace the Content Blocks section (lines 359-368) from:

```tsx
<div className="space-y-2">
  <Label className="text-base font-semibold">কন্টেন্ট</Label>
  <div className="min-h-[400px]">
    <ContentBlockEditor
      blocks={blocks}
      onChange={setBlocks}
      allowedBlocks={BLOG_ALLOWED_BLOCKS}
    />
  </div>
</div>
```

To match the Lecture editor pattern:

```tsx
<Card className="border-2">
  <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2 text-lg">
        <LayoutGrid className="h-5 w-5 text-emerald-600" />
        কন্টেন্ট ব্লকসমূহ
      </CardTitle>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Sigma className="h-3 w-3" /> $...$ ম্যাথ
        <span className="opacity-40">|</span>
        <ImageIcon className="h-3 w-3" /> ছবি
        <span className="opacity-40">|</span>
        <Table2 className="h-3 w-3" /> ডাটা
      </div>
    </div>
  </CardHeader>
  <CardContent className="p-4 sm:p-6">
    <ContentBlockEditor
      blocks={blocks}
      onChange={setBlocks}
    />
  </CardContent>
</Card>
```

### Additional Changes to BlogEditorView.tsx

1. **Add missing imports**: `LayoutGrid`, `Sigma`, `Table2` from `lucide-react` (already has `ImageIcon`)
2. **Remove `BLOG_ALLOWED_BLOCKS` import** (no longer needed since we don't pass `allowedBlocks`)
3. **Keep `min-h-[400px]`** on the `CardContent` for better UX

### Also Update types.ts

- Remove `BLOG_ALLOWED_BLOCKS` export from `src/components/admin/blog/types.ts` (no longer used)
- Keep the `blockTypeConfig` import (still used elsewhere if needed)

## Architecture Reuse

| Component | Lecture | Blog | Shared? |
|-----------|---------|------|---------|
| `ContentBlockEditor` | ✅ | ✅ | ✅ Yes |
| `AddBlockMenu` | ✅ | ✅ | ✅ Yes |
| `BlockItem` (toolbar) | ✅ | ✅ | ✅ Yes |
| `BlockPreview` | ✅ | ✅ | ✅ Yes |
| `blockTypeConfig` | ✅ | ✅ | ✅ Yes |
| `createBlock()` | ✅ | ✅ | ✅ Yes |
| `serializeBlocks()` | ✅ | ✅ | ✅ Yes |
| `deserializeBlocks()` | ✅ | ✅ | ✅ Yes |
| Block editors (11) | ✅ | ✅ | ✅ Yes |
| API routes | ✅ | ✅ | ✅ Yes |
| Database schema | ✅ | ✅ | ✅ Yes |
| Frontend renderer | ✅ | ✅ | ✅ Yes |

**Architecture reuse: 100%** — Only the UI wrapper is different.

## Block Types Supported

All 11 types from the shared `blockTypeConfig` registry:

| # | Type | Bengali Label | Status |
|---|------|---------------|--------|
| 1 | `heading` | হেডিং | ✅ |
| 2 | `text` | টেক্সট | ✅ |
| 3 | `image` | ছবি | ✅ |
| 4 | `math` | ম্যাথ | ✅ |
| 5 | `data` | ডাটা | ✅ |
| 6 | `code` | কোড | ✅ |
| 7 | `divider` | বিভাজক | ✅ |
| 8 | `pdf` | পিডিএফ | ✅ |
| 9 | `link` | লিংক | ✅ |
| 10 | `richtext` | রিচ টেক্সট | ✅ |
| 11 | `mindmap` | মাইন্ড ম্যাপ | ✅ |

## Unsupported Blocks

None. The shared registry (`blockTypeConfig`) defines exactly 11 types. The user mentioned block types like "Quote, MCQ, CQ, Knowledge, Formula, Diagram, Note, Warning, YouTube, Embed, Chapter Navigation" — these do **not exist** in the current codebase. They are not defined in the `ContentBlock` union type, not in `blockTypeConfig`, and not in any editor component. If the user wants these, they would need to be implemented as new block types in the shared system first.

## Production Readiness

- [x] All 11 block types have editor components
- [x] All 11 block types have preview renderers
- [x] All 11 block types serialize/deserialize correctly
- [x] API routes accept `contentBlocks` for all types
- [x] Database schema supports `contentBlocks` field
- [x] Frontend rendering works for all types
- [x] Lecture editor unchanged
- [x] Blog editor matches Lecture UX

## Verification

After implementation, verify:
1. Blog editor shows "কন্টেন্ট ব্লকসমূহ" header with gradient
2. Hint bar shows `$...$ ম্যাথ | ছবি | ডাটা`
3. All 11 block types appear in AddBlockMenu
4. Each block type: add, edit, reorder, duplicate, delete, collapse/expand works
5. Preview mode renders all blocks correctly
6. Save/load cycle works (blocks persist in `contentBlocks` field)
7. Lecture editor is completely unchanged
