/**
 * Trash Retention & Auto Cleanup Service
 *
 * Automatically cleans old soft-deleted records based on configurable retention period.
 * Supports dry run, batch processing, and comprehensive audit logging.
 *
 * Usage:
 *   import { runTrashCleanup, previewTrashCleanup, getTrashRetentionSettings } from '@/lib/trash-cleanup'
 *   const result = await runTrashCleanup(db, userId, { dryRun: false })
 */

import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { SOFT_DELETE_MODELS, bulkForceDelete, getPrismaModel, MODEL_LABELS } from '@/lib/soft-delete'

// ─── Settings Keys ───

export const TRASH_SETTINGS = {
  RETENTION_DAYS: 'trashRetentionDays',
  ENABLE_CLEANUP: 'trashCleanupEnabled',
  LAST_CLEANUP: 'trashLastCleanup',
  NEXT_CLEANUP: 'trashNextCleanup',
  LAST_CLEANUP_COUNT: 'trashLastCleanupCount',
  BATCH_SIZE: 'trashCleanupBatchSize',
} as const

// ─── Default Values ───

const DEFAULTS = {
  retentionDays: 90,
  enabled: true,
  batchSize: 500,
}

// ─── Settings Helpers ───

export async function getTrashRetentionSettings(): Promise<{
  retentionDays: number
  enabled: boolean
  lastCleanup: string | null
  nextCleanup: string | null
  lastCleanupCount: number
  batchSize: number
}> {
  const settings = await db.siteSetting.findMany({
    where: {
      key: {
        in: Object.values(TRASH_SETTINGS),
      },
    },
  })

  const map = new Map(settings.map(s => [s.key, s.value]))

  return {
    retentionDays: parseInt(map.get(TRASH_SETTINGS.RETENTION_DAYS) || String(DEFAULTS.retentionDays), 10),
    enabled: map.get(TRASH_SETTINGS.ENABLE_CLEANUP) !== 'false',
    lastCleanup: map.get(TRASH_SETTINGS.LAST_CLEANUP) || null,
    nextCleanup: map.get(TRASH_SETTINGS.NEXT_CLEANUP) || null,
    lastCleanupCount: parseInt(map.get(TRASH_SETTINGS.LAST_CLEANUP_COUNT) || '0', 10),
    batchSize: parseInt(map.get(TRASH_SETTINGS.BATCH_SIZE) || String(DEFAULTS.batchSize), 10),
  }
}

export async function updateTrashSettings(updates: Record<string, string>): Promise<void> {
  const upserts = Object.entries(updates).map(([key, value]) =>
    db.siteSetting.upsert({
      where: { key },
      create: { key, value, group: 'trash', label: getSettingLabel(key) },
      update: { value },
    })
  )
  await Promise.all(upserts)
}

function getSettingLabel(key: string): string {
  const labels: Record<string, string> = {
    [TRASH_SETTINGS.RETENTION_DAYS]: 'ট্র্যাশ মেয়াদ (দিন)',
    [TRASH_SETTINGS.ENABLE_CLEANUP]: 'স্বয়ংক্রিয় পরিষ্কার সক্রিয়',
    [TRASH_SETTINGS.LAST_CLEANUP]: 'শেষ পরিষ্কার',
    [TRASH_SETTINGS.NEXT_CLEANUP]: 'পরবর্তী পরিষ্কার',
    [TRASH_SETTINGS.LAST_CLEANUP_COUNT]: 'শেষ পরিষ্কারের গণনা',
    [TRASH_SETTINGS.BATCH_SIZE]: 'ব্যাচ সাইজ',
  }
  return labels[key] || key
}

// ─── Preview (Dry Run) ───

export interface CleanupPreview {
  retentionDays: number
  cutoffDate: Date
  models: Array<{
    model: string
    label: string
    count: number
  }>
  totalRecords: number
}

export async function previewTrashCleanup(retentionDays: number): Promise<CleanupPreview> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const models: CleanupPreview['models'] = []

  for (const modelName of SOFT_DELETE_MODELS) {
    try {
      const count = await (db as any)[getPrismaModel(modelName)].count({
        where: {
          deletedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
        includeDeleted: true,
      })

      if (count > 0) {
        const label = MODEL_LABELS[modelName] || modelName
        models.push({ model: modelName, label, count })
      }
    } catch {
      // Model might not exist in DB, skip
    }
  }

  const totalRecords = models.reduce((sum, m) => sum + m.count, 0)

  return {
    retentionDays,
    cutoffDate,
    models: models.sort((a, b) => b.count - a.count),
    totalRecords,
  }
}

// ─── Cleanup Execution ───

export interface CleanupOptions {
  /** Run in preview mode without actually deleting (default: false) */
  dryRun?: boolean
  /** Batch size for processing (default: from settings) */
  batchSize?: number
  /** Cascade mode for force delete (default: true) */
  cascade?: boolean
  /** User ID for audit logging (null = system/automatic) */
  userId?: string | null
  /** Trigger type for audit logging */
  trigger?: 'manual' | 'automatic' | 'scheduled'
}

