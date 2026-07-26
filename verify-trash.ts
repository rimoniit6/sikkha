/**
 * Trash System — Complete Functional Verification Suite
 *
 * Tests:
 * 1. Soft Delete (all models) + Cache invalidation
 * 2. Restore + Cache invalidation
 * 3. Force Delete
 * 4. Cascade (blogCategory→blogPost, Class→Subject→Chapter)
 * 5. Bulk Operations
 * 6. Audit Logging
 * 7. Trash Listing
 * 8. Edge Cases (double delete, restore active, force active, cascade block)
 * 9. Rate Limiting
 *
 * Usage: npx tsx verify-trash.ts
 */

import { PrismaClient } from '@prisma/client'
import { softDelete, restore, forceDelete, SOFT_DELETE_MODELS, PRISMA_MODEL_MAP } from './src/lib/soft-delete'
import { getContentVersion } from './src/lib/cache-invalidate'
import type { CacheableContent } from './src/lib/cache-invalidate'

// Load .env file
try { process.loadEnvFile('.env') } catch { /* .env not found */ }

// Apply the same includeDeleted middleware as the project's db.ts
function injectSoftDeleteFilter(args: Record<string, unknown>): void {
  if (args.includeDeleted) {
    delete args.includeDeleted
    return
  }
  if (args.where && typeof args.where === 'object') {
    const w = args.where as Record<string, unknown>
    if (w.deletedAt === undefined) {
      w.deletedAt = null
    }
  }
}

const basePrisma = new PrismaClient()

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args: queryArgs, query }) {
        const modelName = model?.toLowerCase() || ''
        const args = queryArgs as Record<string, unknown>
        if (SOFT_DELETE_MODELS.has(modelName)) {
          if ('where' in args || 'include' in args || 'select' in args) {
            injectSoftDeleteFilter(args)
          }
        }
        return query(args as never)
      },
    },
  },
}) as unknown as typeof basePrisma

const ADMIN_ID = 'admin-001'
const BASE_URL = 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  details: string
  model?: string
}

const results: TestResult[] = []
let testsPassed = 0
let testsFailed = 0

