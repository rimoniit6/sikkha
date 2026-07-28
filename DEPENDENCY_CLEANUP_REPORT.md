# Dependency Cleanup Report

**Date:** July 28, 2026  
**Tool:** depcheck + manual source verification

---

## Summary

| Category | Count | Total Savings (approx) |
|----------|-------|----------------------|
| Unused dependencies — safe to remove | 7 | ~2-3 MB |
| Likely unused (needs config check) | 2 | ~1-2 MB |
| False positives (still used) | 4 | N/A |
| Missing dependencies (needed by skills) | 11 | N/A |

---

## ✅ Confirmed Unused — Safe to Remove

### 1. `@supabase/ssr` (~50 KB)
**Evidence:** Zero imports or references in any `src/` file. The application uses its own JWT-based auth system (`jose`, `bcryptjs`).

### 2. `@supabase/supabase-js` (~200 KB)
**Evidence:** Zero imports or references in any `src/` file. Same as above — no Supabase client is instantiated anywhere.

### 3. `@upstash/ratelimit` (~20 KB)
**Evidence:** Zero imports in any source file. The rate limiting in `src/lib/rate-limit.ts` uses its own in-memory `Map<string, SlidingWindowEntry>` implementation, not Upstash.

### 4. `@upstash/redis` (~50 KB)
**Evidence:** Zero imports. Paired with `@upstash/ratelimit` — neither is used.

### 5. `@tiptap/extension-character-count` (~30 KB)
**Evidence:** Zero imports in any `src/` file. The TipTap editor uses `@tiptap/starter-kit` which bundles core extensions. This individual extension is unused.

### 6. `@next/bundle-analyzer` (~50 KB)
**Evidence:** Not imported in `next.config.ts`. The `package.json` script `"analyze": "next build --experimental-analyze"` uses Next.js's built-in analyzer flag, not the package.

### 7. `@testing-library/jest-dom` (~100 KB)
**Evidence:** Not imported in `vitest.config.ts`, `vitest.setup.ts`, or any test file in `src/**/*.test.ts`. The test setup only mocks `server-only`.

---

## 🔍 Likely Unused (Verify Config)

### 8. `lightningcss` (~500 KB)
**Status:** Used by Tailwind CSS v4 PostCSS plugin. Check `@tailwindcss/postcss` dependency — if LightningCSS is bundled with it, this separate package may be redundant.

### 9. `tw-animate-css` (~50 KB)
**Status:** Tailwind animation library. Check if `components.json` or `tailwind.config.ts` references it. If animations work without it, can be removed.

---

## ❌ False Positives (Keep These)

### 10. `pg` (Node.js PostgreSQL driver)
**Why keep:** Imported via `@prisma/adapter-pg` in both:
- `src/lib/db.ts` — `import { PrismaPg } from '@prisma/adapter-pg'`
- `prisma/seed-db.ts` — same import

### 11. `@tailwindcss/postcss`
**Why keep:** Used in `postcss.config.mjs`:
```js
plugins: ["@tailwindcss/postcss"],
```

### 12. `@testing-library/react`
**Why keep:** Used in test file:
- `src/components/chapter-hub/__tests__/ChapterTabs.test.tsx` — `import { render, screen } from '@testing-library/react'`

---

## 🚫 Missing Dependencies (Not in package.json but referenced)

These are dependencies that depcheck found being imported/required but NOT listed in `package.json`. **However, these are all in non-project skill directories** (`.claude/skills/`, `skills/`) — they are AI skill scripts, NOT application code. They should NOT be added to package.json.