export interface CleanupResult {
  success: boolean
  retentionDays: number
  cutoffDate: Date
  totalDeleted: number
  totalFailed: number
  batchCount: number
  duration: number
  dryRun: boolean
  preview: CleanupPreview
  errors: string[]
  auditId: string
}

export async function runTrashCleanup(
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const {
    dryRun = false,
    batchSize = DEFAULTS.batchSize,
    cascade = true,
    userId = null,
    trigger = 'manual',
  } = options

  const startTime = Date.now()

  // Get retention settings
  const settings = await getTrashRetentionSettings()
  const retentionDays = options.batchSize !== undefined ? settings.retentionDays : settings.retentionDays

  // Preview what would be deleted
  const preview = await previewTrashCleanup(retentionDays)

  if (preview.totalRecords === 0) {
    const auditId = `cleanup-${Date.now()}`
    await createAuditLog({
      adminId: userId || 'system',
      action: 'trash_cleanup',
      entityType: 'trash',
      entityId: auditId,
      oldData: {
        retentionDays,
        cutoffDate: preview.cutoffDate.toISOString(),
        trigger,
        dryRun,
        totalRecords: 0,
        message: 'No records to clean up',
      },
      newData: {
        totalDeleted: 0,
        duration: Date.now() - startTime,
      },
    })

    return {
      success: true,
      retentionDays,
      cutoffDate: preview.cutoffDate,
      totalDeleted: 0,
      totalFailed: 0,
      batchCount: 0,
      duration: Date.now() - startTime,
      dryRun,
      preview,
      errors: [],
      auditId,
    }
  }

  // Dry run — return preview without deleting
  if (dryRun) {
    const auditId = `cleanup-preview-${Date.now()}`
    await createAuditLog({
      adminId: userId || 'system',
      action: 'trash_cleanup_preview',
      entityType: 'trash',
      entityId: auditId,
      oldData: {
        retentionDays,
        cutoffDate: preview.cutoffDate.toISOString(),
        trigger,
        totalRecords: preview.totalRecords,
        models: preview.models.map(m => `${m.label}: ${m.count}`),
      },
    })

    return {
      success: true,
      retentionDays,
      cutoffDate: preview.cutoffDate,
      totalDeleted: 0,
      totalFailed: 0,
      batchCount: 0,
      duration: Date.now() - startTime,
      dryRun: true,
      preview,
      errors: [],
      auditId,
    }
  }

  // Execute cleanup in batches
  const auditId = `cleanup-${Date.now()}`
  let totalDeleted = 0
  let totalFailed = 0
  let batchCount = 0
  const errors: string[] = []

  // Collect all records to delete across all models
  const allItems: Array<{ model: string; id: string }> = []

  for (const modelName of SOFT_DELETE_MODELS) {
    try {
      const records = await (db as any)[getPrismaModel(modelName)].findMany({
        where: {
          deletedAt: {
            not: null,
            lt: preview.cutoffDate,
          },
        },
        includeDeleted: true,
        select: { id: true },
        take: 10000, // Safety limit per model
      })

      for (const record of records) {
        allItems.push({ model: modelName, id: record.id })
      }
    } catch {
      // Model might not exist, skip
    }
  }

  // Process in batches
  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize)
    batchCount++

    try {
      const result = await bulkForceDelete(db, batch, userId || 'system', { cascade })
      totalDeleted += result.deletedCount
      totalFailed += result.failedCount
      errors.push(...result.errors)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Batch failed'
      errors.push(`Batch ${batchCount}: ${errorMsg}`)
      totalFailed += batch.length
    }
  }

  const duration = Date.now() - startTime

  // Update settings with cleanup metadata
  const now = new Date()
  const nextCleanup = new Date(now)
  nextCleanup.setDate(nextCleanup.getDate() + 1) // Next cleanup tomorrow

  await updateTrashSettings({
    [TRASH_SETTINGS.LAST_CLEANUP]: now.toISOString(),
    [TRASH_SETTINGS.NEXT_CLEANUP]: nextCleanup.toISOString(),
    [TRASH_SETTINGS.LAST_CLEANUP_COUNT]: String(totalDeleted),
  })

  // Create comprehensive audit log
  await createAuditLog({
    adminId: userId || 'system',
    action: 'trash_cleanup',
    entityType: 'trash',
    entityId: auditId,
    oldData: {
      retentionDays,
      cutoffDate: preview.cutoffDate.toISOString(),
      trigger,
      dryRun: false,
      totalRecords: preview.totalRecords,
      models: preview.models.map(m => `${m.label}: ${m.count}`),
      startedAt: new Date(startTime).toISOString(),
    },
    newData: {
      totalDeleted,
      totalFailed,
      batchCount,
      duration,
      finishedAt: now.toISOString(),
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Cap error list
    },
  })

  return {
    success: totalFailed === 0,
    retentionDays,
    cutoffDate: preview.cutoffDate,
    totalDeleted,
    totalFailed,
    batchCount,
    duration,
    dryRun: false,
    preview,
    errors,
    auditId,
  }
}

