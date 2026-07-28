import { db } from '@/lib/db'
import { apiResponse, withAdmin, withCsrf, validateBody } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SETTINGS_KEYS = [
  'default_provider',
  'default_prompt',
  'posts_per_run',
  'auto_publish',
  'language',
  'timezone',
] as const

const settingsSchema = z.record(z.enum(SETTINGS_KEYS), z.string())

const DEFAULT_VALUES: Record<string, string> = {
  default_provider: 'GEMINI',
  default_prompt: '',
  posts_per_run: '5',
  auto_publish: 'false',
  language: 'bn',
  timezone: 'Asia/Dhaka',
}

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const settings = await db.automationSetting.findMany({
      where: { key: { in: SETTINGS_KEYS as unknown as string[] } },
    })
    const map: Record<string, string> = { ...DEFAULT_VALUES }
    for (const s of settings) map[s.key] = s.value
    return apiResponse(map)
  } catch (error) {
    return handleApiError(error, 'GET settings')
  }
}

export async function PUT(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth
  const csrf = await withCsrf(request)
  if ('error' in csrf) return csrf.error

  try {
    const body = await request.json()
    const validated = validateBody(settingsSchema, body)
    if ('error' in validated) return validated.error

    await db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(validated.data)) {
        await tx.automationSetting.upsert({
          where: { key },
          create: { key, value, group: 'automation' },
          update: { value },
        })
      }
      await auditFromRequest(request, auth.user.id, AuditActions.AUTOMATION_SETTING_CHANGE, 'automation_settings', 'automation-v2', undefined, validated.data, tx as never)
    })

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'PUT settings')
  }
}
