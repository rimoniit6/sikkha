import { db } from '@/lib/db'
import { apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { getContentTypeLabels } from '@/lib/content-type-labels'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType')
    const isActiveParam = searchParams.get('isActive')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Build where clause — only approved payments (these are "purchases")
    const where: Record<string, unknown> = {
      status: 'APPROVED',
      contentType: { not: null }, // Only payments that have a content type
    }

    if (contentType) where.contentType = contentType
    if (isActiveParam !== null && isActiveParam !== '') where.isActive = isActiveParam === 'true'
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { id: { contains: search, mode: 'insensitive' } } },
        { contentTitle: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    // Compute stats (filtered)
    const [totalPurchases, activePurchases, inactivePurchases] = await Promise.all([
      db.payment.count({ where }),
      db.payment.count({ where: { ...where, isActive: true } }),
      db.payment.count({ where: { ...where, isActive: false } }),
    ])

    // Get dynamic content types from DB for filters
    const contentTypeLabels = await getContentTypeLabels()

    // Get per-type purchase counts for stats
    const allApprovedPayments = await db.payment.findMany({
      where: {
        status: 'APPROVED',
        contentType: { not: null },
        ...(isActiveParam !== null && isActiveParam !== '' ? { isActive: isActiveParam === 'true' } : {}),
        ...(contentType ? { contentType } : {}),
      },
      select: { contentType: true, isActive: true },
    })

    const typeStats: Record<string, { total: number; active: number; inactive: number }> = {}
    for (const p of allApprovedPayments) {
      const ct = p.contentType || 'unknown'
      if (!typeStats[ct]) typeStats[ct] = { total: 0, active: 0, inactive: 0 }
      typeStats[ct].total++
      if (p.isActive) typeStats[ct].active++
      else typeStats[ct].inactive++
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalPurchases,
        activePurchases,
        inactivePurchases,
      },
      contentTypeLabels,
      typeStats,
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Content Purchases')
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const body = await request.json()
    const { id, isActive, reason } = body

    if (!id || isActive === undefined) {
      return apiError('আইডি এবং isActive প্রয়োজন', 400)
    }

    const existing = await db.payment.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!existing) {
      return apiError('পেমেন্ট খুঁজে পাওয়া যায়নি', 404)
    }

    if (existing.status !== 'APPROVED') {
      return apiError('শুধুমাত্র অনুমোদিত পেমেন্টের অ্যাক্সেস পরিবর্তন করা যায়', 400)
    }

    // Wrap all side effects in a single transaction for atomicity
    const updated = await db.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id },
        data: {
          isActive,
          adminNote: reason ? `${existing.adminNote ? existing.adminNote + ' | ' : ''}অ্যাক্সেস ${isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}: ${reason}` : existing.adminNote,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })

      // Cascade: MCQ Exam Package
      if (existing.contentType === 'mcq-exam-package' && existing.contentId) {
        const purchase = await tx.mCQExamPackagePurchase.findFirst({
          where: { userId: existing.userId, packageId: existing.contentId },
        })
        if (purchase) {
          await tx.mCQExamPackagePurchase.update({ where: { id: purchase.id }, data: { isActive } })
        }
      }

      // Cascade: CQ Exam Package
      if (existing.contentType === 'cq-exam-package' && existing.contentId) {
        const purchase = await tx.cQExamPackagePurchase.findFirst({
          where: { userId: existing.userId, packageId: existing.contentId },
        })
        if (purchase) {
          await tx.cQExamPackagePurchase.update({ where: { id: purchase.id }, data: { isActive } })
        }
      }

      // Cascade: Package subscription
      if (existing.contentType === 'package' && existing.contentId) {
        const subscription = await tx.userSubscription.findFirst({
          where: { userId: existing.userId, packageId: existing.contentId, classLevel: existing.classLevel || undefined },
        })
        if (subscription) {
          await tx.userSubscription.update({ where: { id: subscription.id }, data: { isActive } })
        }
      }

      // Create notification
      const actionLabel = isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'
      const contentLabel = existing.contentTitle || existing.contentType || 'কন্টেন্ট'
      await tx.notification.create({
        data: {
          userId: existing.userId,
          title: `কন্টেন্ট অ্যাক্সেস ${actionLabel}`,
          message: `আপনার "${contentLabel}" কন্টেন্টের অ্যাক্সেস ${actionLabel} করা হয়েছে।${reason ? ` কারণ: ${reason}` : ''}`,
          type: isActive ? 'SUCCESS' : 'WARNING',
        },
      })

      return payment
    })

    await auditFromRequest(request, auth.user.id, 'content_purchase_status_update', 'content_purchase', updated.id, { isActive: existing.isActive } as Record<string, unknown>, { isActive } as Record<string, unknown>)

    return NextResponse.json({
      success: true,
      data: updated,
      message: isActive ? 'ক্রয় সক্রিয় করা হয়েছে' : 'ক্রয় নিষ্ক্রিয় করা হয়েছে',
    })
  } catch (error) {
    return handleApiError(error, 'Admin Patch Content Purchases')
  }
}
