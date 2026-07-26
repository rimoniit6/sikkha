import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { apiError, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { batchResolveContentClassLevels } from '@/lib/payment-helpers'

const batchCheckSchema = z.object({
  items: z.array(z.object({
    contentType: z.string(),
    contentId: z.string(),
  })).max(50, 'সর্বোচ্চ ৫০টি আইটেম চেক করা যাবে'),
})

export async function POST(request: Request) {
  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const auth = await verifyAuth(request)
    if (!auth) {
      // For non-logged-in users: return all items as unpurchased (same as logged-in free user)
      // This ensures the client follows the same happy path for both groups
      const body = await request.json()
      const validation = batchCheckSchema.safeParse(body)
      if (!validation.success) {
        return apiError('অবৈধ অনুরোধ', 400, 'VALIDATION_ERROR')
      }
      const { items } = validation.data
      const results = items.map(item => ({
        contentType: item.contentType,
        contentId: item.contentId,
        purchased: false,
        pendingPayment: false,
      }))
      return NextResponse.json({
        success: true,
        data: { items: results },
      })
    }

    const body = await request.json()
    const validation = batchCheckSchema.safeParse(body)
    if (!validation.success) {
      return apiError('অবৈধ অনুরোধ', 400, 'VALIDATION_ERROR')
    }

    const { items } = validation.data
    const userId = auth.user.id

    // NOTE: isPremium flag NO LONGER grants blanket "purchased" status.
    // Access is only granted through: direct payment, bundle purchase, or active subscription.
    // The isPremium flag is kept for UI display purposes only.

    // ===== Step 1: Batch fetch direct payments =====
    // Cross-type: mcq ↔ board-mcq, cq ↔ board-cq — same content, different context
    const orConditions = items.flatMap(item => {
      const conditions: Array<{ contentType: string; contentId: string }> = [
        { contentType: item.contentType, contentId: item.contentId },
      ]
      if (item.contentType === 'mcq') conditions.push({ contentType: 'board-mcq', contentId: item.contentId })
      if (item.contentType === 'board-mcq') conditions.push({ contentType: 'mcq', contentId: item.contentId })
      if (item.contentType === 'cq') conditions.push({ contentType: 'board-cq', contentId: item.contentId })
      if (item.contentType === 'board-cq') conditions.push({ contentType: 'cq', contentId: item.contentId })
      return conditions
    })

    const approvedPayments = await db.payment.findMany({
      where: {
        userId,
        status: 'APPROVED',
        isActive: true,
        OR: orConditions,
      },
      select: {
        contentType: true,
        contentId: true,
        id: true,
      },
    })

    // Also check pending payments
    const pendingPayments = await db.payment.findMany({
      where: {
        userId,
        status: 'PENDING',
        OR: orConditions,
      },
      select: {
        contentType: true,
        contentId: true,
        id: true,
      },
    })

    // Build a set of purchased contentIds for O(1) lookup
    const purchasedContentIds = new Set(approvedPayments.map(p => p.contentId))
    const pendingContentIds = new Set(pendingPayments.map(p => p.contentId))

    // ===== Step 2: Check active subscriptions =====
    // Uses shared batch helper for consistent class-level resolution
    const unpurchasedItems = items.filter(item => !purchasedContentIds.has(item.contentId))
    const subscriptionPurchasedIds = new Set<string>()

    if (unpurchasedItems.length > 0) {
      const activeSubscriptions = await db.userSubscription.findMany({
        where: {
          userId,
          isActive: true,
          endDate: { gte: new Date() },
        },
        select: {
          classLevel: true,
          package: { select: { title: true } },
        },
      })

      if (activeSubscriptions.length > 0) {
        const subClassLevels = new Set(activeSubscriptions.map(s => s.classLevel))

        // Use shared helper to batch-resolve class levels for all content types
        const classLevelMap = await batchResolveContentClassLevels(unpurchasedItems)

        // Mark items as subscription-purchased if their class level matches an active subscription
        for (const item of unpurchasedItems) {
          const classSlug = classLevelMap.get(item.contentId)
          if (classSlug && subClassLevels.has(classSlug)) {
            subscriptionPurchasedIds.add(item.contentId)
          }
        }
      }
    }

    // ===== Step 3: Check bundle purchases =====
    const stillUnpurchasedItems = unpurchasedItems.filter(
      item => !subscriptionPurchasedIds.has(item.contentId)
    )

    const bundlePurchasedIds = new Set<string>()
    const bundlePendingIds = new Set<string>()

    if (stillUnpurchasedItems.length > 0) {
      const bundleItemConditions = stillUnpurchasedItems.flatMap(item => {
        const contentTypes = [item.contentType]
        if (item.contentType === 'mcq') contentTypes.push('board-mcq')
        if (item.contentType === 'board-mcq') contentTypes.push('mcq')
        if (item.contentType === 'cq') contentTypes.push('board-cq')
        if (item.contentType === 'board-cq') contentTypes.push('cq')
        return contentTypes.map(ct => ({ contentType: ct, contentId: item.contentId }))
      })

      const relatedBundleItems = await db.bundleItem.findMany({
        where: { OR: bundleItemConditions },
        select: { bundleId: true, contentType: true, contentId: true },
      })

      if (relatedBundleItems.length > 0) {
        const bundleIds = [...new Set(relatedBundleItems.map(bi => bi.bundleId))]

        const approvedBundlePayments = await db.payment.findMany({
          where: {
            userId,
            contentType: 'bundle',
            contentId: { in: bundleIds },
            status: 'APPROVED',
            isActive: true,
          },
          select: { contentId: true },
        })

        const purchasedBundleIds = new Set(approvedBundlePayments.map(p => p.contentId))

        for (const bi of relatedBundleItems) {
          if (purchasedBundleIds.has(bi.bundleId)) {
            bundlePurchasedIds.add(bi.contentId)
          }
        }

        const pendingBundlePayments = await db.payment.findMany({
          where: {
            userId,
            contentType: 'bundle',
            contentId: { in: bundleIds },
            status: 'PENDING',
          },
          select: { contentId: true },
        })

        const pendingBundlePaymentIds = new Set(pendingBundlePayments.map(p => p.contentId))

        for (const bi of relatedBundleItems) {
          if (pendingBundlePaymentIds.has(bi.bundleId)) {
            bundlePendingIds.add(bi.contentId)
          }
        }
      }
    }

    // ===== Step 4: Check dedicated exam package purchases =====
    const examPackagePurchasedIds = new Set<string>()

    const mcqExamPackageItems = items.filter(i => i.contentType === 'mcq-exam-package')
    if (mcqExamPackageItems.length > 0) {
      const examPackageIds = mcqExamPackageItems.map(i => i.contentId)
      const examPackagePurchases = await db.mCQExamPackagePurchase.findMany({
        where: { userId, packageId: { in: examPackageIds }, isActive: true },
        select: { packageId: true },
      })
      for (const purchase of examPackagePurchases) {
        examPackagePurchasedIds.add(purchase.packageId)
      }
    }

    const cqExamPackageItems = items.filter(i => i.contentType === 'cq-exam-package')
    if (cqExamPackageItems.length > 0) {
      const examPackageIds = cqExamPackageItems.map(i => i.contentId)
      const examPackagePurchases = await db.cQExamPackagePurchase.findMany({
        where: { userId, packageId: { in: examPackageIds }, isActive: true },
        select: { packageId: true },
      })
      for (const purchase of examPackagePurchases) {
        examPackagePurchasedIds.add(purchase.packageId)
      }
    }

    // ===== Step 5: Check course-granted access =====
    const mcqCqItems = items.filter(i => i.contentType === 'mcq-exam-package' || i.contentType === 'cq-exam-package')
    if (mcqCqItems.length > 0) {
      const { getCourseGrantedContentIds } = await import('@/lib/course-access-resolver')
      const grantedMap = await getCourseGrantedContentIds(userId)
      for (const item of mcqCqItems) {
        if (grantedMap.has(item.contentId)) {
          examPackagePurchasedIds.add(item.contentId)
        }
      }
    }

    // ===== Step 6: Check bundle ownership (for bundle content type items) =====
    // When a bundle itself is an item in the batch, check if it's fully purchased
    const bundleItems = items.filter(i => i.contentType === 'bundle')
    const bundleOwnershipMap = new Map<string, boolean>()
    const bundlePartialMap = new Map<string, { purchased: number; total: number }>()

    if (bundleItems.length > 0) {
      const bundleIds = bundleItems.map(i => i.contentId)
      const bundles = await db.contentBundle.findMany({
        where: { id: { in: bundleIds } },
        include: { items: true },
      })

      // Batch-fetch course-granted content IDs once, outside the loop
      const { getCourseGrantedContentIds } = await import('@/lib/course-access-resolver')
      const courseGrantedIds = await getCourseGrantedContentIds(userId)

      for (const bundle of bundles) {
        // First check: was the bundle itself purchased via a direct bundle-type payment?
        const directBundlePurchase = await db.payment.findFirst({
          where: {
            userId,
            contentType: 'bundle',
            contentId: bundle.id,
            status: 'APPROVED',
            isActive: true,
          },
          select: { id: true },
        })

        if (directBundlePurchase) {
          bundleOwnershipMap.set(bundle.id, true)
          continue
        }

        // Second check: bundle is granted via course access
        if (courseGrantedIds.has(bundle.id)) {
          bundleOwnershipMap.set(bundle.id, true)
          continue
        }

        if (bundle.items.length === 0) {
          bundleOwnershipMap.set(bundle.id, false)
          continue
        }

        // Third check: all individual items inside the bundle are purchased separately
        const itemPayments = await db.payment.findMany({
          where: {
            userId,
            status: 'APPROVED',
            isActive: true,
            OR: bundle.items.map(item => ({
              contentType: item.contentType,
              contentId: item.contentId,
            })),
          },
        })

        if (itemPayments.length === bundle.items.length) {
          bundleOwnershipMap.set(bundle.id, true)
        } else {
          bundlePartialMap.set(bundle.id, {
            purchased: itemPayments.length,
            total: bundle.items.length,
          })
        }
      }
    }

    // ===== Step 7: Check package subscription (for package content type items) =====
    const packageItems = items.filter(i => i.contentType === 'package')
    const packageAccessMap = new Map<string, boolean>()

    if (packageItems.length > 0) {
      const packageIds = packageItems.map(i => i.contentId)
      const activeSubs = await db.userSubscription.findMany({
        where: {
          userId,
          packageId: { in: packageIds },
          isActive: true,
          endDate: { gte: new Date() },
        },
        select: { packageId: true },
      })
      for (const sub of activeSubs) {
        packageAccessMap.set(sub.packageId, true)
      }
    }

    // ===== Build final response =====
    const results = items.map(item => {
      // Bundle items: check full ownership
      if (item.contentType === 'bundle') {
        const fullyOwned = bundleOwnershipMap.get(item.contentId) || false
        const partial = bundlePartialMap.get(item.contentId)
        return {
          contentType: item.contentType,
          contentId: item.contentId,
          purchased: fullyOwned,
          pendingPayment: pendingContentIds.has(item.contentId),
          ...(partial ? { partialAccess: true, purchasedItemCount: partial.purchased, totalItemCount: partial.total } : {}),
        }
      }

      // Package items: check subscription OR direct payment
      if (item.contentType === 'package') {
        return {
          contentType: item.contentType,
          contentId: item.contentId,
          purchased: packageAccessMap.get(item.contentId) || purchasedContentIds.has(item.contentId),
          pendingPayment: pendingContentIds.has(item.contentId),
        }
      }

      // All other content types: standard 4-layer check
      return {
        contentType: item.contentType,
        contentId: item.contentId,
        purchased:
          purchasedContentIds.has(item.contentId) ||
          subscriptionPurchasedIds.has(item.contentId) ||
          bundlePurchasedIds.has(item.contentId) ||
          examPackagePurchasedIds.has(item.contentId),
        pendingPayment: pendingContentIds.has(item.contentId) || bundlePendingIds.has(item.contentId),
      }
    })

    return NextResponse.json({
      success: true,
      data: { items: results },
    })
  } catch (error) {
    return handleApiError(error, 'Batch payment check error')
  }
}
