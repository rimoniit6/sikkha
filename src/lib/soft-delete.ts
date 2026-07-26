/**
 * Soft Delete Architecture — Centralized Utility Layer
 *
 * Provides softDelete, restore, and forceDelete operations for all Category A models.
 * All operations run inside $transaction for atomicity.
 *
 * Usage:
 *   import { softDelete, restore, forceDelete } from '@/lib/soft-delete'
 *   await softDelete(db, 'chapter', chapterId, adminId, 'Outdated content')
 *   await restore(db, 'chapter', chapterId, adminId)
 *   await forceDelete(db, 'chapter', chapterId, adminId, 'GDPR request')
 */

import { invalidateMultipleCache } from '@/lib/cache-invalidate'
import type { CacheableContent } from '@/lib/cache-invalidate'

// Using `any` for the db parameter because Prisma's extended client types
// are incompatible with the base PrismaClient type in interactive transactions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any

// Model name → cache type mapping for automated cache invalidation
const MODEL_CACHE_MAP: Record<string, CacheableContent | CacheableContent[]> = {
  classCategory: 'class',
  subject: 'subject',
  chapter: 'chapter',
  lecture: 'lecture',
  mcq: 'mcq',
  cq: 'cq',
  suggestion: 'suggestion',
  notice: 'notice',
  faq: 'faq',
  banner: 'banner',
  board: 'board',
  exam: 'exam',
  contentBundle: 'bundle',
  contentPackage: 'package',
  blogPost: 'blog',
  featuredContent: 'featured',
}

function getCacheTypesFromModel(model: string): CacheableContent[] {
  const mapped = MODEL_CACHE_MAP[model]
  if (!mapped) return []
  return Array.isArray(mapped) ? mapped : [mapped]
}

function getCacheTypesFromModels(models: string[]): CacheableContent[] {
  const types = new Set<CacheableContent>()
  for (const model of models) {
    for (const ct of getCacheTypesFromModel(model)) {
      types.add(ct)
    }
  }
  return Array.from(types)
}

// ─── Category A Models (support soft delete) ───

export const SOFT_DELETE_MODELS = new Set([
  'classCategory',
  'subject',
  'chapter',
  'topic',
  'knowledgeQuestion',
  'lecture',
  'resource',
  'mcq',
  'cq',
  'suggestion',
  'course',
  'courseLesson',
  'banner',
  'faq',
  'testimonial',
  'notice',
  'navigation',
  'contentType',
  'featuredContent',
  'contentBundle',
  'contentPackage',
  'mcqExamPackage',
  'cqExamPackage',
  'teacherModerator',
  'board',
  'examYear',
  'boardYear',
  'exam',
  'userSubscription',
  'mcqExamPackagePurchase',
  'cqExamPackagePurchase',
  'blogPost',
  'blogCategory',
])

export function isSoftDeleteModel(model: string): boolean {
  return SOFT_DELETE_MODELS.has(model)
}

/**
 * Maps lowercase logical model names to their Prisma Client accessor names.
 * Models with all-caps prefixes (MCQ, CQ, FAQ) need special handling
 * because Prisma generates `mCQ`, `cQ`, `fAQ` accessors, not `mcq`, `cq`, `faq`.
 */
export const PRISMA_MODEL_MAP: Record<string, string> = {
  mcq: 'mCQ',
  cq: 'cQ',
  faq: 'fAQ',
  mcqExamPackage: 'mCQExamPackage',
  mcqExamPackagePurchase: 'mCQExamPackagePurchase',
  mcqExamSet: 'mCQExamSet',
  mcqExamSetQuestion: 'mCQExamSetQuestion',
  mcqExamSetResult: 'mCQExamSetResult',
  mcqExamRetakeRequest: 'mCQExamRetakeRequest',
  cqExamPackage: 'cQExamPackage',
  cqExamPackagePurchase: 'cQExamPackagePurchase',
  cqExamSet: 'cQExamSet',
  cqExamSetQuestion: 'cQExamSetQuestion',
  cqExamSubmission: 'cQExamSubmission',
  cqExamAnswer: 'cQExamAnswer',
  cqExamAnswerImage: 'cQExamAnswerImage',
  cqExamRetakeRequest: 'cQExamRetakeRequest',
  blogPost: 'blogPost',
  blogCategory: 'blogCategory',
}

export function getPrismaModel(logicalName: string): string {
  const accessor = PRISMA_MODEL_MAP[logicalName]
  if (accessor) return accessor
  return logicalName
}

// ─── Cascade Rules ───
// Maps parent model → child models that should cascade soft-delete

export const CASCADE_RULES: Record<string, string[]> = {
  classCategory: ['subject'],
  subject: ['chapter'],
  chapter: ['lecture', 'mcq', 'cq', 'knowledgeQuestion', 'topic', 'suggestion'],
  lecture: ['resource'],
  course: ['courseLesson'],
  blogCategory: ['blogPost'],
}

/**
 * Maps parent model names to their actual FK field name in child models.
 * Falls back to `${parentModel}Id` convention when no entry exists.
 */
const FK_FIELD_MAP: Record<string, string> = {
  classCategory: 'classId',  // Subject uses classId, not classCategoryId
  blogCategory: 'categoryId', // BlogPost uses categoryId, not blogCategoryId
}

function fkField(model: string): string {
  return FK_FIELD_MAP[model] || `${model}Id`
}

// ─── Soft Delete ───

export interface SoftDeleteOptions {
  cascade?: boolean
  reason?: string
}

export interface SoftDeleteResult {
  success: boolean
  deletedCount: number
  cascadeCount: number
  errors: string[]
}

/**
 * Soft-delete a record by setting deletedAt/deletedBy/deleteReason.
 * By default, blocks if children exist (cascade=false).
 * With cascade=true, recursively soft-deletes all descendants.
 */
