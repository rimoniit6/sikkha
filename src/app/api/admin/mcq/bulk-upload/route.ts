import { db } from '@/lib/db'
import { apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { safeParseExcelFromFile, ExcelParseError } from '@/lib/excel-parse'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { handleApiError } from '@/lib/errors'
import { resolveYearId } from '@/lib/year-utils'

// Excel column mapping (Bengali headers → DB fields)
const COLUMN_MAP: Record<string, string> = {
  'প্রশ্ন': 'question',
  'অপশন ক': 'optionA',
  'অপশন খ': 'optionB',
  'অপশন গ': 'optionC',
  'অপশন ঘ': 'optionD',
  'সঠিক উত্তর': 'correctAnswer',
  'ব্যাখ্যা': 'explanation',
  'অধ্যায় নাম': 'chapterName',
  'বিষয় নাম': 'subjectName',
  'ক্লাস': 'classLevel',
  'বোর্ড': 'board',
  'সাল': 'year',
  'টপিক': 'topic',
  'কঠিনতা': 'difficulty',
  'প্রিমিয়াম': 'isPremium',
  'ট্যাগ': 'tags',
  // English fallback
  'Question': 'question',
  'Option A': 'optionA',
  'Option B': 'optionB',
  'Option C': 'optionC',
  'Option D': 'optionD',
  'Correct Answer': 'correctAnswer',
  'Explanation': 'explanation',
  'Chapter Name': 'chapterName',
  'Subject Name': 'subjectName',
  'Class': 'classLevel',
  'Board': 'board',
  'Year': 'year',
  'Topic': 'topic',
  'Difficulty': 'difficulty',
  'Premium': 'isPremium',
  'Tags': 'tags',
}

export async function POST(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth

    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const formData = await request.formData()
    const file = formData.get('file') as File
    const classLevel = formData.get('classLevel') as string
    const subjectId = formData.get('subjectId') as string

    if (!file) {
      return apiError('Excel ফাইল আপলোড করুন', 400)
    }

    if (!classLevel) {
      return apiError('ক্লাস নির্বাচন আবশ্যক', 400)
    }

    // Parse Excel file
    const { rows: rawRows } = await safeParseExcelFromFile(file)
    const rows = rawRows as Record<string, string>[]

    if (rows.length === 0) {
      return apiError('Excel ফাইলে কোনো ডাটা নেই', 400)
    }

    // Resolve subjectId — if "all" or not provided, look up from subject name
    let resolvedSubjectId = subjectId
    if (!resolvedSubjectId || resolvedSubjectId === 'all') {
      const firstSubjectName = rows[0][Object.keys(rows[0]).find(k => COLUMN_MAP[k] === 'subjectName') || '']
      if (firstSubjectName) {
        const subject = await db.subject.findFirst({
          where: { name: { contains: firstSubjectName, mode: 'insensitive' }, isActive: true },
        })
        if (subject) resolvedSubjectId = subject.id
      }
    }

    // Build chapter name → id lookup (read-only, outside transaction)
    const chapters = await db.chapter.findMany({
      where: { subjectId: resolvedSubjectId || undefined, isActive: true },
      select: { id: true, name: true, subjectId: true },
    })
    const chapterMap = new Map(chapters.map(c => [c.name.trim().toLowerCase(), c.id]))
    const chapterSlugMap = new Map(chapters.map(c => [c.name.replace(/\s+/g, '-').toLowerCase(), c.id]))
    const chapterSubjectMap = new Map(chapters.map(c => [c.id, c.subjectId]))

    const validationErrors: string[] = []

    // ── Phase 1: Validate ALL rows and build insert payloads ──
    // No DB writes happen here — pure validation + lookups
    const insertPayloads: Array<{ data: Record<string, unknown> }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const mapped: Record<string, string> = {}
      for (const [header, value] of Object.entries(row)) {
        const dbField = COLUMN_MAP[header]
        if (dbField) {
          mapped[dbField] = String(value).trim()
        }
      }

      if (!mapped.question || !mapped.optionA || !mapped.optionB || !mapped.optionC || !mapped.optionD || !mapped.correctAnswer) {
        validationErrors.push(`সারি ${rowNum}: প্রয়োজনীয় ফিল্ড অনুপস্থিত (প্রশ্ন, ৪টি অপশন, সঠিক উত্তর)`)
        continue
      }

      const correctAnswer = mapped.correctAnswer.toUpperCase().trim()
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        validationErrors.push(`সারি ${rowNum}: সঠিক উত্তর A/B/C/D হতে হবে (পাওয়া গেছে: "${mapped.correctAnswer}")`)
        continue
      }

      let chapterId: string | undefined
      if (mapped.chapterName) {
        const key = mapped.chapterName.trim().toLowerCase()
        chapterId = chapterMap.get(key) || chapterSlugMap.get(key.replace(/\s+/g, '-'))
        if (!chapterId) {
          for (const [name, id] of chapterMap) {
            if (name.includes(key) || key.includes(name)) {
              chapterId = id
              break
            }
          }
        }
      }

      if (!chapterId && chapters.length > 0) {
        chapterId = chapters[0].id
      }

      if (!chapterId) {
        validationErrors.push(`সারি ${rowNum}: অধ্যায় পাওয়া যায়নি "${mapped.chapterName || '(নেই)'}"`)
        continue
      }

      const finalSubjectId = chapterSubjectMap.get(chapterId) || resolvedSubjectId

      const yearVal = mapped.year || null
      const yearIdVal = yearVal ? await resolveYearId(yearVal) : null

      insertPayloads.push({
        data: {
          question: mapped.question,
          optionA: mapped.optionA,
          optionB: mapped.optionB,
          optionC: mapped.optionC,
          optionD: mapped.optionD,
          correctAnswer: correctAnswer as 'A' | 'B' | 'C' | 'D',
          explanation: mapped.explanation || null,
          chapterId,
          classLevel: mapped.classLevel || classLevel,
          subjectId: finalSubjectId || '',
          board: mapped.board || null,
          year: yearVal,
          yearId: yearIdVal,
          topic: mapped.topic || null,
          difficulty: (mapped.difficulty || 'MEDIUM').toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
          isPremium: mapped.isPremium === 'true' || mapped.isPremium === '1' || mapped.isPremium === 'হ্যাঁ',
          price: 0,
          tags: mapped.tags || null,
          isActive: true,
        },
      })
    }

    if (insertPayloads.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'কোনো বৈধ প্রশ্ন পাওয়া যায়নি',
          success: 0,
          failed: validationErrors.length,
          errors: validationErrors,
          createdIds: [] as string[],
        },
      })
    }

    // ── Phase 2: Insert ALL valid records in a single transaction ──
    const createdIds: string[] = []
    try {
      await db.$transaction(async (tx) => {
        for (const payload of insertPayloads) {
          const created = await tx.mCQ.create({ data: payload.data as any })
          createdIds.push(created.id)
        }
      }, {
        maxWait: 10000,
        timeout: 120000, // 2min for bulk inserts
      })
    } catch (insertError) {
      // Transaction rolled back — no partial data in DB
      createdIds.length = 0
      console.error('[MCQ Bulk Upload] Transaction rolled back:', insertError)
      return NextResponse.json({
        success: true,
        data: {
          message: `বাল্ক আপলোড ব্যর্থ হয়েছে — কোনো প্রশ্ন সংরক্ষিত হয়নি: ${insertError instanceof Error ? insertError.message : 'অজানা ত্রুটি'}`,
          success: 0,
          failed: validationErrors.length + insertPayloads.length,
          errors: [...validationErrors, `ডাটাবেস ত্রুটি: ${insertError instanceof Error ? insertError.message : 'অজানা'}`],
          createdIds: [] as string[],
          rolledBack: true,
        },
      })
    }

    await auditFromRequest(request, auth.user.id, AuditActions.BULK_IMPORT, 'mcq', 'bulk', undefined, { count: createdIds.length } as Record<string, unknown>)

    return NextResponse.json({
      success: true,
      data: {
        message: `${createdIds.length}টি প্রশ্ন সফলভাবে যোগ হয়েছে${validationErrors.length > 0 ? `, ${validationErrors.length}টি ব্যর্থ` : ''}`,
        success: createdIds.length,
        failed: validationErrors.length,
        errors: validationErrors,
        createdIds,
      },
    })
  } catch (error) {
    if (error instanceof ExcelParseError) {
      return apiError(error.message, 400)
    }
    return handleApiError(error, 'Bulk upload error:')
  }
}

