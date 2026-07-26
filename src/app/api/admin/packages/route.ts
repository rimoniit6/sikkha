import { apiResponse,parseIdsParam,validateBody,withAdmin,withCsrf } from '@/lib/api-utils'
import { invalidateContentCache } from '@/lib/cache-invalidate'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createVersion } from '@/lib/version-history'
import { auditFromRequest, AuditActions, getClientIP } from '@/lib/audit'
import { generateUniqueSlug } from '@/lib/slug-unique'

const createPackageSchema = z.object({
  title: z.string().min(1, 'শিরোনাম প্রদান করুন'),
  description: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  originalPrice: z.number().min(0).optional(),
  duration: z.number().int().positive('সময়কাল আবশ্যক').optional(),
  durationLabel: z.string().optional(),
  classLevel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().min(0).optional(),
})

const updatePackageSchema = z.object({
  id: z.string().min(1, 'প্যাকেজ ID আবশ্যক'),
  ids: z.array(z.string()).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  originalPrice: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().int().positive().optional(),
  durationLabel: z.string().optional(),
  classLevel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.coerce.number().min(0).optional(),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const classLevel = searchParams.get('classLevel') || ''
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (classLevel) {
      where.OR = [
        { classLevel: classLevel },
        { classLevel: null },
      ]
    }
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const [packages, total] = await Promise.all([
      db.contentPackage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { order: 'asc' },
          { price: 'asc' },
        ],
        include: {
          _count: {
            select: { subscriptions: true },
          },
        },
      }),
      db.contentPackage.count({ where }),
    ])

    // Add subscription count to each package
    const enrichedPackages = packages.map(pkg => ({
      ...pkg,
      subscriptionCount: pkg._count.subscriptions,
    }))

    return apiResponse({
      packages: enrichedPackages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'Get packages error')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const body = await request.json()
    const validation = validateBody(createPackageSchema, body)
    if ('error' in validation) return validation.error
    const { title, description, thumbnail, price, originalPrice, duration, durationLabel, classLevel, isActive, order } = validation.data

    // Generate base slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Auto-increment slug if it exists (handles soft-deleted records too)
    const slug = await generateUniqueSlug('contentPackage', baseSlug)

    const newPackage = await db.$transaction(async (tx) => {
      const pkg = await tx.contentPackage.create({
        data: {
          title,
          slug,
          description: description || null,
          thumbnail: thumbnail || null,
          price: price || 0,
          originalPrice: originalPrice || 0,
          duration: duration || 30,
          durationLabel: durationLabel || '৩০ দিন',
          classLevel: classLevel || null,
          isActive: isActive !== undefined ? isActive : true,
          order: order || 0,
        },
      })
      await auditFromRequest(request, auth.user.id, AuditActions.PACKAGE_CREATE, 'content_package', pkg.id, body, { title: pkg.title }, tx as never)
      return pkg
    })

    await invalidateContentCache('package')
    return apiResponse(newPackage, 'প্যাকেজ তৈরি হয়েছে', 201)
  } catch (error) {
    return handleApiError(error, 'Create package error')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const body = await request.json()
    const validation = validateBody(updatePackageSchema, body)
    if ('error' in validation) return validation.error
    const { id, ids, title, description, thumbnail, price, originalPrice, duration, durationLabel, classLevel, isActive, order } = validation.data

    if (Array.isArray(ids) && ids.length > 0) {
      const updateData: Record<string, unknown> = {}
      if (isActive !== undefined) updateData.isActive = isActive

      // Bulk update: create version for each affected entity
      const ipAddress = getClientIP(request)
      const userAgent = request.headers.get('user-agent') || undefined

      await db.$transaction(async (tx) => {
        // Fetch all records to snapshot before updating
        const records = await tx.contentPackage.findMany({
          where: { id: { in: ids } },
        })

        // Create version for each record
        for (const record of records) {
          const changedFields = Object.keys(updateData).filter(
            key => JSON.stringify(updateData[key]) !== JSON.stringify(record[key as keyof typeof record])
          )
          if (changedFields.length > 0) {
            await createVersion(tx, 'contentPackage', record.id, { ...record }, auth.user.id, changedFields, {
              ipAddress,
              userAgent,
            })
          }
        }

        // Perform the bulk update
        await tx.contentPackage.updateMany({ where: { id: { in: ids } }, data: updateData })
        await auditFromRequest(request, auth.user.id, AuditActions.PACKAGE_UPDATE, 'content_package', ids.join(','), undefined, { count: ids.length, updateData }, tx as never)
      }, {
        maxWait: 10000,
        timeout: 30000,
      })

      await invalidateContentCache('package')
      return apiResponse({ updated: ids.length }, `${ids.length}টি আপডেট হয়েছে`)
    }

    if (!id) {
      return apiResponse(null, 'প্যাকেজ ID প্রদান করুন', 400)
    }

    const existing = await db.contentPackage.findUnique({ where: { id } })
    if (!existing) {
      return apiResponse(null, 'প্যাকেজ পাওয়া যায়নি', 404)
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail
    if (price !== undefined) updateData.price = price
    if (originalPrice !== undefined) updateData.originalPrice = originalPrice
    if (duration !== undefined) updateData.duration = duration
    if (durationLabel !== undefined) updateData.durationLabel = durationLabel
    if (classLevel !== undefined) updateData.classLevel = classLevel
    if (isActive !== undefined) updateData.isActive = isActive
    if (order !== undefined) updateData.order = order

    // Determine which fields actually changed
    const changedFields = Object.keys(updateData).filter(
      key => JSON.stringify(updateData[key]) !== JSON.stringify(existing[key as keyof typeof existing])
    )

    // Create version snapshot + update + audit in single transaction
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    const updated = await db.$transaction(async (tx) => {
      // Create version snapshot of current state BEFORE update
      await createVersion(tx, 'contentPackage', id, { ...existing }, auth.user.id, changedFields, {
        ipAddress,
        userAgent,
      })

      // Perform the actual update
      const u = await tx.contentPackage.update({
        where: { id },
        data: updateData,
      })
      await auditFromRequest(request, auth.user.id, AuditActions.PACKAGE_UPDATE, 'content_package', id, existing, updateData, tx as never)
      return u
    }, {
      maxWait: 10000,
      timeout: 30000,
    })

    await invalidateContentCache('package')
    return apiResponse(updated, 'প্যাকেজ আপডেট হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Update package error')
  }
}