export async function softDelete(
  db: AnyPrismaClient,
  model: string,
  id: string,
  userId: string,
  options: SoftDeleteOptions = {}
): Promise<SoftDeleteResult> {
  const { cascade = false, reason } = options

  if (!isSoftDeleteModel(model)) {
    return { success: false, deletedCount: 0, cascadeCount: 0, errors: [`Model '${model}' does not support soft delete`] }
  }

  const now = new Date()
  let deletedCount = 0
  let cascadeCount = 0
  const errors: string[] = []

  try {
    await db.$transaction(async (tx: AnyPrismaClient) => {
      // Check if already deleted
      const existing = await tx[getPrismaModel(model)].findUnique({ where: { id } })
      if (!existing) {
        throw new Error(`Record not found: ${model}/${id}`)
      }
      if (existing.deletedAt) {
        throw new Error(`Record already deleted: ${model}/${id}`)
      }

      // Check for children
      const childModels = CASCADE_RULES[model] || []
      for (const childModel of childModels) {
        const childCount = await tx[getPrismaModel(childModel)].count({
          where: { [fkField(model)]: id, deletedAt: null },
        })
        if (childCount > 0) {
          if (!cascade) {
            throw new Error(
              `Cannot delete: ${childCount} ${childModel} records exist. Use cascade=true to soft-delete children too.`
            )
          }
          // Cascade: soft-delete all children
          const childIds = await tx[getPrismaModel(childModel)].findMany({
            where: { [fkField(model)]: id, deletedAt: null },
            select: { id: true },
          })
          for (const child of childIds) {
            const childResult = await softDelete(tx, childModel, child.id, userId, { cascade: true, reason })
            cascadeCount += childResult.deletedCount + childResult.cascadeCount
            errors.push(...childResult.errors)
          }
        }
      }

      // Soft-delete the parent
      await tx[getPrismaModel(model)].update({
        where: { id },
        data: {
          deletedAt: now,
          deletedBy: userId,
          deleteReason: reason || null,
        },
      })
      deletedCount++
    }, {
      maxWait: 10000,
      timeout: 30000,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Soft delete failed for ${model}/${id}: ${message}`)
  }

  // Invalidate cache after successful soft delete
  const cacheTypes = getCacheTypesFromModel(model)
  if (cacheTypes.length > 0) {
    await invalidateMultipleCache(cacheTypes).catch(() => {})
  }

  return { success: true, deletedCount, cascadeCount, errors }
}

// ─── Restore ───

export interface RestoreOptions {
  /** Validate parent hierarchy exists and is active (default: true) */
  checkParent?: boolean
  /** Recursively restore all soft-deleted children (default: false) */
  cascade?: boolean
}

export interface RestoreResult {
  success: boolean
  restoredCount: number
  cascadeCount: number
  errors: string[]
  slugChanged?: boolean
  newSlug?: string
  /** Audit trail for each restored record */
  auditTrail: Array<{
    model: string
    id: string
    previousDeletedAt: Date | null
    previousDeletedBy: string | null
    slugChanged: boolean
  }>
}

/**
 * Restore a soft-deleted record by clearing deletedAt.
 *
 * Validation:
 * - Record must exist and be soft-deleted
 * - Parent hierarchy must exist and be active (if checkParent=true)
 * - Slug conflicts are resolved automatically
 *
 * Cascade:
 * - With cascade=true, recursively restores all soft-deleted children
 * - Each child is validated before restore
 *
 * All operations run inside a single transaction — rollback on any failure.
 */
export async function restore(
  db: AnyPrismaClient,
  model: string,
  id: string,
  userId: string,
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  const { checkParent = true, cascade = false } = options

  if (!isSoftDeleteModel(model)) {
    return { success: false, restoredCount: 0, cascadeCount: 0, errors: [`Model '${model}' does not support soft delete`], auditTrail: [] }
  }

  const errors: string[] = []
  const auditTrail: RestoreResult['auditTrail'] = []
  let slugChanged = false
  let newSlug: string | undefined
  let cascadeCount = 0

  try {
    await db.$transaction(async (tx: AnyPrismaClient) => {
      // Step 1: Fetch the record to restore (with includeDeleted to bypass filter)
      const existing = await tx[getPrismaModel(model)].findUnique({
        where: { id },
        includeDeleted: true,
      })
      if (!existing) {
        throw new Error(`Record not found: ${model}/${id}`)
      }
      if (!existing.deletedAt) {
        throw new Error(`Record is not deleted: ${model}/${id}`)
      }

      // Step 2: Validate parent hierarchy
      if (checkParent) {
        const validationResult = await validateParentHierarchy(tx, model, existing)
        if (!validationResult.ok) {
          throw new Error(validationResult.error!)
        }
      }

      // Step 3: Restore the record
      const previousDeletedAt = existing.deletedAt
      const previousDeletedBy = existing.deletedBy

      if (existing.slug) {
        // Check slug uniqueness against active records
        const slugConflict = await tx[getPrismaModel(model)].findFirst({
          where: {
            slug: existing.slug,
            id: { not: id },
            deletedAt: null,
          },
        })
        if (slugConflict) {
          const timestamp = Date.now()
          const newSlugVal = `${existing.slug}-restored-${timestamp}`
          await tx[getPrismaModel(model)].update({
            where: { id },
            data: {
              deletedAt: null,
              deletedBy: null,
              deleteReason: null,
              slug: newSlugVal,
            },
            includeDeleted: true,
          })
          slugChanged = true
          newSlug = newSlugVal
        } else {
          await tx[getPrismaModel(model)].update({
            where: { id },
            data: {
              deletedAt: null,
              deletedBy: null,
              deleteReason: null,
            },
            includeDeleted: true,
          })
        }
      } else {
        await tx[getPrismaModel(model)].update({
          where: { id },
          data: {
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
          },
          includeDeleted: true,
        })
      }

      auditTrail.push({
        model,
        id,
        previousDeletedAt,
        previousDeletedBy,
        slugChanged,
      })

      // Step 4: Cascade restore children if requested
      if (cascade) {
        const childModels = CASCADE_RULES[model] || []
        for (const childModel of childModels) {
          // Find soft-deleted children of this record
          const deletedChildren = await tx[getPrismaModel(childModel)].findMany({
            where: {
              [fkField(model)]: id,
              deletedAt: { not: null },
            },
            includeDeleted: true,
            select: { id: true },
          })

          for (const child of deletedChildren) {
            const childResult = await restore(tx, childModel, child.id, userId, {
              checkParent: false, // Parent is being restored, so skip parent check
              cascade: true,      // Recursively restore all descendants
            })
            cascadeCount += childResult.restoredCount + childResult.cascadeCount
            auditTrail.push(...childResult.auditTrail)
            errors.push(...childResult.errors)
          }
        }
      }
    }, {
      maxWait: 15000,
      timeout: 30000, // Longer timeout for cascade restores
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Restore failed for ${model}/${id}: ${message}`)
  }

  // Invalidate cache after successful restore
  const cacheTypes = getCacheTypesFromModel(model)
  if (cacheTypes.length > 0) {
    await invalidateMultipleCache(cacheTypes).catch(() => {})
  }

  return { success: true, restoredCount: 1, cascadeCount, errors, slugChanged, newSlug, auditTrail }
}

// ─── Bulk Restore ───

export interface BulkRestoreOptions {
  /** Recursively restore all soft-deleted children (default: false) */
  cascade?: boolean
}

export interface BulkRestoreResult {
  success: boolean
  restoredCount: number
  cascadeCount: number
  failedCount: number
  errors: string[]
  /** Audit trail for each restored record */
  auditTrail: Array<{
    model: string
    id: string
    previousDeletedAt: Date | null
    previousDeletedBy: string | null
    slugChanged: boolean
  }>
  /** Per-record results */
  results: Array<{
    id: string
    model: string
    success: boolean
    error?: string
    slugChanged?: boolean
  }>
}

/**
 * Bulk restore multiple soft-deleted records in a SINGLE transaction.
 *
 * If ANY record fails validation, the ENTIRE batch rolls back.
 * This ensures atomicity — never partial restore.
 *
 * Validation (for each record):
 * - Record must exist and be soft-deleted
 * - Parent hierarchy must exist and be active
 * - Slug conflicts are resolved automatically
 *
 * Performance:
 * - All records validated first
 * - All records restored in single transaction
 * - Batch slug conflict detection
 */
export async function bulkRestore(
  db: AnyPrismaClient,
  items: Array<{ model: string; id: string }>,
  userId: string,
  options: BulkRestoreOptions = {}
): Promise<BulkRestoreResult> {
  const { cascade = false } = options
  const errors: string[] = []
  const auditTrail: BulkRestoreResult['auditTrail'] = []
  const results: BulkRestoreResult['results'] = []
  let cascadeCount = 0

  if (items.length === 0) {
    return { success: true, restoredCount: 0, cascadeCount: 0, failedCount: 0, errors: [], auditTrail: [], results: [] }
  }

  try {
    await db.$transaction(async (tx: AnyPrismaClient) => {
      // Phase 1: Validate ALL records before restoring any
      const validatedItems: Array<{
        model: string
        id: string
        record: any
        slugChanged: boolean
        newSlug?: string
      }> = []

      for (const item of items) {
        if (!isSoftDeleteModel(item.model)) {
          throw new Error(`Model '${item.model}' does not support soft delete`)
        }

        const existing = await tx[getPrismaModel(item.model)].findUnique({
          where: { id: item.id },
          includeDeleted: true,
        })
        if (!existing) {
          throw new Error(`Record not found: ${item.model}/${item.id}`)
        }
        if (!existing.deletedAt) {
          throw new Error(`Record is not deleted: ${item.model}/${item.id}`)
        }

        // Validate parent hierarchy
        const validationResult = await validateParentHierarchy(tx, item.model, existing)
        if (!validationResult.ok) {
          throw new Error(`${validationResult.error} (${item.model}/${item.id})`)
        }

        // Check slug conflict
        let slugChanged = false
        let newSlug: string | undefined
        if (existing.slug) {
          const slugConflict = await tx[getPrismaModel(item.model)].findFirst({
            where: {
              slug: existing.slug,
              id: { not: item.id },
              deletedAt: null,
            },
          })
          if (slugConflict) {
            const timestamp = Date.now()
            newSlug = `${existing.slug}-restored-${timestamp}`
            slugChanged = true
          }
        }

        validatedItems.push({
          model: item.model,
          id: item.id,
          record: existing,
          slugChanged,
          newSlug,
        })
      }

      // Phase 2: Restore ALL validated records
      for (const item of validatedItems) {
        const updateData: Record<string, unknown> = {
          deletedAt: null,
          deletedBy: null,
          deleteReason: null,
        }
        if (item.slugChanged && item.newSlug) {
          updateData.slug = item.newSlug
        }

        await tx[getPrismaModel(item.model)].update({
          where: { id: item.id },
          data: updateData,
          includeDeleted: true,
        })

        auditTrail.push({
          model: item.model,
          id: item.id,
          previousDeletedAt: item.record.deletedAt,
          previousDeletedBy: item.record.deletedBy,
          slugChanged: item.slugChanged,
        })

        results.push({
          id: item.id,
          model: item.model,
          success: true,
          slugChanged: item.slugChanged,
        })

        // Phase 3: Cascade restore children if requested
        if (cascade) {
          const childModels = CASCADE_RULES[item.model] || []
          for (const childModel of childModels) {
            const deletedChildren = await tx[getPrismaModel(childModel)].findMany({
              where: {
                [fkField(item.model)]: item.id,
                deletedAt: { not: null },
              },
              includeDeleted: true,
              select: { id: true },
            })

            for (const child of deletedChildren) {
              const childResult = await restore(tx, childModel, child.id, userId, {
                checkParent: false,
                cascade: true,
              })
              cascadeCount += childResult.restoredCount + childResult.cascadeCount
              auditTrail.push(...childResult.auditTrail)
              results.push({
                id: child.id,
                model: childModel,
                success: childResult.success,
                error: childResult.errors[0],
                slugChanged: childResult.slugChanged,
              })
              if (!childResult.success) {
                throw new Error(`Cascade restore failed: ${childResult.errors[0]} (${childModel}/${child.id})`)
              }
            }
          }
        }
      }
    }, {
      maxWait: 30000,
      timeout: 120000, // 2 minutes for large bulk restores
    })
  } catch (err) {
    // Transaction rolled back — all changes undone
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    errors.push(errorMsg)
    return {
      success: false,
      restoredCount: 0,
      cascadeCount: 0,
      failedCount: items.length,
      errors,
      auditTrail: [],
      results: items.map(item => ({
        id: item.id,
        model: item.model,
        success: false,
        error: errorMsg,
      })),
    }
  }

  const restoredCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  // Invalidate cache after successful bulk restore
  if (restoredCount > 0) {
    const cacheTypes = getCacheTypesFromModels(items.map(i => i.model))
    if (cacheTypes.length > 0) {
      await invalidateMultipleCache(cacheTypes).catch(() => {})
    }
  }

  return {
    success: failedCount === 0,
    restoredCount,
    cascadeCount,
    failedCount,
    errors,
    auditTrail,
    results,
  }
}

// ─── Multi-Level Parent Validation ───

/**
 * Full parent hierarchy map — each model → { field, model, parent (grandparent) }
 * Used for multi-level validation: e.g., chapter → subject → classCategory
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PARENT_HIERARCHY: Record<string, any> = {
  subject: { field: 'classId', model: 'classCategory' },
  chapter: {
    field: 'subjectId', model: 'subject',
    parent: { field: 'classId', model: 'classCategory' },
  },
  topic: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  lecture: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  mcq: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  cq: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  knowledgeQuestion: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  suggestion: {
    field: 'chapterId', model: 'chapter',
    parent: {
      field: 'subjectId', model: 'subject',
      parent: { field: 'classId', model: 'classCategory' },
    },
  },
  resource: {
    field: 'lectureId', model: 'lecture',
    parent: {
      field: 'chapterId', model: 'chapter',
      parent: {
        field: 'subjectId', model: 'subject',
        parent: { field: 'classId', model: 'classCategory' },
      },
    },
  },
  courseLesson: {
    field: 'courseId', model: 'course',
  },
  blogPost: {
    field: 'categoryId', model: 'blogCategory',
  },
  boardYear: {
    // Special: BoardYear has two parents (Board + ExamYear)
    field: 'board', model: 'board', // Custom check below
  },
}

async function validateParentHierarchy(
  tx: any,
  model: string,
  record: any
): Promise<{ ok: boolean; error?: string }> {
  // Special case: BoardYear needs both Board and ExamYear
  if (model === 'boardYear') {
    if (record.board) {
      const board = await tx.board.findUnique({
        where: { slug: record.board },
        includeDeleted: true,
      })
      if (board && board.deletedAt) {
        return { ok: false, error: `Board "${record.board}" is deleted. Restore it first.` }
      }
      if (!board) {
        return { ok: false, error: `Board "${record.board}" not found.` }
      }
    }
    if (record.year) {
      const examYear = await tx.examYear.findFirst({
        where: { year: record.year },
        includeDeleted: true,
      })
      if (examYear && examYear.deletedAt) {
        return { ok: false, error: `Exam year ${record.year} is deleted. Restore it first.` }
      }
      // ExamYear not existing is ok — it's just a reference
    }
    return { ok: true }
  }

  const hierarchy = PARENT_HIERARCHY[model]
  if (!hierarchy) return { ok: true } // No parent required

  // Check immediate parent
  const parentId = record[hierarchy.field]
  if (!parentId) return { ok: true } // No parent ID set

  const parent = await tx[getPrismaModel(hierarchy.model)].findUnique({
    where: { id: parentId },
    includeDeleted: true,
  })
  if (!parent) {
    return { ok: false, error: `Parent ${hierarchy.model} not found. It may have been permanently deleted.` }
  }
  if (parent.deletedAt) {
    const label = MODEL_LABELS[hierarchy.model] || hierarchy.model
    return { ok: false, error: `${label} "${parent.name || parent.title || parent.slug || parent.id}" is deleted. Restore it first.` }
  }

  // Check grandparent if defined
  if (hierarchy.parent) {
    const grandparentId = parent[hierarchy.parent.field]
    if (grandparentId) {
      const grandparent = await tx[getPrismaModel(hierarchy.parent.model)].findUnique({
        where: { id: grandparentId },
        includeDeleted: true,
      })
      if (grandparent && grandparent.deletedAt) {
        const label = MODEL_LABELS[hierarchy.parent.model] || hierarchy.parent.model
        return { ok: false, error: `${label} "${grandparent.name || grandparent.title || grandparent.slug || grandparent.id}" is deleted. Restore it first.` }
      }
    }
  }

  return { ok: true }
}

// Label map for error messages (imported from trash/route.ts pattern)
export const MODEL_LABELS: Record<string, string> = {
  classCategory: 'শ্রেণি',
  subject: 'বিষয়',
  chapter: 'অধ্যায়',
  topic: 'টপিক',
  knowledgeQuestion: 'সংক্ষিপ্ত প্রশ্ন',
  lecture: 'লেকচার',
  resource: 'রিসোর্স',
  mcq: 'MCQ',
  cq: 'CQ',
  suggestion: 'সাজেশন',
  course: 'কোর্স',
  courseLesson: 'কোর্স লেসন',
  banner: 'ব্যানার',
  faq: 'FAQ',
  testimonial: 'টেস্টিমোনিয়াল',
  notice: 'নোটিশ',
  navigation: 'নেভিগেশন',
  contentType: 'কন্টেন্ট টাইপ',
  featuredContent: 'ফিচার্ড কন্টেন্ট',
  contentBundle: 'বান্ডেল',
  contentPackage: 'প্যাকেজ',
  mcqExamPackage: 'MCQ এক্সাম প্যাকেজ',
  cqExamPackage: 'CQ এক্সাম প্যাকেজ',
  teacherModerator: 'শিক্ষক',
  board: 'বোর্ড',
  examYear: 'পরীক্ষার সাল',
  boardYear: 'বোর্ড সাল',
  exam: 'এক্সাম',
  userSubscription: 'সাবস্ক্রিপশন',
  mcqExamPackagePurchase: 'MCQ ক্রয়',
  cqExamPackagePurchase: 'CQ ক্রয়',
  blogPost: 'ব্লগ পোস্ট',
  blogCategory: 'ব্লগ ক্যাটাগরি',
}

// ─── Force Delete (permanent) ───

export interface ForceDeleteOptions {
  /** Recursively delete all soft-deleted descendants (default: false) */
  cascade?: boolean
}

