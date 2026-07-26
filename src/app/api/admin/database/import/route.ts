import { apiError, withCsrf, applyRateLimit, withSuperAdmin } from '@/lib/api-utils'
import { auditFromRequest } from '@/lib/audit'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import logger from '@/lib/logger'
import { apiLimiter } from '@/lib/rate-limit'

import { NextRequest,NextResponse } from 'next/server'

const DELETE_ORDER = [
  'bundleItem', 'contentBundle', 'contentPackage',
  'notification', 'recentlyViewed', 'note', 'bookmark', 'progress',
  'examResult', 'examQuestion', 'exam',
  'payment', 'suggestion', 'notice', 'testimonial', 'faq', 'banner', 'siteSetting',
  'cQ', 'mCQ', 'resource', 'lecture',
  'chapter', 'subject', 'classCategory',
  'board', 'examYear',
  'user',
]

const IMPORT_ORDER = [
  'user', 'board', 'examYear',
  'classCategory', 'subject', 'chapter',
  'lecture', 'resource', 'mCQ', 'cQ',
  'siteSetting', 'banner', 'faq', 'testimonial', 'notice', 'suggestion', 'payment',
  'exam', 'examQuestion', 'examResult',
  'progress', 'bookmark', 'note', 'recentlyViewed', 'notification',
  'contentPackage', 'contentBundle', 'bundleItem',
]

const modelMap: Record<string, any> = {
  user: db.user,
  board: db.board,
  examYear: db.examYear,
  classCategory: db.classCategory,
  subject: db.subject,
  chapter: db.chapter,
  lecture: db.lecture,
  resource: db.resource,
  mCQ: db.mCQ,
  cQ: db.cQ,
  siteSetting: db.siteSetting,
  banner: db.banner,
  faq: db.fAQ,
  testimonial: db.testimonial,
  notice: db.notice,
  suggestion: db.suggestion,
  payment: db.payment,
  exam: db.exam,
  examQuestion: db.examQuestion,
  examResult: db.examResult,
  progress: db.progress,
  bookmark: db.bookmark,
  note: db.note,
  recentlyViewed: db.recentlyViewed,
  notification: db.notification,
  contentPackage: db.contentPackage,
  contentBundle: db.contentBundle,
  bundleItem: db.bundleItem,
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withSuperAdmin(request)
    if (auth instanceof NextResponse) return auth

    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const confirmHeader = request.headers.get('x-confirm-import')
    if (confirmHeader !== 'true') {
      return apiError('ইমপোর্ট নিশ্চিত করতে x-confirm-import: true হেডার প্রয়োজন।', 400, 'CONFIRMATION_REQUIRED')
    }

    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const body = await request.json()
    const { data } = body

    if (!data || typeof data !== 'object') {
      return apiError('ইমপোর্ট ডাটা পাওয়া যায়নি', 400)
    }

    // Validate data structure: each model key must map to an array
    for (const modelName of IMPORT_ORDER) {
      const records = (data as Record<string, unknown>)[modelName]
      if (records !== undefined && records !== null) {
        if (!Array.isArray(records)) {
          return apiError(`অবৈধ ডাটা ফরম্যাট: ${modelName} একটি অ্যারে হতে হবে`, 400, 'INVALID_DATA_FORMAT')
        }
        // Validate each record is a plain object
        for (let i = 0; i < records.length; i++) {
          if (typeof records[i] !== 'object' || records[i] === null || Array.isArray(records[i])) {
            return apiError(`অবৈধ রেকর্ড: ${modelName}[${i}] একটি অবজেক্ট হতে হবে`, 400, 'INVALID_RECORD_FORMAT')
          }
        }
      }
    }

    // Count total records for pre-flight check
    let totalRecords = 0
    for (const modelName of IMPORT_ORDER) {
      const records = (data as Record<string, unknown[]>)[modelName]
      if (Array.isArray(records)) {
        totalRecords += records.length
      }
    }

    if (totalRecords === 0) {
      return apiError('ইমপোর্ট করার জন্য কোনো রেকর্ড নেই', 400)
    }

    await auditFromRequest(request, auth.user.id, 'database_import', 'database', 'full_import', undefined, {
      timestamp: new Date().toISOString(),
      totalRecords,
    })

    // Execute entire delete+import in a single transaction
    // If ANY record fails, EVERYTHING rolls back — zero partial data
    const results = await db.$transaction(async (tx) => {
      // Step 1: Delete all existing data in reverse dependency order
      for (const modelName of DELETE_ORDER) {
        const model = (tx as any)[modelName] || modelMap[modelName]
        if (model) {
          await model.deleteMany()
        }
      }

      // Step 2: Import in dependency order — any failure triggers full rollback
      const importResults: Record<string, { imported: number; errors: number; errorMessages: string[] }> = {}

      for (const modelName of IMPORT_ORDER) {
        const model = (tx as any)[modelName] || modelMap[modelName]
        const records = (data as Record<string, Record<string, unknown>[]>)[modelName]

        if (!model || !records || !Array.isArray(records)) {
          importResults[modelName] = { imported: 0, errors: 0, errorMessages: [] }
          continue
        }

        let imported = 0
        let errors = 0
        const errorMessages: string[] = []

        for (let i = 0; i < records.length; i++) {
          try {
            await model.create({ data: records[i] })
            imported++
          } catch (err) {
            errors++
            const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি'
            errorMessages.push(`${modelName}[${i}]: ${msg}`)
            // Any error inside the transaction causes automatic rollback
            throw new Error(`Import failed at ${modelName}[${i}]: ${msg}`)
          }
        }

        importResults[modelName] = { imported, errors, errorMessages }
      }

      // Step 3: Preserve the importing admin's super admin access
      const currentUser = await tx.user.findUnique({ where: { id: auth.user.id } })
      if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
        await tx.user.update({
          where: { id: currentUser.id },
          data: { role: 'SUPER_ADMIN' },
        })
      }

      return importResults
    }, {
      maxWait: 30000,   // 30s to acquire connection
      timeout: 300000,  // 5min for the entire import transaction
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'ডাটাবেজ ইমপোর্ট সম্পন্ন হয়েছে',
        totalRecords,
        results,
      },
    })
  } catch (error) {
    logger.error('Database import error', error, { route: 'admin/database/import' })
    return handleApiError(error, 'Database import error')
  }
}