// GET: Download demo Excel template
export async function GET(request: Request) {
  try {
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth
    const headers = [
      'প্রশ্ন',
      'অপশন ক',
      'অপশন খ',
      'অপশন গ',
      'অপশন ঘ',
      'সঠিক উত্তর',
      'ব্যাখ্যা',
      'অধ্যায় নাম',
      'ক্লাস',
      'বোর্ড',
      'সাল',
      'টপিক',
      'কঠিনতা',
      'প্রিমিয়াম',
      'ট্যাগ',
    ]

    const demoRows = [
      [
        'বাংলাদেশের রাজধানী কোনটি?',
        'চট্টগ্রাম',
        'ঢাকা',
        'রাজশাহী',
        'খুলনা',
        'B',
        'বাংলাদেশের রাজধানী ঢাকা',
        'প্রাকৃতিক সংখ্যা',
        'class-6',
        'dhaka',
        '2025',
        'ভূগোল',
        'easy',
        'false',
        'ভূগোল;বাংলাদেশ',
      ],
      [
        '2 + 2 = ?',
        '3',
        '4',
        '5',
        '6',
        'B',
        'প্রাথমিক যোগ',
        'ভগ্নাংশ ও দশমিক',
        'class-6',
        '',
        '',
        'গণিত',
        'easy',
        'false',
        'গণিত;যোগ',
      ],
      [
        'পানির রাসায়নিক সংকেত কী?',
        'CO₂',
        'H₂O',
        'NaCl',
        'O₂',
        'B',
        'পানির রাসায়নিক সংকেত H₂O',
        'পদার্থের বৈশিষ্ট্য',
        'class-6',
        '',
        '',
        'রসায়ন',
        'medium',
        'false',
        'রসায়ন;পানি',
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...demoRows])

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // প্রশ্ন
      { wch: 15 }, // অপশন ক
      { wch: 15 }, // অপশন খ
      { wch: 15 }, // অপশন গ
      { wch: 15 }, // অপশন ঘ
      { wch: 12 }, // সঠিক উত্তর
      { wch: 25 }, // ব্যাখ্যা
      { wch: 20 }, // অধ্যায় নাম
      { wch: 10 }, // ক্লাস
      { wch: 10 }, // বোর্ড
      { wch: 8 },  // সাল
      { wch: 15 }, // টপিক
      { wch: 10 }, // কঠিনতা
      { wch: 10 }, // প্রিমিয়াম
      { wch: 20 }, // ট্যাগ
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'MCQ প্রশ্ন')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="mcq-demo-template.xlsx"',
      },
    })
  } catch (error) {
    return handleApiError(error, 'Bulk upload error:')
  }
}
