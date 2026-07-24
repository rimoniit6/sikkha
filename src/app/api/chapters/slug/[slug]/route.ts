import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/chapters/slug/[slug]
 *
 * Resolve chapter by slug (public endpoint for client-side slug→ID resolution)
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId') // Optional: for more precise lookup

    const where: Record<string, unknown> = {
      slug,
      isActive: true
    }

    // If subjectId provided, use it for more precise lookup
    if (subjectId) {
      where.subjectId = subjectId
    }

    const chapter = await db.chapter.findFirst({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        order: true,
        subjectId: true,
      },
    })

    if (!chapter) {
      return NextResponse.json(
        { error: 'অধ্যায় খুঁজে পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: chapter,
    })
  } catch (error) {
    return handleApiError(error, '[/api/chapters/slug] Error')
  }
}