import { apiError,apiResponse,applyRateLimit,parsePaginationParams,validateBody,withAdmin,withCsrf } from '@/lib/api-utils'
import { AuditActions,createAuditLog,EntityTypes,getClientIP } from '@/lib/audit'
import { db } from '@/lib/db'
import { handleApiError,safeTransaction } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { reviewPaymentSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const contentType = searchParams.get('contentType')
    const q = searchParams.get('q')
    const { page, limit } = parsePaginationParams(searchParams)

    const where: Record<string, unknown> = {}

    if (status) where.status = status.toUpperCase()
    if (method) where.method = method
    if (contentType) where.contentType = contentType
    if (q) {
      where.OR = [
        { transactionId: { contains: q, mode: 'insensitive' } },
        { paymentNumber: { contains: q, mode: 'insensitive' } },
        { contentTitle: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
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
              isPremium: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    return apiResponse({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Payments')
  }
}

async function handleSubscriptionCreation(
  payment: { id: string; userId: string; contentId: string | null; classLevel: string | null },
  tx: Parameters<Parameters<typeof safeTransaction>[0]>[0]
) {
  if (!payment.contentId || !payment.classLevel) return
  const pkg = await tx.contentPackage.findUnique({
    where: { id: payment.contentId },
    select: { duration: true },
  })
  if (!pkg) return

  const startDate = new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + pkg.duration)

  const existingSub = await tx.userSubscription.findFirst({
    where: { userId: payment.userId, packageId: payment.contentId, classLevel: payment.classLevel },
  })

  if (!existingSub) {
    await tx.userSubscription.create({
      data: { userId: payment.userId, packageId: payment.contentId, classLevel: payment.classLevel, startDate, endDate, isActive: true, paymentId: payment.id },
    })
  } else {
    const currentEnd = new Date(existingSub.endDate)
    const newEnd = currentEnd > startDate ? currentEnd : startDate
    newEnd.setDate(newEnd.getDate() + pkg.duration)
    await tx.userSubscription.update({ where: { id: existingSub.id }, data: { endDate: newEnd, isActive: true, paymentId: payment.id } })
  }
}

async function handleCoursePurchase(payment: { id: string; userId: string; contentId: string | null }, tx: Parameters<Parameters<typeof safeTransaction>[0]>[0]) {
  if (!payment.contentId) return
  const [existingPurchase, existingEnrollment] = await Promise.all([
    tx.coursePurchase.findFirst({
      where: { userId: payment.userId, courseId: payment.contentId },
    }),
    tx.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.contentId } },
    }),
  ])
  if (!existingPurchase) {
    await tx.coursePurchase.create({
      data: { userId: payment.userId, courseId: payment.contentId, paymentId: payment.id, isActive: true },
    })
  } else {
    await tx.coursePurchase.update({ where: { id: existingPurchase.id }, data: { isActive: true, paymentId: payment.id } })
  }
  // Auto-enroll after purchase approval
  if (!existingEnrollment) {
    await tx.courseEnrollment.create({
      data: { userId: payment.userId, courseId: payment.contentId, status: 'ACTIVE', type: 'PAID' },
    })
  } else if (existingEnrollment.status !== 'ACTIVE') {
    await tx.courseEnrollment.update({
      where: { userId_courseId: { userId: payment.userId, courseId: payment.contentId } },
      data: { status: 'ACTIVE', type: 'PAID' },
    })
  }
}

async function handleMCQExamPurchase(payment: { id: string; userId: string; contentId: string | null }, tx: Parameters<Parameters<typeof safeTransaction>[0]>[0]) {
  if (!payment.contentId) return
  const existingPurchase = await tx.mCQExamPackagePurchase.findFirst({
    where: { userId: payment.userId, packageId: payment.contentId },
  })
  if (!existingPurchase) {
    await tx.mCQExamPackagePurchase.create({
      data: { userId: payment.userId, packageId: payment.contentId, paymentId: payment.id, isActive: true },
    })
  } else {
    await tx.mCQExamPackagePurchase.update({ where: { id: existingPurchase.id }, data: { isActive: true, paymentId: payment.id } })
  }
}

