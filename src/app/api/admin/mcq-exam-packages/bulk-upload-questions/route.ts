import { apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { ExcelParseError,safeParseExcelFromFile } from '@/lib/excel-parse'
import { NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import * as XLSX from 'xlsx'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { handleApiError } from '@/lib/errors'

// Excel column mapping (Bengali + English headers → DB fields)
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

// POST: Bulk upload MCQs from Excel and add them to an exam set
export async function POST(request: Request) {
  try {
    // Auth check
    const auth = await withAdmin(request)
    if (auth instanceof NextResponse) return auth

    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const setId = formData.get('setId') as string | null
    const defaultClassLevel = formData.get('classLevel') as string | null
    const defaultSubjectId = formData.get('subjectId') as string | null



    // Validate required fields
    if (!file) {
      return apiError('Excel ফাইল আপলোড করুন', 400)
    }
    if (!setId) {
      return apiError('এক্সাম সেট ID আবশ্যক', 400)
    }

    // Validate exam set exists and get marksPerQ
    const examSet = await db.mCQExamSet.findUnique({
      where: { id: setId },
      include: {
        package: { select: { id: true, classId: true, class: { select: { slug: true } } } },
      },
    })
    if (!examSet) {
      return apiError('এক্সাম সেট পাওয়া যায়নি', 404)
    }

    // Parse Excel file
    const { rows: rawRows } = await safeParseExcelFromFile(file)
    const rows = rawRows as Record<string, string>[]

    if (rows.length === 0) {
      return apiError('Excel ফাইলে কোনো ডাটা নেই', 400)
    }

    if (rows.length > 500) {
      return apiError('একবারে সর্বোচ্চ ৫০০টি প্রশ্ন আপলোড করা যাবে', 400)
    }

    // Resolve subjectId
    let resolvedSubjectId = defaultSubjectId
    if (!resolvedSubjectId || resolvedSubjectId === 'all') {
      const firstSubjectName = rows[0][Object.keys(rows[0]).find(k => COLUMN_MAP[k] === 'subjectName') || '']
      if (firstSubjectName) {
        const subject = await db.subject.findFirst({
          where: { name: { contains: firstSubjectName, mode: 'insensitive' }, isActive: true },
        })
        if (subject) resolvedSubjectId = subject.id
      }
    }

    // Build chapter name → id lookup
    const chapters = await db.chapter.findMany({
      where: { subjectId: resolvedSubjectId || undefined, isActive: true },
      select: { id: true, name: true, subjectId: true },
    })
    const chapterMap = new Map(chapters.map(c => [c.name.trim().toLowerCase(), c.id]))
    const chapterSlugMap = new Map(chapters.map(c => [c.name.replace(/\s+/g, '-').toLowerCase(), c.id]))

    // Get existing questions in the set (to avoid duplicates)
    const existingQuestions = await db.mCQExamSetQuestion.findMany({
      where: { setId },
      select: { mcqId: true },
    })
    const _existingMcqIds = new Set(existingQuestions.map(q => q.mcqId))

    // Get the max order in current set
    const maxOrderResult = await db.mCQExamSetQuestion.findFirst({
      where: { setId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const nextOrder = (maxOrderResult?.order ?? -1) + 1

    const validationErrors: string[] = []

    // ── Phase 1: Validate ALL rows and build insert payloads ──
    const insertPayloads: Array<{ mcqData: Record<string, unknown> }> = []
    const chapterSubjectMap = new Map(chapters.map(c => [c.id, (c as any).subjectId]))

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

      insertPayloads.push({
        mcqData: {
          question: mapped.question,
          optionA: mapped.optionA,
          optionB: mapped.optionB,
          optionC: mapped.optionC,
          optionD: mapped.optionD,
          correctAnswer: correctAnswer as 'A' | 'B' | 'C' | 'D',
          explanation: mapped.explanation || null,
          chapterId,
          classLevel: mapped.classLevel || defaultClassLevel || examSet.package?.class?.slug || '',
          subjectId: finalSubjectId || '',
          board: mapped.board || null,
          year: mapped.year || null,
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
          skipped: 0,
          errors: validationErrors,
          totalInSet: await db.mCQExamSetQuestion.count({ where: { setId } }),
        },
      })
    }

    // ── Phase 2: Create MCQs + link to exam set + recalculate — ALL in one transaction ──
    let totalInSet = 0
    try {
      await db.$transaction(async (tx) => {
        const createdMcqIds: string[] = []

        for (const payload of insertPayloads) {
          const mcq = await tx.mCQ.create({ data: payload.mcqData as any })
          createdMcqIds.push(mcq.id)
        }

        // Link all created MCQs to the exam set
        if (createdMcqIds.length > 0) {
          const setQuestionData = createdMcqIds.map((mcqId, index) => ({
            setId,
            mcqId,
            marks: examSet.marksPerQ,
            order: nextOrder + index,
          }))
          await tx.mCQExamSetQuestion.createMany({ data: setQuestionData })
        }

        // Recalculate set totals inside the transaction
        const questions = await tx.mCQExamSetQuestion.findMany({ where: { setId } })
        const totalQuestions = questions.length
        const totalMarks = questions.reduce((sum, q) => sum + toDecimal(q.marks), 0)
        await tx.mCQExamSet.update({
          where: { id: setId },
          data: { totalQuestions, totalMarks },
        })

        totalInSet = totalQuestions
      }, {
        maxWait: 10000,
        timeout: 120000,
      })
    } catch (insertError) {
      // Transaction rolled back — no MCQs created, no set links, no stale totals
      console.error('[MCQ Exam Bulk Upload] Transaction rolled back:', insertError)
      return NextResponse.json({
        success: true,
        data: {
          message: `বাল্ক আপলোড ব্যর্থ হয়েছে — কোনো প্রশ্ন সংরক্ষিত হয়নি: ${insertError instanceof Error ? insertError.message : 'অজানা ত্রুটি'}`,
          success: 0,
          failed: validationErrors.length + insertPayloads.length,
          skipped: 0,
          errors: [...validationErrors, `ডাটাবেস ত্রুটি: ${insertError instanceof Error ? insertError.message : 'অজানা'}`],
          totalInSet: await db.mCQExamSetQuestion.count({ where: { setId } }),
          rolledBack: true,
        },
      })
    }

    await auditFromRequest(request, auth.user.id, 'mcq_exam_questions_bulk_upload', 'mcq_exam_package', examSet.package.id, undefined, { count: insertPayloads.length, setId } as Record<string, unknown>)

    return NextResponse.json({
      success: true,
      data: {
        message: `${insertPayloads.length}টি প্রশ্ন সফলভাবে আপলোড ও সেটে যোগ হয়েছে${validationErrors.length > 0 ? `, ${validationErrors.length}টি ব্যর্থ` : ''}`,
        success: insertPayloads.length,
        failed: validationErrors.length,
        skipped: 0,
        errors: validationErrors,
        totalInSet,
      },
    })
  } catch (error) {
    if (error instanceof ExcelParseError) {
      return apiError(error.message, 400)
    }
    return handleApiError(error, 'Bulk upload questions error:')
  }
}

// GET: Download Excel template for bulk upload
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
      'বিষয় নাম',
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
        'বাংলা',
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
        'গণিত',
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
        'বিজ্ঞান',
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

    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 },
      { wch: 10 }, { wch: 8 },  { wch: 15 }, { wch: 10 }, { wch: 10 },
      { wch: 20 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'MCQ প্রশ্ন')

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="mcq-exam-set-template.xlsx"',
      },
    })
  } catch (error) {
    return handleApiError(error, 'Bulk upload questions error:')
  }
}
