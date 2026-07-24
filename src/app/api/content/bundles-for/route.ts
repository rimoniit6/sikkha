import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/content/bundles-for?contentType=mcq&contentId=xxx&classLevel=class-10
 *
 * Finds all active bundles that contain the specified content item.
 * Also returns available packages if no bundles found (or always as an option).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('contentType') || ''
    const contentId = searchParams.get('contentId') || ''
    const classLevel = searchParams.get('classLevel') || ''

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType এবং contentId প্রয়োজন' },
        { status: 400 }
      )
    }

    // Cross-type: mcq ↔ board-mcq, cq ↔ board-cq — same content, different context
    // When searching for board-mcq, also search for mcq (and vice versa) since bundles store base types
    const contentTypesToSearch = [contentType]
    if (contentType === 'board-mcq') contentTypesToSearch.push('mcq')
    if (contentType === 'mcq') contentTypesToSearch.push('board-mcq')
    if (contentType === 'board-cq') contentTypesToSearch.push('cq')
    if (contentType === 'cq') contentTypesToSearch.push('board-cq')

    // 1. Find bundles containing this content item
    const bundleItems = await db.bundleItem.findMany({
      where: {
        contentType: { in: contentTypesToSearch },
        contentId,
      },
      include: {
        bundle: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnail: true,
            price: true,
            originalPrice: true,
            classLevel: true,
            board: true,
            year: true,
            type: true,
            isActive: true,
            order: true,
          },
        },
      },
    })

    // Filter to only active bundles
    const activeBundles = bundleItems
      .filter((bi) => bi.bundle.isActive)
      .map((bi) => {
        const bundle = bi.bundle
        const discount =
          toDecimal(bundle.originalPrice) > toDecimal(bundle.price)
            ? Math.round(
                ((toDecimal(bundle.originalPrice) - toDecimal(bundle.price)) / toDecimal(bundle.originalPrice)) *
                  100
              )
            : 0

        return {
          id: bundle.id,
          title: bundle.title,
          slug: bundle.slug,
          description: bundle.description,
          thumbnail: bundle.thumbnail,
          price: bundle.price,
          originalPrice: bundle.originalPrice,
          isPremium: toDecimal(bundle.price) > 0 || toDecimal(bundle.originalPrice) > 0,
          discount,
          classLevel: bundle.classLevel,
          board: bundle.board,
          year: bundle.year,
          type: bundle.type,
          order: bundle.order,
        }
      })

    // 2. Also fetch available packages (for the "no bundle" case or as additional option)
    const packageWhere: Record<string, unknown> = { isActive: true }
    if (classLevel) {
      packageWhere.OR = [
        { classLevel },
        { classLevel: null },
      ]
    }

    const packages = await db.contentPackage.findMany({
      where: packageWhere,
      orderBy: [{ order: 'asc' }, { price: 'asc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnail: true,
        price: true,
        originalPrice: true,
        duration: true,
        durationLabel: true,
        classLevel: true,
        order: true,
      },
    })

    // Count premium content per package class level
    const packagesWithCounts = await Promise.all(
      packages.map(async (pkg) => {
        const targetClass = pkg.classLevel || classLevel || ''
        let mcqCount = 0
        let cqCount = 0
        let lectureCount = 0

        if (targetClass) {
          // Get class category IDs for this class level (needed for lecture count)
          const classCats = await db.classCategory.findMany({
            where: { slug: targetClass },
            select: { id: true },
          })
          const classIds = classCats.map(c => c.id)

          ;[mcqCount, cqCount, lectureCount] = await Promise.all([
            db.mCQ.count({
              where: { isActive: true, isPremium: true, classLevel: targetClass },
            }),
            db.cQ.count({
              where: { isActive: true, isPremium: true, classLevel: targetClass },
            }),
            classIds.length > 0
              ? db.lecture.count({
                  where: {
                    isActive: true,
                    isPremium: true,
                    chapter: { subject: { classId: { in: classIds } } },
                  },
                })
              : 0,
          ])
        }

        const discount =
          toDecimal(pkg.originalPrice) > toDecimal(pkg.price)
            ? Math.round(
                ((toDecimal(pkg.originalPrice) - toDecimal(pkg.price)) / toDecimal(pkg.originalPrice)) * 100
              )
            : 0

        return {
          ...pkg,
          isPremium: toDecimal(pkg.price) > 0 || toDecimal(pkg.originalPrice) > 0,
          mcqCount,
          cqCount,
          lectureCount,
          totalContent: mcqCount + cqCount + lectureCount,
          discount,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        bundles: activeBundles,
        packages: packagesWithCounts,
        hasBundles: activeBundles.length > 0,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Bundles-for content error')
  }
}