async function handleCQExamPurchase(payment: { id: string; userId: string; contentId: string | null }, tx: Parameters<Parameters<typeof safeTransaction>[0]>[0]) {
  if (!payment.contentId) return
  const existingPurchase = await tx.cQExamPackagePurchase.findFirst({
    where: { userId: payment.userId, packageId: payment.contentId },
  })
  if (!existingPurchase) {
    await tx.cQExamPackagePurchase.create({
      data: { userId: payment.userId, packageId: payment.contentId, paymentId: payment.id, isActive: true },
    })
  } else {
    await tx.cQExamPackagePurchase.update({ where: { id: existingPurchase.id }, data: { isActive: true, paymentId: payment.id } })
  }
}

export async function PATCH(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error

    const body = await request.json()
    const validation = validateBody(reviewPaymentSchema, body)
    if ('error' in validation) return validation.error
    const { id, status: lowerStatus, adminNote } = validation.data
    const status = lowerStatus.toUpperCase()

    if (status === 'REJECTED' && !adminNote?.trim()) {
      return apiError('প্রত্যাখ্যানের কারণ লিখুন', 400)
    }

    const result = await safeTransaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id },
        include: { user: true },
      })

      if (!existing) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 })
      if (existing.status !== 'PENDING') throw Object.assign(new Error('ALREADY_REVIEWED'), { statusCode: 400 })
      // Prevent self-approval: admin cannot approve their own payment
      if (existing.userId === auth.user.id) {
        throw Object.assign(new Error('SELF_APPROVAL'), { statusCode: 403 })
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote?.trim() || null,
          reviewedBy: auth.user.email || auth.user.id,
          reviewedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true, isPremium: true } },
        },
      })

      // Create notification
      await tx.notification.create({
        data: {
          userId: existing.userId,
          title: status === 'APPROVED' ? 'পেমেন্ট অনুমোদিত' : 'পেমেন্ট প্রত্যাখ্যাত',
          message: status === 'APPROVED'
            ? `আপনার "${existing.contentTitle || existing.contentType || 'কন্টেন্ট'}" ক্রয়ের ৳${existing.amount} পেমেন্ট অনুমোদিত হয়েছে।`
            : `আপনার ৳${existing.amount} পেমেন্ট প্রত্যাখ্যাত হয়েছে।${adminNote ? ` কারণ: ${adminNote}` : ''}`,
          type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR',
        },
      })

      // Post-transaction side effects (atomic with payment approval)
      if (status === 'APPROVED') {
        if (existing.contentType === 'course') {
          await handleCoursePurchase({ id: existing.id, userId: existing.userId, contentId: existing.contentId }, tx)
        } else if (existing.contentType === 'mcq-exam-package') {
          await handleMCQExamPurchase({ id: existing.id, userId: existing.userId, contentId: existing.contentId }, tx)
        } else if (existing.contentType === 'cq-exam-package') {
          await handleCQExamPurchase({ id: existing.id, userId: existing.userId, contentId: existing.contentId }, tx)
        } else if (existing.contentType === 'package') {
          await handleSubscriptionCreation({
            id: existing.id,
            userId: existing.userId,
            contentId: existing.contentId,
            classLevel: existing.classLevel,
          }, tx)
        }
      }

      // Audit log inside the transaction — atomic with payment state change
      await createAuditLog({
        adminId: auth.user.id,
        action: status === 'APPROVED' ? AuditActions.PAYMENT_APPROVE : AuditActions.PAYMENT_REJECT,
        entityType: EntityTypes.PAYMENT,
        entityId: id,
        oldData: { status: existing.status, adminNote: existing.adminNote },
        newData: { status, adminNote: adminNote?.trim() || null },
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
        tx: tx as never,
      })

      return { existing, updated }
    })

    return apiResponse(result.updated)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return apiError('পেমেন্ট খুঁজে পাওয়া যায়নি', 404)
    }
    if (error instanceof Error && error.message === 'ALREADY_REVIEWED') {
      return apiError('এই পেমেন্ট ইতিমধ্যে রিভিউ করা হয়েছে', 400)
    }
    if (error instanceof Error && error.message === 'SELF_APPROVAL') {
      return apiError('আপনি নিজের পেমেন্ট অনুমোদন করতে পারবেন না। অন্য অ্যাডমিনকে অনুরোধ করুন।', 403)
    }
    return handleApiError(error, 'Admin Update Payment')
  }
}
