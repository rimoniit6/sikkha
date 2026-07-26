import { db } from '@/lib/db'

/**
 * Lookup ExamYear id from year string.
 * Returns null if no active ExamYear is found for the given year.
 *
 * This is the single source of truth for yearId resolution.
 * All bulk upload, admin create/update, and import routes should use this.
 */
export async function resolveYearId(year: string | null | undefined): Promise<string | null> {
  if (!year) return null
  const examYear = await db.examYear.findFirst({
    where: { year: year.trim(), isActive: true },
    select: { id: true },
  })
  return examYear?.id ?? null
}