function record(name: string, ok: boolean, details: string, model?: string) {
  results.push({ name, passed: ok, details, model })
  if (ok) testsPassed++
  else testsFailed++
  const icon = ok ? '✅' : '❌'
  console.log(`  ${icon} ${name}: ${details}`)
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(70)}`)
}

function getPrismaAccessor(model: string): string {
  const accessor = PRISMA_MODEL_MAP[model]
  return accessor || model
}

function getCacheType(model: string): CacheableContent {
  const cacheMap: Record<string, CacheableContent> = {
    classCategory: 'class', subject: 'subject', chapter: 'chapter',
    lecture: 'lecture', mcq: 'mcq', cq: 'cq', suggestion: 'suggestion',
    notice: 'notice', faq: 'faq', banner: 'banner', board: 'board',
    exam: 'exam', contentBundle: 'bundle', contentPackage: 'package',
    blogPost: 'blog', blogCategory: 'blog', featuredContent: 'featured',
  }
  return cacheMap[model] || ('blog' as CacheableContent)
}

// ============================================================
// PHASE 1: Find test records
// ============================================================
async function findTestRecords() {
  section('PHASE 1: Finding Test Records')
  const records: Record<string, { id: string; title: string }[]> = {}

  for (const model of SOFT_DELETE_MODELS) {
    const acc = getPrismaAccessor(model)
    if (!acc) continue
    try {
      const items = await (prisma as any)[acc].findMany({
        where: { deletedAt: null },
        take: 3,
        orderBy: { createdAt: 'desc' },
      })
      records[model] = items.map((item: any) => ({
        id: item.id,
        title: item.title || item.name || item.question || item.uddeepok || item.slug || item.id,
      }))
      console.log(`  ${model}: ${records[model].length} active records found`)
    } catch (err) {
      console.log(`  ${model}: SKIP (${err instanceof Error ? err.message : 'unknown'})`)
    }
  }
  return records
}

// ============================================================
// PHASE 2: Soft Delete + Cache
// ============================================================
async function testSoftDelete(records: Record<string, { id: string; title: string }[]>) {
  section('PHASE 2: Soft Delete Tests')
  for (const [model, items] of Object.entries(records)) {
    if (items.length === 0) { console.log(`  ⏭️  ${model}: no records`); continue }
    const item = items[0]
    try {
      const cacheBefore = await getContentVersion(getCacheType(model))
      await softDelete(prisma, model, item.id, ADMIN_ID, { reason: 'Test soft delete' })

      const acc = getPrismaAccessor(model)
      const deleted = await (prisma as any)[acc].findUnique({ where: { id: item.id } })
      const cacheAfter = await getContentVersion(getCacheType(model))

      if (deleted === null) {
        record(`Soft Delete: ${model}`, false, `Record not found at all after delete`, model)
      } else if (deleted.deletedAt !== null && cacheAfter > cacheBefore) {
        record(`Soft Delete: ${model}`, true, `"${item.title}" deleted, cache invalidated`, model)
      } else if (deleted.deletedAt !== null) {
        record(`Soft Delete: ${model}`, false, `Deleted but cache NOT invalidated`, model)
      } else {
        record(`Soft Delete: ${model}`, false, `deletedAt is still null`, model)
      }
    } catch (err) {
      record(`Soft Delete: ${model}`, false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, model)
    }
  }
}

// ============================================================
// PHASE 3: Restore + Cache
// ============================================================
async function testRestore(records: Record<string, { id: string; title: string }[]>) {
  section('PHASE 3: Restore Tests')
  for (const [model, items] of Object.entries(records)) {
    if (items.length === 0) continue
    const item = items[0]
    try {
      await softDelete(prisma, model, item.id, ADMIN_ID, { reason: 'Pre-restore' }).catch(() => {})
      const cacheBefore = await getContentVersion(getCacheType(model))
      await restore(prisma, model, item.id, ADMIN_ID, { checkParent: false })

      const acc = getPrismaAccessor(model)
      const restored = await (prisma as any)[acc].findUnique({ where: { id: item.id } })
      const cacheAfter = await getContentVersion(getCacheType(model))

      if (restored && restored.deletedAt === null && cacheAfter > cacheBefore) {
        record(`Restore: ${model}`, true, `"${item.title}" restored, cache invalidated`, model)
      } else if (restored && restored.deletedAt === null) {
        record(`Restore: ${model}`, false, `Restored but cache NOT invalidated`, model)
      } else {
        record(`Restore: ${model}`, false, `deletedAt is not null`, model)
      }
    } catch (err) {
      record(`Restore: ${model}`, false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, model)
    }
  }
}

// ============================================================
// PHASE 4: Force Delete
// ============================================================
async function testForceDelete() {
  section('PHASE 4: Force Delete Tests')
  try {
    const notice = await (prisma as any).notice.findFirst({ where: { deletedAt: { not: null } } })
    if (!notice) {
      record('Force Delete: notice', false, 'No soft-deleted notice found', 'notice')
      return
    }
    const noticeId = notice.id
    await forceDelete(prisma, 'notice', noticeId, ADMIN_ID)
    const stillExists = await (prisma as any).notice.findUnique({ where: { id: noticeId } })
    record('Force Delete: notice', !stillExists,
      stillExists ? 'Record still exists after force delete' : `Notice "${notice.title || noticeId}" permanently deleted`, 'notice')
  } catch (err) {
    record('Force Delete: notice', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }
}

// ============================================================
// PHASE 5: Cascade
// ============================================================
async function testCascade() {
  section('PHASE 5: Cascade Tests')

  // blogCategory → blogPost
  try {
    const blogCat = await (prisma as any).blogCategory.findFirst({
      where: { deletedAt: null },
      include: { posts: { where: { deletedAt: null }, take: 1 } },
    })
    if (blogCat && blogCat.posts?.length > 0) {
      const postCount = await (prisma as any).blogPost.count({ where: { categoryId: blogCat.id, deletedAt: null } })
      await softDelete(prisma, 'blogCategory', blogCat.id, ADMIN_ID, { cascade: true, reason: 'Cascade test' })
      const deletedPosts = await (prisma as any).blogPost.count({ where: { categoryId: blogCat.id, deletedAt: { not: null } } })

      if (deletedPosts === postCount) {
        record('Cascade: blogCategory→blogPost', true, `${postCount} posts cascaded`, 'blogCategory')
      } else {
        record('Cascade: blogCategory→blogPost', false, `Expected ${postCount}, got ${deletedPosts}`, 'blogCategory')
      }

      await restore(prisma, 'blogCategory', blogCat.id, ADMIN_ID, { cascade: true })
      const restoredPosts = await (prisma as any).blogPost.count({ where: { categoryId: blogCat.id, deletedAt: null } })
      record('Cascade Restore: blogCategory→blogPost', restoredPosts === postCount,
        restoredPosts === postCount ? `${postCount} posts restored` : `Expected ${postCount}, got ${restoredPosts}`, 'blogCategory')
    } else {
      record('Cascade: blogCategory→blogPost', false, 'No blogCategory with posts found', 'blogCategory')
    }
  } catch (err) {
    record('Cascade: blogCategory→blogPost', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'blogCategory')
  }

  // Class → Subject → Chapter
  try {
    const cc = await (prisma as any).classCategory.findFirst({
      where: { deletedAt: null },
      include: { subjects: { where: { deletedAt: null }, take: 1, include: { chapters: { where: { deletedAt: null }, take: 1 } } } },
    })
    if (cc && cc.subjects?.[0]?.chapters?.[0]) {
      const classId = cc.id
      const subjCount = await (prisma as any).subject.count({ where: { classId, deletedAt: null } })
      const chapCount = await (prisma as any).chapter.count({ where: { subject: { classId }, deletedAt: null } })

      await softDelete(prisma, 'classCategory', classId, ADMIN_ID, { cascade: true, reason: 'Cascade test' })
      const delSubj = await (prisma as any).subject.count({ where: { classId, deletedAt: { not: null } } })
      const delChap = await (prisma as any).chapter.count({ where: { subject: { classId }, deletedAt: { not: null } } })

      const allOk = delSubj === subjCount && delChap === chapCount
      record('Cascade: Class→Subject→Chapter', allOk,
        allOk ? `All ${subjCount + chapCount} descendants cascaded` : `Expected ${subjCount + chapCount}, got ${delSubj + delChap}`, 'classCategory')

      await restore(prisma, 'classCategory', classId, ADMIN_ID, { cascade: true })
      const resSubj = await (prisma as any).subject.count({ where: { classId, deletedAt: null } })
      const resChap = await (prisma as any).chapter.count({ where: { subject: { classId } }, deletedAt: null })
      const restoredOk = resSubj === subjCount && resChap === chapCount
      record('Cascade Restore: Class→Subject→Chapter', restoredOk,
        restoredOk ? `All ${subjCount + chapCount} restored` : `Expected ${subjCount + chapCount}, got ${resSubj + resChap}`, 'classCategory')
    } else {
      record('Cascade: Class→Subject→Chapter', false, 'No class with hierarchy found', 'classCategory')
    }
  } catch (err) {
    record('Cascade: Class→Subject→Chapter', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'classCategory')
  }
}

// ============================================================
// PHASE 6: Bulk Operations
// ============================================================
async function testBulkOperations() {
  section('PHASE 6: Bulk Operations')
  const notices = await (prisma as any).notice.findMany({ where: { deletedAt: null }, take: 3 })
  if (notices.length < 2) { record('Bulk Operations', false, 'Need ≥2 notices', 'notice'); return }

  try {
    for (const n of notices) { await softDelete(prisma, 'notice', n.id, ADMIN_ID, { reason: 'Bulk test' }) }
    const deletedCount = await (prisma as any).notice.count({ where: { id: { in: notices.map((n: any) => n.id) }, deletedAt: { not: null } } })
    record('Bulk Soft Delete', deletedCount === notices.length,
      deletedCount === notices.length ? `${notices.length} notices deleted` : `Expected ${notices.length}, got ${deletedCount}`, 'notice')

    // Use library for bulk restore
    const { bulkRestore } = await import('./src/lib/soft-delete')
    const bulkResult = await bulkRestore(prisma, notices.map((n: any) => ({ model: 'notice', id: n.id })), ADMIN_ID)
    const restoredCount = await (prisma as any).notice.count({ where: { id: { in: notices.map((n: any) => n.id) }, deletedAt: null } })
    record('Bulk Restore', bulkResult.success && restoredCount === notices.length,
      bulkResult.success && restoredCount === notices.length
        ? `${restoredCount}/${notices.length} restored`
        : `Restored ${restoredCount}/${notices.length}, errors: ${bulkResult.errors.join(', ')}`, 'notice')
  } catch (err) {
    record('Bulk Operations', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }
}

// ============================================================
// PHASE 7: Cache Invalidation
// ============================================================
async function testCacheInvalidation() {
  section('PHASE 7: Cache Invalidation')
  const tests = [
    { model: 'blogPost', cacheType: 'blog' as CacheableContent, label: 'Blog' },
    { model: 'lecture', cacheType: 'lecture' as CacheableContent, label: 'Lecture' },
    { model: 'featuredContent', cacheType: 'featured' as CacheableContent, label: 'Featured' },
  ]
  for (const t of tests) {
    try {
      const record2 = await (prisma as any)[getPrismaAccessor(t.model)].findFirst({ where: { deletedAt: null } })
      if (!record2) { record(`Cache: ${t.label}`, false, `No ${t.model} found`, t.model); continue }
      const before = await getContentVersion(t.cacheType)
      await softDelete(prisma, t.model, record2.id, ADMIN_ID, { reason: 'Cache test' })
      const after = await getContentVersion(t.cacheType)
      await restore(prisma, t.model, record2.id, ADMIN_ID, { checkParent: false })
      record(`Cache: ${t.label}`, after > before,
        after > before ? `Version ${before} → ${after}` : 'Not invalidated', t.model)
    } catch (err) {
      record(`Cache: ${t.label}`, false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, t.model)
    }
  }
}

// ============================================================
// PHASE 8: Audit Logging
// ============================================================
async function testAuditLogging() {
  section('PHASE 8: Audit Logging')
  try {
    const notice = await (prisma as any).notice.findFirst({ where: { deletedAt: null } })
    if (!notice) { record('Audit Logging', false, 'No notice found', 'notice'); return }

    await softDelete(prisma, 'notice', notice.id, ADMIN_ID, { reason: 'Audit test' })
    const deleteLogs = await (prisma as any).auditLog.findMany({
      where: { entityType: 'notice', entityId: notice.id, action: { in: ['content_soft_delete', 'soft_delete'] } },
      orderBy: { createdAt: 'desc' }, take: 1,
    })
    await restore(prisma, 'notice', notice.id, ADMIN_ID)
    const restoreLogs = await (prisma as any).auditLog.findMany({
      where: { entityType: 'notice', entityId: notice.id, action: { in: ['restore'] } },
      orderBy: { createdAt: 'desc' }, take: 1,
    })

    if (deleteLogs.length > 0 && restoreLogs.length > 0) {
      record('Audit Logging', true, `Delete: "${deleteLogs[0].action}", Restore: "${restoreLogs[0].action}"`, 'notice')
    } else {
      record('Audit Logging', false, `Delete logs: ${deleteLogs.length}, Restore logs: ${restoreLogs.length}`, 'notice')
    }
  } catch (err) {
    record('Audit Logging', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }
}

// ============================================================
// PHASE 9: Trash Listing (DB verification)
// ============================================================
async function testTrashListing() {
  section('PHASE 9: Trash Listing')
  try {
    // Verify blog posts can be soft-deleted correctly
    const blog = await (prisma as any).blogPost.findFirst({ where: { deletedAt: null } })
    if (blog) { await softDelete(prisma, 'blogPost', blog.id, ADMIN_ID, { reason: 'Trash listing test' }) }

    // Count deleted records across all models
    const modelsWithDeleted: string[] = []
    for (const model of SOFT_DELETE_MODELS) {
      const acc = getPrismaAccessor(model)
      if (!acc) continue
      try {
        const count = await (prisma as any)[acc].count({ where: { deletedAt: { not: null } } })
        if (count > 0) modelsWithDeleted.push(model)
      } catch { /* skip */ }
    }
    record('Trash: models with deleted items', modelsWithDeleted.length > 0,
      `${modelsWithDeleted.length}/${SOFT_DELETE_MODELS.size} models have deleted records (${modelsWithDeleted.slice(0, 6).join(', ')}...)`, 'trash')

    // Count blog posts with deletedAt
    const deletedBlogs = await (prisma as any).blogPost.count({ where: { deletedAt: { not: null } } })
    record('DB: blog posts soft-deleted', deletedBlogs > 0,
      `${deletedBlogs} soft-deleted blog posts in DB`, 'blogPost')
  } catch (err) {
    record('Trash listing', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'trash')
  }
}

// ============================================================
// PHASE 10: Edge Cases
// ============================================================
async function testEdgeCases() {
  section('PHASE 10: Edge Cases')

  // Double delete
  try {
    const n = await (prisma as any).notice.findFirst({ where: { deletedAt: null } })
    if (n) {
      await softDelete(prisma, 'notice', n.id, ADMIN_ID, { reason: 'Double delete test' })
      try {
        await softDelete(prisma, 'notice', n.id, ADMIN_ID, { reason: 'Second delete' })
        record('Edge: Double delete', false, 'Should have thrown on second delete', 'notice')
      } catch {
        record('Edge: Double delete', true, 'Correctly rejected second delete', 'notice')
      }
      await restore(prisma, 'notice', n.id, ADMIN_ID)
    }
  } catch (err) {
    record('Edge: Double delete', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }

  // Restore already-active item
  try {
    const n2 = await (prisma as any).notice.findFirst({ where: { deletedAt: null } })
    if (n2) {
      try {
        await restore(prisma, 'notice', n2.id, ADMIN_ID)
        record('Edge: Restore active', false, 'Should have rejected restore of active item', 'notice')
      } catch {
        record('Edge: Restore active', true, 'Correctly rejected restore of active item', 'notice')
      }
    }
  } catch (err) {
    record('Edge: Restore active', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }

  // Force delete active item
  try {
    const n3 = await (prisma as any).notice.findFirst({ where: { deletedAt: null } })
    if (n3) {
      try {
        await forceDelete(prisma, 'notice', n3.id, ADMIN_ID)
        record('Edge: Force active', false, 'Should have rejected force delete of active item', 'notice')
      } catch {
        record('Edge: Force active', true, 'Correctly rejected force delete of active item', 'notice')
      }
    }
  } catch (err) {
    record('Edge: Force active', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'notice')
  }

  // Cascade block (delete class with children, no cascade)
  try {
    const cc = await (prisma as any).classCategory.findFirst({
      where: { deletedAt: null },
      include: { subjects: { where: { deletedAt: null }, take: 1 } },
    })
    if (cc && cc.subjects?.length > 0) {
      try {
        await softDelete(prisma, 'classCategory', cc.id, ADMIN_ID, { cascade: false })
        record('Edge: Cascade block', false, 'Should have blocked with active children', 'classCategory')
      } catch {
        record('Edge: Cascade block', true, 'Correctly blocked delete with active children', 'classCategory')
      }
    }
  } catch (err) {
    record('Edge: Cascade block', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'classCategory')
  }
}

// ============================================================
// PHASE 11: Rate Limiting
// ============================================================
async function testRateLimiting() {
  section('PHASE 11: Rate Limiting')
  try {
    const responses: number[] = []
    let gotLimited = false
    for (let i = 0; i < 65; i++) {
      const res = await fetch(`${BASE_URL}/api/admin/trash`)
      responses.push(res.status)
      if (res.status === 429) { gotLimited = true; break }
    }
    if (gotLimited) {
      record('Rate Limiting', true, `Limited after ${responses.length} requests (429)`, 'trash')
    } else {
      const minR = Math.min(...responses), maxR = Math.max(...responses)
      record('Rate Limiting', false, `Not limited after ${responses.length} requests (${minR}-${maxR})`, 'trash')
    }
  } catch (err) {
    record('Rate Limiting', false, `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'trash')
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗\n║     TRASH SYSTEM — COMPLETE FUNCTIONAL VERIFICATION        ║\n╚══════════════════════════════════════════════════════════════╝\n`)
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Prisma version: 7.8.0`)

  try {
    const testRecords = await findTestRecords()
    await testSoftDelete(testRecords)
    await testRestore(testRecords)
    await testCascade()
    await testBulkOperations()
    await testCacheInvalidation()
    await testAuditLogging()
    await testTrashListing()
    await testEdgeCases()
    await testForceDelete()
    await testRateLimiting()
  } catch (err) {
    console.error('\nUNEXPECTED ERROR:', err)
  } finally {
    await prisma.$disconnect()
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`  FINAL SUMMARY`)
  console.log(`${'='.repeat(70)}`)
  console.log(`  Total Tests: ${results.length}`)
  console.log(`  ✅ Passed: ${testsPassed}`)
  console.log(`  ❌ Failed: ${testsFailed}`)
  const passRate = results.length > 0 ? Math.round((testsPassed / results.length) * 100) : 0
  console.log(`  Pass Rate: ${passRate}%`)

  if (testsFailed > 0) {
    console.log(`\n⚠️  FAILED TESTS:`)
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.details}`)
    }
  }

  const modelCoverage = new Map<string, TestResult[]>()
  for (const r of results) {
    if (r.model) {
      const arr = modelCoverage.get(r.model) || []
      arr.push(r); modelCoverage.set(r.model, arr)
    }
  }
  console.log(`\n${'─'.repeat(35)} MODEL COVERAGE ${'─'.repeat(34)}`)
  for (const [model, tests] of modelCoverage) {
    const p = tests.filter(t => t.passed).length
    const f = tests.filter(t => !t.passed).length
    console.log(`  ${f === 0 ? '✅' : '⚠️'} ${model}: ${p}/${p + f} passed`)
  }

  console.log(`\n${'='.repeat(70)}`)
  if (testsFailed === 0) {
    console.log(`\n  🟢 PRODUCTION READY — All ${results.length} tests passed`)
  } else if (passRate >= 80) {
    console.log(`\n  🟡 MOSTLY READY — ${testsFailed} tests failed`)
  } else {
    console.log(`\n  🔴 NOT READY — ${testsFailed} tests failed`)
  }
  console.log()
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