export interface ForceDeleteResult {
  success: boolean
  deletedCount: number
  cascadeCount: number
  errors: string[]
  /** Audit trail for each deleted record */
  auditTrail: Array<{
    model: string
    id: string
    displayTitle: string
    previousDeletedAt: Date | null
    previousDeletedBy: string | null
  }>
}

/**
 * Preview what would be deleted by a force delete operation.
 * Returns the dependency tree without actually deleting anything.
 */
export async function previewForceDelete(
  db: AnyPrismaClient,
  model: string,
  id: string,
  cascade: boolean = false
): Promise<{
  success: boolean
  record: { model: string; id: string; displayTitle: string } | null
  dependencies: Array<{ model: string; label: string; totalCount: number; activeCount: number; deletedCount: number }>
  totalDeleted: number
  totalActive: number
  errors: string[]
}> {
  const errors: string[] = []
  const dependencies: Array<{ model: string; label: string; totalCount: number; activeCount: number; deletedCount: number }> = []

  if (!isSoftDeleteModel(model)) {
    return { success: false, record: null, dependencies: [], totalDeleted: 0, totalActive: 0, errors: [`Model '${model}' does not support force delete`] }
  }

  try {
    // Fetch the record
    const existing = await db[getPrismaModel(model)].findUnique({
      where: { id },
      includeDeleted: true,
    })
    if (!existing) {
      return { success: false, record: null, dependencies: [], totalDeleted: 0, totalActive: 0, errors: [`Record not found: ${model}/${id}`] }
    }
    if (!existing.deletedAt) {
      return { success: false, record: null, dependencies: [], totalDeleted: 0, totalActive: 0, errors: [`Record is not deleted: ${model}/${id}`] }
    }

    // Get display title
    const displayFields = DISPLAY_FIELDS_MAP[model] || []
    const titleParts = displayFields.map((f: string) => existing[f]).filter(Boolean).map(String).slice(0, 2)
    const displayTitle = titleParts.join(' — ') || existing.name || existing.title || existing.slug || id

    // Count dependencies recursively
    const childModels = CASCADE_RULES[model] || []
    for (const childModel of childModels) {
      const [activeCount, deletedCount] = await Promise.all([
        db[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: null } }),
        db[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: { not: null } } }),
      ])
      const label = MODEL_LABELS[childModel] || childModel
      dependencies.push({
        model: childModel,
        label,
        totalCount: activeCount + deletedCount,
        activeCount,
        deletedCount,
      })

      // If cascade, recursively count grandchildren
      if (cascade && deletedCount > 0) {
        const grandchildModels = CASCADE_RULES[childModel] || []
        for (const grandchildModel of grandchildModels) {
          const deletedChildren = await db[getPrismaModel(childModel)].findMany({
            where: { [fkField(model)]: id, deletedAt: { not: null } },
            includeDeleted: true,
            select: { id: true },
          })
          for (const child of deletedChildren) {
            const [gcActive, gcDeleted] = await Promise.all([
              db[getPrismaModel(grandchildModel)].count({ where: { [fkField(childModel)]: child.id, deletedAt: null } }),
              db[getPrismaModel(grandchildModel)].count({ where: { [fkField(childModel)]: child.id, deletedAt: { not: null } } }),
            ])
            const gcLabel = MODEL_LABELS[grandchildModel] || grandchildModel
            const existing = dependencies.find(d => d.model === grandchildModel)
            if (existing) {
              existing.totalCount += gcActive + gcDeleted
              existing.activeCount += gcActive
              existing.deletedCount += gcDeleted
            } else {
              dependencies.push({
                model: grandchildModel,
                label: gcLabel,
                totalCount: gcActive + gcDeleted,
                activeCount: gcActive,
                deletedCount: gcDeleted,
              })
            }
          }
        }
      }
    }

    const totalDeleted = dependencies.reduce((sum, d) => sum + d.deletedCount, 0)
    const totalActive = dependencies.reduce((sum, d) => sum + d.activeCount, 0)

    return {
      success: true,
      record: { model, id, displayTitle },
      dependencies: dependencies.filter(d => d.totalCount > 0),
      totalDeleted,
      totalActive,
      errors: [],
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown error')
    return { success: false, record: null, dependencies: [], totalDeleted: 0, totalActive: 0, errors }
  }
}

