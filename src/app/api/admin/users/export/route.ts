import { db } from '@/lib/db'
import { apiError, parsePaginationParams, withAdmin } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { AuditActions, EntityTypes, auditFromRequest } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const isPremium = searchParams.get('isPremium')
    const search = searchParams.get('search')

    // Use a generous limit to export all matching users
    const { limit } = parsePaginationParams(searchParams)
    const exportLimit = Math.min(100_000, limit > 0 ? limit : 10_000)

    const where: Record<string, unknown> = {}
    if (role) where.role = role
    if (isPremium !== null && isPremium !== undefined && isPremium !== '') {
      where.isPremium = isPremium === 'true'
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isPremium: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        classLevel: true,
        board: true,
      },
      orderBy: { createdAt: 'desc' },
      take: exportLimit,
    })

    // Audit log the export
    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.EXPORT,
      EntityTypes.USER,
      `exported_${users.length}_users`,
      undefined,
      { filters: { role: role || null, isPremium: isPremium || null, search: search || null }, count: users.length },
    )

    // Build CSV
    const headers = [
      'নাম', 'ইমেইল', 'ফোন', 'ভূমিকা',
      'প্রিমিয়াম', 'ভেরিফায়েড', 'শ্রেণি', 'বোর্ড',
      'নিবন্ধনের তারিখ', 'আপডেটের তারিখ',
    ]

    const rows = users.map((u) => [
      u.name || '',
      u.email,
      u.phone || '',
      u.role,
      u.isPremium ? 'হ্যাঁ' : 'না',
      u.isVerified ? 'হ্যাঁ' : 'না',
      u.classLevel || '',
      u.board || '',
      u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '',
      u.updatedAt ? new Date(u.updatedAt).toISOString().split('T')[0] : '',
    ])

    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`
    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')

    const filename = `users-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse('\ufeff' + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return handleApiError(error, 'Export users')
  }
}
