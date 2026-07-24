import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'

// GET /api/favicon - Serves the site favicon from the database
// Falls back to the default CDN icon if no custom favicon is set
export async function GET(request: NextRequest) {
  try {
    const setting = await db.siteSetting.findUnique({ where: { key: 'favicon' } })
    const faviconUrl = setting?.value

    if (faviconUrl) {
      // If it's a relative URL (local upload), redirect to it using the request origin
      if (faviconUrl.startsWith('/')) {
        return NextResponse.redirect(new URL(faviconUrl, request.nextUrl.origin))
      }
      // If it's an absolute URL, redirect to it
      return NextResponse.redirect(faviconUrl)
    }
  } catch (error) {
    return handleApiError(error, 'Favicon API error:')
  }
}