// Display fields map for preview
export const DISPLAY_FIELDS_MAP: Record<string, string[]> = {
  classCategory: ['name', 'slug'],
  subject: ['name', 'slug'],
  chapter: ['name', 'slug'],
  topic: ['name', 'slug'],
  knowledgeQuestion: ['question'],
  lecture: ['title', 'slug'],
  resource: ['title'],
  mcq: ['question'],
  cq: ['uddeepok'],
  suggestion: ['title', 'slug'],
  course: ['title', 'slug'],
  courseLesson: ['title'],
  banner: ['title'],
  faq: ['question'],
  testimonial: ['name', 'content'],
  notice: ['title'],
  navigation: ['label', 'route'],
  contentType: ['key', 'labelBn'],
  featuredContent: ['contentType', 'title'],
  contentBundle: ['title', 'slug'],
  contentPackage: ['title', 'slug'],
  mcqExamPackage: ['title'],
  cqExamPackage: ['title'],
  teacherModerator: ['name', 'title'],
  board: ['name', 'slug'],
  examYear: ['year'],
  boardYear: ['board', 'year'],
  exam: ['title'],
  userSubscription: ['classLevel'],
  mcqExamPackagePurchase: ['purchasedAt'],
  cqExamPackagePurchase: ['purchasedAt'],
  blogPost: ['title', 'slug'],
  blogCategory: ['name', 'slug'],
}

