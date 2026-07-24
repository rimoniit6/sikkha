import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/subjects/slug/[slug]
 *
 * Resolve subject by slug (public endpoint for client-side slug→ID resolution)
 * Optional: also pass classSlug via query param for more precise lookup
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const classSlug = searchParams.get('classSlug')

    // If classSlug provided, first resolve classId
    let resolvedClassId: string | null = classId || null
    if (!resolvedClassId && classSlug) {
      const classCategory = await db.classCategory.findUnique({
        where: { slug: classSlug, isActive: true },
        select: { id: true },
      })
      resolvedClassId = classCategory?.id || null
    }

    const where: Record<string, unknown> = {
      slug,
      isActive: true
    }

    // If we resolved a classId, use it for more precise lookup
    if (resolvedClassId) {
      where.classId = resolvedClassId
    }

    const subject = await db.subject.findFirst({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        classId: true,
        order: true,
        icon: true,
        color: true,
      },
    })

    if (!subject) {
      return NextResponse.json(
        { error: 'বিষয় খুঁজে পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: subject,
    })
  } catch (error) {
    return handleApiError(error, '[/api/subjects/slug] Error')
  }
}