| Missing Package | Referenced By | Action |
|----------------|---------------|--------|
| `dotenv` | `prisma.config.ts`, `prisma/seed-db.ts` | ⚠️ Should be added or removed from import |
| `z-ai-web-dev-sdk` | `skills/` scripts | ❌ Skill code — skip |
| `pptxgenjs` | `skills/pptx/` | ❌ Skill code — skip |
| `playwright` | `skills/pptx/` | ❌ Skill code — skip |
| `sharp` | `skills/pptx/` | ❌ Skill code — skip |
| `playwright-core` | `skills/pdf/` | ❌ Skill code — skip |
| `pdf-lib` | `skills/pdf/` | ❌ Skill code — skip |
| `pagedjs` | `skills/pdf/` | ❌ Skill code — skip |
| `@babel/parser` | `.claude/skills/impeccable/` | ❌ AI skill — skip |
| `htmlparser2` | `.claude/skills/impeccable/` | ❌ AI skill — skip |
| `css-select` | `.claude/skills/impeccable/` | ❌ AI skill — skip |
| `css-tree` | `.claude/skills/impeccable/` | ❌ AI skill — skip |
| `domutils` | `.claude/skills/impeccable/` | ❌ AI skill — skip |
| `puppeteer` | `.claude/skills/impeccable/` | ❌ AI skill — skip |

**Note:** `dotenv` in `prisma.config.ts` and `prisma/seed-db.ts` may need attention. Check if these files actually need `dotenv` or if env vars are already loaded by Prisma.

---

## Removal Plan

### Phase 1: Safe to delete NOW (no impact)

```bash
npm uninstall \
  @supabase/ssr \
  @supabase/supabase-js \
  @upstash/ratelimit \
  @upstash/redis \
  @tiptap/extension-character-count \
  @next/bundle-analyzer \
  @testing-library/jest-dom
```

**Bundle impact:** Reduces `node_modules` size by ~500 KB, but these are already tree-shaken out of the production bundle since nothing imports them.

### Phase 2: Verify before deleting

```bash
# Check if lightningcss is needed by Tailwind
# Check tailwind.config.ts and postcss.config.mjs

# Check if tw-animate-css is needed
# Search for "tw-animate-css" or "animate" in config files
```

### Phase 3: Add missing dependency

```bash
# dotenv is needed by Prisma config files
npm install dotenv
```

---

## Cleanup Script

One-liner to remove all confirmed-unused packages:

```bash
npm uninstall @supabase/ssr @supabase/supabase-js @upstash/ratelimit @upstash/redis @tiptap/extension-character-count @next/bundle-analyzer @testing-library/jest-dom
```

Run `npm ls` after to verify nothing is broken.

---

## Dependency List with Verification

| Package | Type | depcheck Says | Verified Usage | Recommended Action |
|---------|------|---------------|----------------|-------------------|
| `@supabase/ssr` | dep | UNUSED | Confirmed unused | **REMOVE** |
| `@supabase/supabase-js` | dep | UNUSED | Confirmed unused | **REMOVE** |
| `@upstash/ratelimit` | dep | UNUSED | Confirmed unused (in-memory impl used) | **REMOVE** |
| `@upstash/redis` | dep | UNUSED | Confirmed unused | **REMOVE** |
| `@tiptap/extension-character-count` | dep | UNUSED | Confirmed unused (StarterKit used instead) | **REMOVE** |
| `@next/bundle-analyzer` | devDep | UNUSED | Confirmed unused (CLI flag used instead) | **REMOVE** |
| `@testing-library/jest-dom` | devDep | UNUSED | Confirmed unused (not imported anywhere) | **REMOVE** |
| `pg` | dep | UNUSED | Used via @prisma/adapter-pg | **KEEP** |
| `@tailwindcss/postcss` | devDep | UNUSED | Used in postcss.config.mjs | **KEEP** |
| `@testing-library/react` | devDep | UNUSED | Used in ChapterTabs test | **KEEP** |
| `lightningcss` | devDep | UNUSED | May be bundled with Tailwind | **VERIFY** |
| `tw-animate-css` | devDep | UNUSED | Animation helper | **VERIFY** |

*Report generated by Buffy (Freebuff AI)*
