import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import crypto from 'crypto'
import { verifyAuth } from '@/lib/auth'
import { handleApiError } from '@/lib/errors'

export async function POST(request: Request) {
  try {
    // Any authenticated user (student, admin, etc.) may upload files
    // Used by CQ exam answer images, payment screenshots, and admin content
    // CSRF is intentionally omitted: file uploads use FormData (multipart)
    // and are protected by auth + strict SameSite cookies.
    const auth = await verifyAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'আপলোড করতে লগইন প্রয়োজন' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'কোনো ফাইল পাওয়া যায়নি' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ফাইলের সাইজ ১০MB এর বেশি হতে পারবে না' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'অসমর্থিত ফাইল ফরম্যাট। শুধুমাত্র ছবি ও PDF ফাইল সমর্থিত' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${crypto.randomUUID()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, filename), buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json({
      success: true,
      data: [{ ufsUrl: url, url, name: file.name, size: file.size, type: file.type }],
    })
  } catch (error) {
    return handleApiError(error, 'Local upload error')
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
