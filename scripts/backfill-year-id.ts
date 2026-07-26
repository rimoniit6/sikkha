/**
 * Backfill yearId for existing records
 *
 * This one-time migration script populates yearId for MCQ, CQ, BoardYear,
 * and ContentBundle records that have a `year` value but null `yearId`.
 *
 * Usage: npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/backfill-year-id.ts
 * Or: npx tsx scripts/backfill-year-id.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Backfill yearId for existing records ===\n')

  // Step 1: Collect all distinct year strings from MCQ/CQ/BoardYear/ContentBundle
  const [mcqYears, cqYears, boardYears, bundleYears] = await Promise.all([
    db.mCQ.findMany({
      where: { year: { not: null }, yearId: null },
      select: { id: true, year: true },
    }),
    db.cQ.findMany({
      where: { year: { not: null }, yearId: null },
      select: { id: true, year: true },
    }),
    db.boardYear.findMany({
      where: { yearId: null },
      select: { id: true, year: true },
    }),
    db.contentBundle.findMany({
      where: { year: { not: null }, yearId: null },
      select: { id: true, year: true },
    }),
  ])

  console.log(`MCQ records to update: ${mcqYears.length}`)
  console.log(`CQ records to update: ${cqYears.length}`)
  console.log(`BoardYear records to update: ${boardYears.length}`)
  console.log(`ContentBundle records to update: ${bundleYears.length}`)

  // Step 2: Ensure all referenced years exist in ExamYear
  const allYearStrings = new Set<string>()
  for (const r of mcqYears) if (r.year) allYearStrings.add(r.year)
  for (const r of cqYears) if (r.year) allYearStrings.add(r.year)
  for (const r of boardYears) if (r.year) allYearStrings.add(r.year)
  for (const r of bundleYears) if (r.year) allYearStrings.add(r.year)

  console.log(`\nDistinct year values to resolve: ${allYearStrings.size}`)

  // Find existing ExamYear records
  const existingExamYears = await db.examYear.findMany({
    where: { year: { in: Array.from(allYearStrings) } },
    select: { id: true, year: true },
  })
  const examYearMap = new Map(existingExamYears.map((ey) => [ey.year, ey.id]))

  // Log missing years
  const missingYears = Array.from(allYearStrings).filter((y) => !examYearMap.has(y))
  if (missingYears.length > 0) {
    console.log(`\n⚠️  ${missingYears.length} year(s) missing from ExamYear master table. Creating now...`)
    for (const year of missingYears) {
      const created = await db.examYear.create({
        data: { year, isActive: true },
      })
      examYearMap.set(year, created.id)
      console.log(`  Created ExamYear: ${year} → ${created.id}`)
    }
  }

  // Step 3: Bulk update MCQ records
  if (mcqYears.length > 0) {
    let updated = 0
    for (const record of mcqYears) {
      const yearId = examYearMap.get(record.year!)
      if (yearId) {
        await db.mCQ.update({
          where: { id: record.id },
          data: { yearId },
        })
        updated++
      }
    }
    console.log(`\n✅ Updated ${updated}/${mcqYears.length} MCQ records`)
  }

  // Step 4: Bulk update CQ records
  if (cqYears.length > 0) {
    let updated = 0
    for (const record of cqYears) {
      const yearId = examYearMap.get(record.year!)
      if (yearId) {
        await db.cQ.update({
          where: { id: record.id },
          data: { yearId },
        })
        updated++
      }
    }
    console.log(`✅ Updated ${updated}/${cqYears.length} CQ records`)
  }

  // Step 5: Bulk update BoardYear records
  if (boardYears.length > 0) {
    let updated = 0
    for (const record of boardYears) {
      const yearId = examYearMap.get(record.year!)
      if (yearId) {
        await db.boardYear.update({
          where: { id: record.id },
          data: { yearId },
        })
        updated++
      }
    }
    console.log(`✅ Updated ${updated}/${boardYears.length} BoardYear records`)
  }

  // Step 6: Bulk update ContentBundle records
  if (bundleYears.length > 0) {
    let updated = 0
    for (const record of bundleYears) {
      const yearId = examYearMap.get(record.year!)
      if (yearId) {
        await db.contentBundle.update({
          where: { id: record.id },
          data: { yearId },
        })
        updated++
      }
    }
    console.log(`✅ Updated ${updated}/${bundleYears.length} ContentBundle records`)
  }

  console.log('\n=== Backfill complete ===')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
