import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf, parsePaginationParams, applyRateLimit } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'
import { createAuditLog, auditFromRequest, AuditActions, getClientIP } from '@/lib/audit'
import { restore, bulkRestore, forceDelete, bulkForceDelete, previewForceDelete, bulkPreviewForceDelete, SOFT_DELETE_MODELS, getPrismaModel, MODEL_LABELS, DISPLAY_FIELDS_MAP } from '@/lib/soft-delete'
import { NextResponse } from 'next/server'

// GET: List all soft-deleted records across all Category A models
export async function GET(request: Request) {
  // Rate limiting for trash listing
  const rateCheck = await applyRateLimit(apiLimiter, request)
  if ('error' in rateCheck) return rateCheck.error

  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const { page, limit } = parsePaginationParams(searchParams)
    const model = searchParams.get('model') // Filter by content type
    const deletedBy = searchParams.get('deletedBy') // Filter by who deleted
    const search = searchParams.get('q') // Search in display fields
    const sortBy = searchParams.get('sortBy') || 'deletedAt' // deletedAt, deletedBy
    const sortDir = searchParams.get('sortDir') || 'desc'

    // Collect all soft-deleted records across models
    const allItems: Array<{
      id: string
      model: string
      modelLabel: string
      displayTitle: string
      deletedAt: Date | null
      deletedBy: string | null
      deleteReason: string | null
      extra: Record<string, unknown>
    }> = []

    const modelsToQuery = model
      ? [model]
      : Array.from(SOFT_DELETE_MODELS)

    // Parallel fetch across all models
    const results = await Promise.allSettled(
      modelsToQuery.map(async (modelName) => {
        const label = MODEL_LABELS[modelName] || modelName
        const displayFields = DISPLAY_FIELDS_MAP[modelName] || []

        const where: Record<string, unknown> = {
          deletedAt: { not: null },
        }

        if (deletedBy) {
          where.deletedBy = deletedBy
        }

        // Search in display fields
        if (search && displayFields.length > 0) {
          where.OR = displayFields.map((field: string) => ({
            [field]: { contains: search, mode: 'insensitive' },
          }))
        }

        const records = await (db as any)[getPrismaModel(modelName)].findMany({
          where,
          includeDeleted: true,
          orderBy: { deletedAt: sortDir as 'asc' | 'desc' },
          take: 200, // Cap per model to prevent OOM
        })

        const items: Array<{
          id: string
          model: string
          modelLabel: string
          displayTitle: string
          deletedAt: Date | null
          deletedBy: string | null
          deleteReason: string | null
          extra: Record<string, unknown>
        }> = []

        for (const record of records) {
          // Build display title from display fields
          const titleParts = displayFields
            .map((f: string) => record[f])
            .filter(Boolean)
            .map(String)
            .slice(0, 2)
          const displayTitle = titleParts.join(' — ') || record.id

          items.push({
            id: record.id,
            model: modelName,
            modelLabel: label,
            displayTitle,
            deletedAt: record.deletedAt,
            deletedBy: record.deletedBy,
            deleteReason: record.deleteReason,
            extra: record,
          })
        }

        return items
      })
    )

    // Merge results from all parallel queries
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value)
      }
      // Rejected models are silently skipped
    }

    // Sort
    allItems.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] || ''
      const bVal = b[sortBy as keyof typeof b] || ''
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })

    // Paginate
    const total = allItems.length
    const start = (page - 1) * limit
    const items = allItems.slice(start, start + limit)

    // Get unique deletedBy users for filter
    const deletedByUsers = [...new Set(allItems.map(i => i.deletedBy).filter(Boolean))]

    // Get model counts for dashboard stats
    const modelCounts: Record<string, number> = {}
    for (const item of allItems) {
      modelCounts[item.model] = (modelCounts[item.model] || 0) + 1
    }

    return apiResponse({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        models: Object.entries(MODEL_LABELS)
          .map(([key, label]) => ({ value: key, label, count: modelCounts[key] || 0 }))
          .filter(m => m.count > 0)
          .sort((a, b) => b.count - a.count),
        deletedByUsers,
      },
      stats: {
        total,
        byModel: modelCounts,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Admin Trash GET')
  }
}