export async function DELETE(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error
    const { searchParams } = new URL(request.url)
    const ids = parseIdsParam(searchParams)
    if (ids) {
      await db.$transaction(async (tx) => {
        for (const pkgId of ids) {
          const subs = await tx.userSubscription.findMany({ where: { packageId: pkgId }, select: { id: true } })
          for (const sub of subs) {
            await tx.userSubscription.update({ where: { id: sub.id }, data: { deletedAt: new Date(), deletedBy: auth.user.id } })
          }
          await tx.contentPackage.update({ where: { id: pkgId }, data: { deletedAt: new Date(), deletedBy: auth.user.id } })
        }
        await auditFromRequest(request, auth.user.id, AuditActions.PACKAGE_DELETE, 'content_package', ids.join(','), undefined, { count: ids.length }, tx as never)
      })
      await invalidateContentCache('package')
      return apiResponse({ deleted: ids.length }, `${ids.length}টি সফলভাবে মুছে ফেলা হয়েছে`)
    }
    const id = searchParams.get('id')

    if (!id) {
      return apiResponse(null, 'প্যাকেজ ID প্রদান করুন', 400)
    }

    const existing = await db.contentPackage.findUnique({ where: { id } })
    if (!existing) {
      return apiResponse(null, 'প্যাকেজ পাওয়া যায়নি', 404)
    }

    await db.$transaction(async (tx) => {
      // Delete all subscriptions first
      const subs = await tx.userSubscription.findMany({ where: { packageId: id }, select: { id: true } })
      for (const sub of subs) {
        await tx.userSubscription.update({ where: { id: sub.id }, data: { deletedAt: new Date(), deletedBy: auth.user.id } })
      }
      await tx.contentPackage.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: auth.user.id } })
      await auditFromRequest(request, auth.user.id, AuditActions.PACKAGE_DELETE, 'content_package', id, undefined, undefined, tx as never)
    })

    await invalidateContentCache('package')
    return apiResponse({ id }, 'প্যাকেজ মুছে ফেলা হয়েছে')
  } catch (error) {
    return handleApiError(error, 'Delete package error')
  }
}
