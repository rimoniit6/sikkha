import { applyRateLimit } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/errors'
import { apiLimiter } from '@/lib/rate-limit'
import { verifyAuth } from '@/lib/auth'
import { batchCheckContentAccess } from '@/lib/access-control'
import { cacheHeaders } from '@/lib/cache-headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const rateCheck = await applyRateLimit(apiLimiter, request)
    if ('error' in rateCheck) return rateCheck.error
    const { searchParams } = new URL(request.url)
    let classId = searchParams.get('classId')
    if (!classId) {
      const auth = await verifyAuth(request)
      if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
        const classCat = await db.classCategory.findUnique({ where: { slug: auth.user.classLevel }, select: { id: true } })
        if (classCat) classId = classCat.id
      }
    }
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isActive: true }

    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId
    if (chapterId) where.chapterId = chapterId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [suggestions, total] = await Promise.all([
      db.suggestion.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          classId: true,
          subjectId: true,
          chapterId: true,
          thumbnail: true,
          pdfUrl: true,
          isPremium: true,
          price: true,
          viewCount: true,
          order: true,
          createdAt: true,
          content: true,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.suggestion.count({ where }),
    ])

    const classIds = [...new Set(suggestions.map((s) => s.classId).filter(Boolean) as string[])]
    const subjectIds = [...new Set(suggestions.map((s) => s.subjectId).filter(Boolean) as string[])]
    const chapterIds = [...new Set(suggestions.map((s) => s.chapterId).filter(Boolean) as string[])]

    const [classes, subjects, chapters] = await Promise.all([
      classIds.length > 0
        ? db.classCategory.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
        : [],
      subjectIds.length > 0
        ? db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
        : [],
      chapterIds.length > 0
        ? db.chapter.findMany({ where: { id: { in: chapterIds } }, select: { id: true, name: true } })
        : [],
    ])

    const classMap = new Map<string, string>(classes.map((c) => [c.id, c.name] as [string, string]))
    const subjectMap = new Map<string, string>(subjects.map((s) => [s.id, s.name] as [string, string]))
    const chapterMap = new Map<string, string>(chapters.map((c) => [c.id, c.name] as [string, string]))

    // ── Access control: resolve which premium suggestions the user can see ──
    const auth = await verifyAuth(request)
    const userId = auth?.user.id
    const isAdmin = auth?.user && ['ADMIN', 'SUPER_ADMIN'].includes(auth.user.role)

    let accessiblePremiumIds = new Set<string>()
    if (!isAdmin && userId) {
      const premiumIds = suggestions.filter((s) => s.isPremium).map((s) => s.id)
      if (premiumIds.length > 0) {
        const accessMap = await batchCheckContentAccess({
          userId,
          items: premiumIds.map((id) => ({ contentType: 'suggestion', contentId: id })),
        })
        for (const [id, result] of accessMap) {
          if (result.hasAccess) accessiblePremiumIds.add(id)
        }
      }
    } else if (isAdmin) {
      accessiblePremiumIds = new Set(suggestions.filter((s) => s.isPremium).map((s) => s.id))
    }

    const transformed = suggestions.map((s) => {
      const isPremiumLocked = s.isPremium && !accessiblePremiumIds.has(s.id)

      const base = {
        id: s.id,
        title: s.title,
        slug: s.slug,
        classId: s.classId,
        subjectId: s.subjectId,
        chapterId: s.chapterId,
        className: s.classId ? classMap.get(s.classId) || null : null,
        subjectName: s.subjectId ? subjectMap.get(s.subjectId) || null : null,
        chapterName: s.chapterId ? chapterMap.get(s.chapterId) || null : null,
        thumbnail: s.thumbnail,
        pdfUrl: isPremiumLocked ? null : s.pdfUrl,
        isPremium: s.isPremium,
        price: s.price,
        viewCount: s.viewCount,
        order: s.order,
        createdAt: s.createdAt,
        hasAccess: !isPremiumLocked,
      }

      if (isPremiumLocked) {
        return { ...base, content: null }
      }

      return { ...base, content: s.content }
    })

    return NextResponse.json({
      success: true,
      data: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers: cacheHeaders.noCache })
  } catch (error) {
    return handleApiError(error, 'Get Suggestions error')
  }
}