// POST: Restore or force-delete soft-deleted records
export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const { action, ids, model, cascade } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return apiError('অ্যাকশন এবং আইডি আবশ্যক', 400)
    }

    if (action === 'restore') {
      const startTime = Date.now()

      // Resolve models for all IDs
      const items: Array<{ model: string; id: string }> = []
      const unresolvedIds: string[] = []

      for (const id of ids) {
        let resolvedModel = model
        if (!resolvedModel) {
          for (const modelName of SOFT_DELETE_MODELS) {
            try {
              const record = await (db as any)[getPrismaModel(modelName)].findUnique({
                where: { id },
                includeDeleted: true,
              })
              if (record && record.deletedAt) {
                resolvedModel = modelName
                break
              }
            } catch {
              continue
            }
          }
        }

        if (resolvedModel) {
          items.push({ model: resolvedModel, id })
        } else {
          unresolvedIds.push(id)
        }
      }

      // Use atomic bulk restore for all resolved items
      const bulkResult = await bulkRestore(db, items, auth.user.id, {
        cascade: cascade === true,
      })

      // Add unresolved IDs as failures
      for (const id of unresolvedIds) {
        bulkResult.results.push({
          id,
          model: 'unknown',
          success: false,
          error: 'মডেল খুঁজে পাওয়া যায়নি',
        })
      }

      const duration = Date.now() - startTime
      const totalFailed = bulkResult.failedCount + unresolvedIds.length

      // Comprehensive audit logging for bulk restore operation
      await db.$transaction(async (tx) => {
        await createAuditLog({
          adminId: auth.user.id,
          action: 'bulk_restore',
          entityType: 'trash',
          entityId: `bulk-${Date.now()}`,
          oldData: {
            totalSelected: ids.length,
            totalRestored: bulkResult.restoredCount,
            cascadeMode: cascade ? 'cascade' : 'single',
            startedAt: new Date(startTime).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: duration,
            models: [...new Set(items.map(i => i.model))],
          },
          newData: {
            restored: bulkResult.restoredCount,
            cascadeRestored: bulkResult.cascadeCount,
            failed: totalFailed,
          },
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || undefined,
          tx: tx as never,
        })

        // Individual audit entries for each restored record
        for (const entry of bulkResult.auditTrail) {
          await createAuditLog({
            adminId: auth.user.id,
            action: 'restore',
            entityType: entry.model,
            entityId: entry.id,
            oldData: {
              deletedAt: entry.previousDeletedAt,
              deletedBy: entry.previousDeletedBy,
              slugChanged: entry.slugChanged,
              restoreMode: cascade ? 'cascade' : 'single',
            },
            newData: {
              deletedAt: null,
              deletedBy: null,
              restoredBy: auth.user.id,
              restoredAt: new Date().toISOString(),
            },
            ipAddress: getClientIP(request),
            userAgent: request.headers.get('user-agent') || undefined,
            tx: tx as never,
          })
        }
      })

      return apiResponse({
        restored: bulkResult.restoredCount,
        cascadeRestored: bulkResult.cascadeCount,
        failed: totalFailed,
        duration,
        results: bulkResult.results,
      }, bulkResult.restoredCount > 0
        ? `${bulkResult.restoredCount}টি রেকর্ড পুনরুদ্ধার করা হয়েছে${bulkResult.cascadeCount > 0 ? ` (${bulkResult.cascadeCount}টি চাইল্ড সহ)` : ''}`
        : bulkResult.errors[0] || 'কোনো রেকর্ড পুনরুদ্ধার হয়নি')
    }

    if (action === 'previewForceDelete') {
      // Resolve models for all IDs
      const items: Array<{ model: string; id: string }> = []
      const unresolvedIds: string[] = []

      for (const id of ids) {
        let resolvedModel = model
        if (!resolvedModel) {
          for (const modelName of SOFT_DELETE_MODELS) {
            try {
              const record = await (db as any)[getPrismaModel(modelName)].findUnique({
                where: { id },
                includeDeleted: true,
              })
              if (record && record.deletedAt) {
                resolvedModel = modelName
                break
              }
            } catch {
              continue
            }
          }
        }

        if (resolvedModel) {
          items.push({ model: resolvedModel, id })
        } else {
          unresolvedIds.push(id)
        }
      }

      // Use combined preview for multiple records
      if (items.length > 1) {
        const preview = await bulkPreviewForceDelete(db, items, cascade === true)
        // Add unresolved as errors
        for (const id of unresolvedIds) {
          preview.errors.push(`মডেল খুঁজে পাওয়া যায়নি: ${id}`)
        }
        return apiResponse(preview)
      }

      // Single record preview
      if (items.length === 1) {
        const preview = await previewForceDelete(db, items[0].model, items[0].id, cascade === true)
        return apiResponse(preview)
      }

      return apiError('কোনো রেকর্ড নির্বাচিত হয়নি', 400)
    }

    if (action === 'forceDelete') {
      const startTime = Date.now()

      // Resolve models for all IDs
      const items: Array<{ model: string; id: string }> = []
      const unresolvedIds: string[] = []

      for (const id of ids) {
        let resolvedModel = model
        if (!resolvedModel) {
          for (const modelName of SOFT_DELETE_MODELS) {
            try {
              const record = await (db as any)[getPrismaModel(modelName)].findUnique({
                where: { id },
                includeDeleted: true,
              })
              if (record && record.deletedAt) {
                resolvedModel = modelName
                break
              }
            } catch {
              continue
            }
          }
        }

        if (resolvedModel) {
          items.push({ model: resolvedModel, id })
        } else {
          unresolvedIds.push(id)
        }
      }

      // Use atomic bulk force delete
      const bulkResult = await bulkForceDelete(db, items, auth.user.id, {
        cascade: cascade === true,
      })

      // Add unresolved IDs as failures
      for (const id of unresolvedIds) {
        bulkResult.results.push({
          id,
          model: 'unknown',
          success: false,
          error: 'মডেল খুঁজে পাওয়া যায়নি',
        })
      }

      const duration = Date.now() - startTime
      const totalFailed = bulkResult.failedCount + unresolvedIds.length

      // Comprehensive audit logging for bulk force delete operation
      await db.$transaction(async (tx) => {
        await createAuditLog({
          adminId: auth.user.id,
          action: 'bulk_force_delete',
          entityType: 'trash',
          entityId: `bulk-fd-${Date.now()}`,
          oldData: {
            totalSelected: ids.length,
            totalDeleted: bulkResult.deletedCount,
            cascadeMode: cascade ? 'cascade' : 'single',
            startedAt: new Date(startTime).toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: duration,
            models: [...new Set(items.map(i => i.model))],
          },
          newData: undefined, // Records no longer exist
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || undefined,
          tx: tx as never,
        })

        // Individual audit entries for each deleted record
        for (const entry of bulkResult.auditTrail) {
          await createAuditLog({
            adminId: auth.user.id,
            action: 'force_delete',
            entityType: entry.model,
            entityId: entry.id,
            oldData: {
              displayTitle: entry.displayTitle,
              deletedAt: entry.previousDeletedAt,
              deletedBy: entry.previousDeletedBy,
              forceDeletedBy: auth.user.id,
              forceDeletedAt: new Date().toISOString(),
              cascadeMode: cascade ? 'cascade' : 'single',
            },
            newData: undefined,
            ipAddress: getClientIP(request),
            userAgent: request.headers.get('user-agent') || undefined,
            tx: tx as never,
          })
        }
      })

      return apiResponse({
        deleted: bulkResult.deletedCount,
        cascadeDeleted: bulkResult.cascadeCount,
        failed: totalFailed,
        duration,
        results: bulkResult.results,
      }, bulkResult.deletedCount > 0
        ? `${bulkResult.deletedCount}টি রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে${bulkResult.cascadeCount > 0 ? ` (${bulkResult.cascadeCount}টি চাইল্ড সহ)` : ''}`
        : bulkResult.errors[0] || 'কোনো রেকর্ড মুছে ফেলা হয়নি')
    }

    return apiError('অবৈধ অ্যাকশন', 400)
  } catch (error) {
    return handleApiError(error, 'Admin Trash POST')
  }
}