/**
 * Permanently delete a soft-deleted record from the database.
 *
 * Modes:
 * - cascade=false: Blocks if ANY children exist (active or deleted)
 * - cascade=true: Deletes only soft-deleted descendants, blocks if active children exist
 *
 * All operations run inside a single transaction — rollback on any failure.
 */
export async function forceDelete(
  db: AnyPrismaClient,
  model: string,
  id: string,
  userId: string,
  options: ForceDeleteOptions = {}
): Promise<ForceDeleteResult> {
  const { cascade = false } = options
  const errors: string[] = []
  const auditTrail: ForceDeleteResult['auditTrail'] = []
  let cascadeCount = 0

  if (!isSoftDeleteModel(model)) {
    return { success: false, deletedCount: 0, cascadeCount: 0, errors: [`Model '${model}' does not support force delete`], auditTrail: [] }
  }

  try {
    await db.$transaction(async (tx: AnyPrismaClient) => {
      // Step 1: Fetch the record
      const existing = await tx[getPrismaModel(model)].findUnique({
        where: { id },
        includeDeleted: true,
      })
      if (!existing) {
        throw new Error(`Record not found: ${model}/${id}`)
      }
      if (!existing.deletedAt) {
        throw new Error(`Record must be soft-deleted first before permanent deletion: ${model}/${id}`)
      }

      // Step 2: Check dependencies
      const childModels = CASCADE_RULES[model] || []
      for (const childModel of childModels) {
        const [activeCount, deletedCount] = await Promise.all([
          tx[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: null } }),
          tx[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: { not: null } } }),
        ])

        if (!cascade) {
          // Mode A: Block if ANY children exist
          if (activeCount + deletedCount > 0) {
            const label = MODEL_LABELS[childModel] || childModel
            throw new Error(
              `Cannot permanently delete: ${activeCount + deletedCount} ${label} records still reference this. Delete children first or use cascade mode.`
            )
          }
        } else {
          // Mode B: Block if ACTIVE children exist
          if (activeCount > 0) {
            const label = MODEL_LABELS[childModel] || childModel
            throw new Error(
              `Cannot cascade delete: ${activeCount} active ${label} records exist. Only soft-deleted records can be permanently deleted.`
            )
          }
          // Cascade: delete soft-deleted children
          if (deletedCount > 0) {
            const deletedChildren = await tx[getPrismaModel(childModel)].findMany({
              where: { [fkField(model)]: id, deletedAt: { not: null } },
              includeDeleted: true,
              select: { id: true, deletedAt: true, deletedBy: true },
            })
            for (const child of deletedChildren) {
              // Recursively force delete children
              const childResult = await forceDelete(tx, childModel, child.id, userId, { cascade: true })
              cascadeCount += childResult.deletedCount + childResult.cascadeCount
              auditTrail.push(...childResult.auditTrail)
              errors.push(...childResult.errors)
            }
          }
        }
      }

      // Step 3: Record audit info before deletion
      const displayFields = DISPLAY_FIELDS_MAP[model] || []
      const titleParts = displayFields.map((f: string) => existing[f]).filter(Boolean).map(String).slice(0, 2)
      const displayTitle = titleParts.join(' — ') || existing.name || existing.title || existing.slug || id

      auditTrail.push({
        model,
        id,
        displayTitle,
        previousDeletedAt: existing.deletedAt,
        previousDeletedBy: existing.deletedBy,
      })

      // Step 4: Permanently delete
      await tx[getPrismaModel(model)].delete({ where: { id }, includeDeleted: true })
    }, {
      maxWait: 15000,
      timeout: 30000, // Longer timeout for cascade operations
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Force delete failed for ${model}/${id}: ${message}`)
  }

  // Invalidate cache after successful force delete
  const cacheTypes = getCacheTypesFromModel(model)
  if (cacheTypes.length > 0) {
    await invalidateMultipleCache(cacheTypes).catch(() => {})
  }

  return { success: true, deletedCount: 1, cascadeCount, errors, auditTrail }
}

// ─── Bulk Force Delete ───

export interface BulkForceDeleteOptions {
  /** Recursively delete all soft-deleted descendants (default: false) */
  cascade?: boolean
}

export interface BulkForceDeleteResult {
  success: boolean
  deletedCount: number
  cascadeCount: number
  failedCount: number
  errors: string[]
  /** Audit trail for each deleted record */
  auditTrail: Array<{
    model: string
    id: string
    displayTitle: string
    previousDeletedAt: Date | null
    previousDeletedBy: string | null
  }>
  /** Per-record results */
  results: Array<{
    id: string
    model: string
    success: boolean
    error?: string
    cascadeCount?: number
  }>
}

/**
 * Preview what would be deleted by a bulk force delete operation.
 * Merges previews from multiple records into a combined summary.
 */
export async function bulkPreviewForceDelete(
  db: AnyPrismaClient,
  items: Array<{ model: string; id: string }>,
  cascade: boolean = false
): Promise<{
  success: boolean
  records: Array<{ model: string; id: string; displayTitle: string }>
  combinedDependencies: Array<{ model: string; label: string; totalCount: number; activeCount: number; deletedCount: number }>
  totalRecords: number
  totalDeleted: number
  totalActive: number
  errors: string[]
}> {
  const records: Array<{ model: string; id: string; displayTitle: string }> = []
  const combinedDeps: Record<string, { model: string; label: string; totalCount: number; activeCount: number; deletedCount: number }> = {}
  const errors: string[] = []
  let totalActive = 0

  for (const item of items) {
    const preview = await previewForceDelete(db, item.model, item.id, cascade)
    if (!preview.success) {
      errors.push(...preview.errors)
      continue
    }
    if (preview.record) {
      records.push(preview.record)
    }
    // Merge dependencies
    for (const dep of preview.dependencies) {
      if (combinedDeps[dep.model]) {
        combinedDeps[dep.model].totalCount += dep.totalCount
        combinedDeps[dep.model].activeCount += dep.activeCount
        combinedDeps[dep.model].deletedCount += dep.deletedCount
      } else {
        combinedDeps[dep.model] = { ...dep }
      }
    }
    totalActive += preview.totalActive
  }

  const totalDeleted = Object.values(combinedDeps).reduce((sum, d) => sum + d.deletedCount, 0)

  return {
    success: errors.length === 0,
    records,
    combinedDependencies: Object.values(combinedDeps).filter(d => d.totalCount > 0),
    totalRecords: records.length,
    totalDeleted,
    totalActive,
    errors,
  }
}

/**
 * Bulk permanently delete multiple soft-deleted records in a SINGLE transaction.
 *
 * If ANY deletion fails, the ENTIRE batch rolls back.
 * This ensures atomicity — never partial delete.
 *
 * Modes:
 * - cascade=false: Blocks if ANY children exist
 * - cascade=true: Deletes only soft-deleted descendants, blocks if active children exist
 *
 * Performance:
 * - Deletes deepest descendants first (bottom-up)
 * - Batch dependency checks
 */
export async function bulkForceDelete(
  db: AnyPrismaClient,
  items: Array<{ model: string; id: string }>,
  userId: string,
  options: BulkForceDeleteOptions = {}
): Promise<BulkForceDeleteResult> {
  const { cascade = false } = options
  const errors: string[] = []
  const auditTrail: BulkForceDeleteResult['auditTrail'] = []
  const results: BulkForceDeleteResult['results'] = []
  let cascadeCount = 0

  if (items.length === 0) {
    return { success: true, deletedCount: 0, cascadeCount: 0, failedCount: 0, errors: [], auditTrail: [], results: [] }
  }

  try {
    await db.$transaction(async (tx: AnyPrismaClient) => {
      // Phase 1: Validate ALL records before deleting any
      const validatedItems: Array<{
        model: string
        id: string
        record: any
      }> = []

      for (const item of items) {
        if (!isSoftDeleteModel(item.model)) {
          throw new Error(`Model '${item.model}' does not support force delete`)
        }

        const existing = await tx[getPrismaModel(item.model)].findUnique({
          where: { id: item.id },
          includeDeleted: true,
        })
        if (!existing) {
          throw new Error(`Record not found: ${item.model}/${item.id}`)
        }
        if (!existing.deletedAt) {
          throw new Error(`Record must be soft-deleted first: ${item.model}/${item.id}`)
        }

        // Check dependencies
        const childModels = CASCADE_RULES[item.model] || []
        for (const childModel of childModels) {
          const [activeCount, deletedCount] = await Promise.all([
            tx[getPrismaModel(childModel)].count({ where: { [fkField(item.model)]: item.id, deletedAt: null } }),
            tx[getPrismaModel(childModel)].count({ where: { [fkField(item.model)]: item.id, deletedAt: { not: null } } }),
          ])

          if (!cascade) {
            if (activeCount + deletedCount > 0) {
              const label = MODEL_LABELS[childModel] || childModel
              throw new Error(
                `Cannot delete ${item.model}/${item.id}: ${activeCount + deletedCount} ${label} records reference it.`
              )
            }
          } else {
            if (activeCount > 0) {
              const label = MODEL_LABELS[childModel] || childModel
              throw new Error(
                `Cannot cascade delete ${item.model}/${item.id}: ${activeCount} active ${label} records exist.`
              )
            }
          }
        }

        validatedItems.push({ model: item.model, id: item.id, record: existing })
      }

      // Phase 2: Delete deepest descendants first, then parents
      // Sort by depth (deepest first) to avoid FK violations
      const depthMap: Record<string, number> = {
        classCategory: 0,
        subject: 1,
        chapter: 2,
        topic: 3,
        lecture: 3,
        mcq: 3,
        cq: 3,
        knowledgeQuestion: 3,
        suggestion: 3,
        resource: 4,
        course: 0,
        courseLesson: 1,
        blogCategory: 0,
        blogPost: 1,
      }
      validatedItems.sort((a, b) => (depthMap[b.model] || 0) - (depthMap[a.model] || 0))

      for (const item of validatedItems) {
        // Delete soft-deleted children first (if cascade)
        if (cascade) {
          const childModels = CASCADE_RULES[item.model] || []
          for (const childModel of childModels) {
            const deletedChildren = await tx[getPrismaModel(childModel)].findMany({
              where: { [fkField(item.model)]: item.id, deletedAt: { not: null } },
              includeDeleted: true,
              select: { id: true },
            })
            for (const child of deletedChildren) {
              const childResult = await forceDelete(tx, childModel, child.id, userId, { cascade: true })
              cascadeCount += childResult.deletedCount + childResult.cascadeCount
              auditTrail.push(...childResult.auditTrail)
              results.push({
                id: child.id,
                model: childModel,
                success: childResult.success,
                error: childResult.errors[0],
                cascadeCount: childResult.cascadeCount,
              })
              if (!childResult.success) {
                throw new Error(`Cascade delete failed: ${childResult.errors[0]}`)
              }
            }
          }
        }

        // Record audit info before deletion
        const displayFields = DISPLAY_FIELDS_MAP[item.model] || []
        const titleParts = displayFields.map((f: string) => item.record[f]).filter(Boolean).map(String).slice(0, 2)
        const displayTitle = titleParts.join(' — ') || item.record.name || item.record.title || item.record.slug || item.id

        auditTrail.push({
          model: item.model,
          id: item.id,
          displayTitle,
          previousDeletedAt: item.record.deletedAt,
          previousDeletedBy: item.record.deletedBy,
        })

        // Permanently delete
        await tx[getPrismaModel(item.model)].delete({ where: { id: item.id }, includeDeleted: true })

        results.push({
          id: item.id,
          model: item.model,
          success: true,
        })
      }
    }, {
      maxWait: 30000,
      timeout: 120000, // 2 minutes for large bulk operations
    })
  } catch (err) {
    // Transaction rolled back — all changes undone
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    errors.push(errorMsg)
    return {
      success: false,
      deletedCount: 0,
      cascadeCount: 0,
      failedCount: items.length,
      errors,
      auditTrail: [],
      results: items.map(item => ({
        id: item.id,
        model: item.model,
        success: false,
        error: errorMsg,
      })),
    }
  }

  const deletedCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  // Invalidate cache after successful bulk force delete
  if (deletedCount > 0) {
    const cacheTypes = getCacheTypesFromModels(items.map(i => i.model))
    if (cacheTypes.length > 0) {
      await invalidateMultipleCache(cacheTypes).catch(() => {})
    }
  }

  return {
    success: failedCount === 0,
    deletedCount,
    cascadeCount,
    failedCount,
    errors,
    auditTrail,
    results,
  }
}

// ─── Delete Impact Analyzer ───

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ImpactModel {
  model: string
  label: string
  activeCount: number
  deletedCount: number
  totalCount: number
}

export interface DeleteImpact {
  /** The record being analyzed */
  record: {
    model: string
    id: string
    displayTitle: string
    isDeleted: boolean
  }
  /** All affected models with counts */
  models: ImpactModel[]
  /** Direct children only */
  directChildren: ImpactModel[]
  /** Indirect descendants (grandchildren+) */
  indirectChildren: ImpactModel[]
  /** Total counts */
  totalActive: number
  totalDeleted: number
  totalRecords: number
  /** Risk classification */
  riskLevel: RiskLevel
  /** Whether deletion is blocked */
  blocked: boolean
  /** Reasons for blocking */
  blockReasons: string[]
  /** Whether cascade mode is needed */
  requiresCascade: boolean
  /** Error messages */
  errors: string[]
}

/**
 * Analyze the impact of deleting a record.
 *
 * Calculates:
 * - Direct children (depth 1)
 * - Indirect children (depth 2+)
 * - Active vs deleted breakdown
 * - Risk level classification
 * - Whether deletion is blocked
 *
 * Supports both single and bulk analysis.
 */
export async function analyzeDeleteImpact(
  db: AnyPrismaClient,
  model: string,
  id: string,
  options: { cascade?: boolean } = {}
): Promise<DeleteImpact> {
  const { cascade = false } = options
  const errors: string[] = []
  const models: ImpactModel[] = []
  const directChildren: ImpactModel[] = []
  const indirectChildren: ImpactModel[] = []
  let blocked = false
  const blockReasons: string[] = []
  let requiresCascade = false

  const emptyImpact: DeleteImpact = {
    record: { model, id, displayTitle: '', isDeleted: false },
    models: [], directChildren: [], indirectChildren: [],
    totalActive: 0, totalDeleted: 0, totalRecords: 0,
    riskLevel: 'LOW', blocked: false, blockReasons: [],
    requiresCascade: false, errors: [],
  }

  if (!isSoftDeleteModel(model)) {
    return { ...emptyImpact, errors: [`Model '${model}' does not support delete analysis`] }
  }

  try {
    // Fetch the record
    const existing = await db[getPrismaModel(model)].findUnique({
      where: { id },
      includeDeleted: true,
    })
    if (!existing) {
      return { ...emptyImpact, errors: [`Record not found: ${model}/${id}`] }
    }

    const isDeleted = !!existing.deletedAt
    const displayFields = DISPLAY_FIELDS_MAP[model] || []
    const titleParts = displayFields.map((f: string) => existing[f]).filter(Boolean).map(String).slice(0, 2)
    const displayTitle = titleParts.join(' — ') || existing.name || existing.title || existing.slug || id

    // Analyze direct children (depth 1)
    const childModels = CASCADE_RULES[model] || []
    for (const childModel of childModels) {
      const [activeCount, deletedCount] = await Promise.all([
        db[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: null } }),
        db[getPrismaModel(childModel)].count({ where: { [fkField(model)]: id, deletedAt: { not: null } } }),
      ])
      const label = MODEL_LABELS[childModel] || childModel
      const impact: ImpactModel = { model: childModel, label, activeCount, deletedCount, totalCount: activeCount + deletedCount }

      if (impact.totalCount > 0) {
        models.push(impact)
        directChildren.push(impact)
      }

      // Check if deletion is blocked
      if (activeCount > 0) {
        blocked = true
        blockReasons.push(`${activeCount} active ${label} records exist`)
      }
      if (deletedCount > 0 && !cascade) {
        blocked = true
        requiresCascade = true
        blockReasons.push(`${deletedCount} deleted ${label} records exist (use cascade mode)`)
      }
    }

    // Analyze indirect children (depth 2+) if cascade
    if (cascade) {
      for (const directChild of directChildren) {
        if (directChild.deletedCount === 0) continue

        // Find soft-deleted children of this direct child
        const deletedChildren = await db[getPrismaModel(directChild.model)].findMany({
          where: { [fkField(model)]: id, deletedAt: { not: null } },
          includeDeleted: true,
          select: { id: true },
        })

        // Check grandchildren of each deleted child
        const grandchildModels = CASCADE_RULES[directChild.model] || []
        for (const grandchildModel of grandchildModels) {
          const gcActiveCounts = await Promise.all(
            deletedChildren.map((child: { id: string }) =>
              db[getPrismaModel(grandchildModel)].count({ where: { [fkField(directChild.model)]: child.id, deletedAt: null } })
            )
          )
          const gcDeletedCounts = await Promise.all(
            deletedChildren.map((child: { id: string }) =>
              db[getPrismaModel(grandchildModel)].count({ where: { [fkField(directChild.model)]: child.id, deletedAt: { not: null } } })
            )
          )
          const totalGcActive = gcActiveCounts.reduce((a: number, b: number) => a + b, 0)
          const totalGcDeleted = gcDeletedCounts.reduce((a: number, b: number) => a + b, 0)

          if (totalGcActive + totalGcDeleted > 0) {
            const label = MODEL_LABELS[grandchildModel] || grandchildModel
            const existing = indirectChildren.find(m => m.model === grandchildModel)
            if (existing) {
              existing.activeCount += totalGcActive
              existing.deletedCount += totalGcDeleted
              existing.totalCount += totalGcActive + totalGcDeleted
            } else {
              indirectChildren.push({
                model: grandchildModel, label,
                activeCount: totalGcActive, deletedCount: totalGcDeleted,
                totalCount: totalGcActive + totalGcDeleted,
              })
            }

            if (totalGcActive > 0) {
              blocked = true
              blockReasons.push(`${totalGcActive} active ${label} records exist (grandchildren)`)
            }
          }
        }

        // Add indirect children to main models list
        for (const indirect of indirectChildren) {
          if (!models.find(m => m.model === indirect.model)) {
            models.push(indirect)
          }
        }
      }
    }

    const totalActive = models.reduce((sum, m) => sum + m.activeCount, 0) +
                        indirectChildren.reduce((sum, m) => sum + m.activeCount, 0)
    const totalDeleted = models.reduce((sum, m) => sum + m.deletedCount, 0) +
                         indirectChildren.reduce((sum, m) => sum + m.deletedCount, 0)
    const totalRecords = totalActive + totalDeleted

    // Risk classification
    const riskLevel = classifyRisk(totalRecords)

    return {
      record: { model, id, displayTitle, isDeleted },
      models,
      directChildren,
      indirectChildren,
      totalActive,
      totalDeleted,
      totalRecords,
      riskLevel,
      blocked,
      blockReasons,
      requiresCascade,
      errors,
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Unknown error')
    return { ...emptyImpact, errors }
  }
}

/**
 * Analyze impact for multiple records (bulk delete).
 * Merges results into a combined summary.
 */
export async function analyzeBulkDeleteImpact(
  db: AnyPrismaClient,
  items: Array<{ model: string; id: string }>,
  options: { cascade?: boolean } = {}
): Promise<{
  success: boolean
  records: DeleteImpact['record'][]
  combinedModels: ImpactModel[]
  combinedDirectChildren: ImpactModel[]
  combinedIndirectChildren: ImpactModel[]
  totalActive: number
  totalDeleted: number
  totalRecords: number
  riskLevel: RiskLevel
  blocked: boolean
  blockReasons: string[]
  requiresCascade: boolean
  errors: string[]
}> {
  const allRecords: Array<DeleteImpact['record']> = []
  const combinedModels: Record<string, ImpactModel> = {}
  const combinedDirect: Record<string, ImpactModel> = {}
  const combinedIndirect: Record<string, ImpactModel> = {}
  const allBlockReasons: string[] = []
  let anyBlocked = false
  let anyRequiresCascade = false
  const errors: string[] = []

  for (const item of items) {
    const impact = await analyzeDeleteImpact(db, item.model, item.id, options)
    if (impact.errors.length > 0) {
      errors.push(...impact.errors)
      continue
    }

    allRecords.push(impact.record)

    // Merge models
    for (const m of impact.models) {
      if (combinedModels[m.model]) {
        combinedModels[m.model].activeCount += m.activeCount
        combinedModels[m.model].deletedCount += m.deletedCount
        combinedModels[m.model].totalCount += m.totalCount
      } else {
        combinedModels[m.model] = { ...m }
      }
    }

    // Merge direct children
    for (const m of impact.directChildren) {
      if (combinedDirect[m.model]) {
        combinedDirect[m.model].activeCount += m.activeCount
        combinedDirect[m.model].deletedCount += m.deletedCount
        combinedDirect[m.model].totalCount += m.totalCount
      } else {
        combinedDirect[m.model] = { ...m }
      }
    }

    // Merge indirect children
    for (const m of impact.indirectChildren) {
      if (combinedIndirect[m.model]) {
        combinedIndirect[m.model].activeCount += m.activeCount
        combinedIndirect[m.model].deletedCount += m.deletedCount
        combinedIndirect[m.model].totalCount += m.totalCount
      } else {
        combinedIndirect[m.model] = { ...m }
      }
    }

    if (impact.blocked) anyBlocked = true
    if (impact.requiresCascade) anyRequiresCascade = true
    allBlockReasons.push(...impact.blockReasons)
  }

  const totalActive = Object.values(combinedModels).reduce((sum, m) => sum + m.activeCount, 0)
  const totalDeleted = Object.values(combinedModels).reduce((sum, m) => sum + m.deletedCount, 0)

  return {
    success: errors.length === 0,
    records: allRecords,
    combinedModels: Object.values(combinedModels).sort((a, b) => b.totalCount - a.totalCount),
    combinedDirectChildren: Object.values(combinedDirect).sort((a, b) => b.totalCount - a.totalCount),
    combinedIndirectChildren: Object.values(combinedIndirect).sort((a, b) => b.totalCount - a.totalCount),
    totalActive,
    totalDeleted,
    totalRecords: totalActive + totalDeleted,
    riskLevel: classifyRisk(totalActive + totalDeleted),
    blocked: anyBlocked,
    blockReasons: [...new Set(allBlockReasons)],
    requiresCascade: anyRequiresCascade,
    errors,
  }
}

/**
 * Classify risk level based on total record count.
 */
function classifyRisk(total: number): RiskLevel {
  if (total > 10000) return 'CRITICAL'
  if (total > 1000) return 'HIGH'
  if (total > 100) return 'MEDIUM'
  return 'LOW'
}

// ─── Helper: Check Parent Active ───

const PARENT_MAP: Record<string, { field: string; model: string }> = {
  subject: { field: 'classId', model: 'classCategory' },
  chapter: { field: 'subjectId', model: 'subject' },
  topic: { field: 'chapterId', model: 'chapter' },
  lecture: { field: 'chapterId', model: 'chapter' },
  mcq: { field: 'chapterId', model: 'chapter' },
  cq: { field: 'chapterId', model: 'chapter' },
  knowledgeQuestion: { field: 'chapterId', model: 'chapter' },
  suggestion: { field: 'chapterId', model: 'chapter' },
  resource: { field: 'lectureId', model: 'lecture' },
  courseLesson: { field: 'courseId', model: 'course' },
  blogPost: { field: 'categoryId', model: 'blogCategory' },
}

async function checkParentActive(
  tx: any,
  model: string,
  record: any
): Promise<{ ok: boolean; error?: string }> {
  const parentInfo = PARENT_MAP[model]
  if (!parentInfo) return { ok: true }

  const parentId = record[parentInfo.field]
  if (!parentId) return { ok: true }

      const parent = await tx[getPrismaModel(parentInfo.model)].findUnique({ where: { id: parentId } })
  if (!parent) return { ok: true } // Parent doesn't exist — allow restore
  if (parent.deletedAt) {
    return {
      ok: false,
      error: `Parent ${parentInfo.model} is deleted. Restore it first.`,
    }
  }

  return { ok: true }
}
