import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { safeParseExcelFromFile, ExcelParseError } from '@/lib/excel-parse'
import { withAdmin, withCsrf, applyRateLimit, apiError } from '@/lib/api-utils'
import { uploadLimiter } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { resolveYearId } from '@/lib/year-utils'

interface ImportError {
  row: number
  message: string
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  const rateCheck = await applyRateLimit(uploadLimiter, request)
  if ('error' in rateCheck) return rateCheck.error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const classId = formData.get('classId') as string | null
    const subjectId = formData.get('subjectId') as string | null
    const chapterId = formData.get('chapterId') as string | null
    const board = formData.get('board') as string | null
    const year = formData.get('year') as string | null
    const difficulty = formData.get('difficulty') as string | null

    if (!file) {
      return apiError('ফাইল আপলোড করুন', 400)
    }
    if (!type || !['mcq', 'cq', 'board-mcq', 'board-cq', 'knowledge'].includes(type)) {
      return apiError('সঠিক টাইপ নির্বাচন করুন', 400)
    }
    if (!chapterId) {
      return apiError('অধ্যায় আবশ্যক', 400)
    }
    if (type !== 'knowledge' && (!classId || !subjectId)) {
      return apiError('ক্লাস ও বিষয় আবশ্যক', 400)
    }

    const { rows } = await safeParseExcelFromFile(file)

    if (rows.length === 0) {
      return apiError('ফাইলে কোনো ডেটা নেই', 400)
    }

    const isBoard = type.startsWith('board-')
    const actualType = (isBoard ? type.replace('board-', '') : type).toUpperCase()

    // Validate year against ExamYear master table
    if (isBoard) {
      if (!board) return apiError('বোর্ড প্রশ্নের জন্য বোর্ড আবশ্যক', 400)
      if (!year) return apiError('বোর্ড প্রশ্নের জন্য সাল আবশ্যক', 400)
      const resolvedYearId = await resolveYearId(year)
      if (!resolvedYearId) {
        return apiError(`সাল "${year}" ডাটাবেজে খুঁজে পাওয়া যায়নি। পূর্বে /api/admin/years থেকে সাল যোগ করুন।`, 400)
      }
    }

    const defaultDifficulty = difficulty || 'MEDIUM'
    const validationErrors: ImportError[] = []

    // ── Phase 1: Validate ALL rows and build insert payloads ──
    // No DB writes happen here — this is pure validation
    const insertPayloads: Array<{ model: string; data: Record<string, unknown> }> = []

    if (actualType === 'MCQ') {
      const classObj = await db.classCategory.findUnique({ where: { id: classId! } })
      if (!classObj) return apiError('ক্লাস খুঁজে পাওয়া যায়নি', 400)
      const classLevel = classObj.slug

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        const question = String(row['question'] ?? row['প্রশ্ন'] ?? '').trim()
        const optionA = String(row['optionA'] ?? row['অপশনক'] ?? row['অপশন A'] ?? '').trim()
        const optionB = String(row['optionB'] ?? row['অপশনখ'] ?? row['অপশন B'] ?? '').trim()
        const optionC = String(row['optionC'] ?? row['অপশনগ'] ?? row['অপশন C'] ?? '').trim()
        const optionD = String(row['optionD'] ?? row['অপশনঘ'] ?? row['অপশন D'] ?? '').trim()
        let correctAnswer = String(row['correctAnswer'] ?? row['সঠিকউত্তর'] ?? row['সঠিক উত্তর'] ?? '').trim().toUpperCase()
        const explanation = String(row['explanation'] ?? row['ব্যাখ্যা'] ?? '').trim()
        const topic = String(row['topic'] ?? row['টপিক'] ?? '').trim()
        const isPremiumRaw = String(row['isPremium'] ?? row['প্রিমিয়াম'] ?? 'false').trim().toLowerCase()
        const isPremium = isPremiumRaw === 'true' || isPremiumRaw === '1'
        const priceVal = parseFloat(String(row['price'] ?? row['মূল্য'] ?? '0')) || 0

        if (!question) { validationErrors.push({ row: rowNum, message: 'প্রশ্ন ফাঁকা' }); continue }
        if (!optionA || !optionB || !optionC || !optionD) { validationErrors.push({ row: rowNum, message: 'সব অপশন পূরণ করুন' }); continue }

        const answerMap: Record<string, string> = { 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', '১': 'A', '২': 'B', '৩': 'C', '৪': 'D' }
        if (!answerMap[correctAnswer]) { validationErrors.push({ row: rowNum, message: `সঠিক উত্তর অবৈধ: "${correctAnswer}". A/B/C/D বা ক/খ/গ/ঘ ব্যবহার করুন` }); continue }
        correctAnswer = answerMap[correctAnswer]

        // Resolve yearId for board questions
        const insertYear = isBoard ? year : (year || null)
        const insertYearId = insertYear ? await resolveYearId(insertYear) : null

        insertPayloads.push({
          model: 'mCQ',
          data: {
            question, optionA, optionB, optionC, optionD,
            correctAnswer: correctAnswer as 'A' | 'B' | 'C' | 'D',
            explanation: explanation || null, chapterId: chapterId!, classLevel, subjectId: subjectId!,
            board: isBoard ? board : (board || null), year: insertYear, yearId: insertYearId,
            topic: topic || null, difficulty: defaultDifficulty as 'EASY' | 'MEDIUM' | 'HARD',
            isPremium, price: isPremium ? priceVal : 0, isActive: true,
          },
        })
      }
    } else if (actualType === 'CQ') {
      const classObj = await db.classCategory.findUnique({ where: { id: classId! } })
      if (!classObj) return apiError('ক্লাস খুঁজে পাওয়া যায়নি', 400)
      const classLevel = classObj.slug

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        const uddeepok = String(row['uddeepok'] ?? row['উদ্দীপক'] ?? '').trim()
        const question1 = String(row['question1'] ?? row['প্রশ্ন১'] ?? row['প্রশ্ন ১'] ?? '').trim()
        const answer1 = String(row['answer1'] ?? row['উত্তর১'] ?? row['উত্তর ১'] ?? '').trim()
        const question2 = String(row['question2'] ?? row['প্রশ্ন২'] ?? row['প্রশ্ন ২'] ?? '').trim()
        const answer2 = String(row['answer2'] ?? row['উত্তর২'] ?? row['উত্তর ২'] ?? '').trim()
        const question3 = String(row['question3'] ?? row['প্রশ্ন৩'] ?? row['প্রশ্ন ৩'] ?? '').trim()
        const answer3 = String(row['answer3'] ?? row['উত্তর৩'] ?? row['উত্তর ৩'] ?? '').trim()
        const question4 = String(row['question4'] ?? row['প্রশ্ন৪'] ?? row['প্রশ্ন ৪'] ?? '').trim()
        const answer4 = String(row['answer4'] ?? row['উত্তর৪'] ?? row['উত্তর ৪'] ?? '').trim()
        const topic = String(row['topic'] ?? row['টপিক'] ?? '').trim()
        const isPremiumRaw = String(row['isPremium'] ?? row['প্রিমিয়াম'] ?? 'false').trim().toLowerCase()
        const isPremium = isPremiumRaw === 'true' || isPremiumRaw === '1'
        const priceVal = parseFloat(String(row['price'] ?? row['মূল্য'] ?? '0')) || 0

        if (!uddeepok) { validationErrors.push({ row: rowNum, message: 'উদ্দীপক ফাঁকা' }); continue }
        if (!question1 || !answer1) { validationErrors.push({ row: rowNum, message: 'প্রশ্ন ১ ও উত্তর ১ আবশ্যক' }); continue }

        // Resolve yearId for board questions
        const insertYear = isBoard ? year : (year || null)
        const insertYearId = insertYear ? await resolveYearId(insertYear) : null

        insertPayloads.push({
          model: 'cQ',
          data: {
            uddeepok, question1, question2: question2 || '', question3: question3 || '', question4: question4 || '',
            answer1, answer2: answer2 || '', answer3: answer3 || '', answer4: answer4 || '',
            chapterId: chapterId!, classLevel, subjectId: subjectId!,
            board: isBoard ? board : (board || null), year: insertYear, yearId: insertYearId,
            topic: topic || null, difficulty: defaultDifficulty as 'EASY' | 'MEDIUM' | 'HARD',
            isPremium, price: isPremium ? priceVal : 0, isActive: true,
          },
        })
      }
    } else if (actualType === 'KNOWLEDGE') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        const question = String(row['question'] ?? row['প্রশ্ন'] ?? '').trim()
        const answer = String(row['answer'] ?? row['উত্তর'] ?? '').trim()
        const questionImage = String(row['questionImage'] ?? row['question_image'] ?? row['প্রশ্নচিত্র'] ?? '').trim()
        const answerImage = String(row['answerImage'] ?? row['answer_image'] ?? row['উত্তরচিত্র'] ?? '').trim()
        const isPremiumRaw = String(row['isPremium'] ?? row['প্রিমিয়াম'] ?? 'false').trim().toLowerCase()
        const isPremium = isPremiumRaw === 'true' || isPremiumRaw === '1'
        const priceVal = parseFloat(String(row['price'] ?? row['মূল্য'] ?? '0')) || 0
        const orderVal = parseInt(String(row['order'] ?? row['ক্রম'] ?? '0')) || 0

        if (!question) { validationErrors.push({ row: rowNum, message: 'প্রশ্ন ফাঁকা' }); continue }
        if (!answer) { validationErrors.push({ row: rowNum, message: 'উত্তর ফাঁকা' }); continue }

        insertPayloads.push({
          model: 'knowledgeQuestion',
          data: {
            chapterId, type: 'KNOWLEDGE', question, answer,
            questionImage: questionImage || null, answerImage: answerImage || null,
            isPremium, price: isPremium ? priceVal : 0, order: orderVal, isActive: true,
          },
        })
      }
    }

    // If nothing to insert, return validation errors only
    if (insertPayloads.length === 0) {
      return NextResponse.json({
        success: 0,
        errors: validationErrors,
        total: rows.length,
      })
    }

    // ── Phase 2: Insert ALL valid records in a single transaction ──
    // If ANY insert fails, ALL roll back — zero partial data
    let insertCount = 0
    try {
      await db.$transaction(async (tx) => {
        for (const payload of insertPayloads) {
          const model = (tx as any)[payload.model]
          if (!model) {
            throw new Error(`Unknown model: ${payload.model}`)
          }
          await model.create({ data: payload.data })
          insertCount++
        }
      }, {
        maxWait: 10000,
        timeout: 120000, // 2min for bulk inserts
      })
    } catch (insertError) {
      // Transaction rolled back — no partial data in DB
      // Return the error with 0 successes, validation errors still shown
      console.error('[Bulk Import] Transaction rolled back:', insertError)
      return NextResponse.json({
        success: 0,
        errors: [
          ...validationErrors,
          { row: 0, message: `বাল্ক ইমপোর্ট ব্যর্থ হয়েছে — কোনো ডাটা সংরক্ষিত হয়নি: ${insertError instanceof Error ? insertError.message : 'অজানা ত্রুটি'}` },
        ],
        total: rows.length,
        rolledBack: true,
      })
    }

    await auditFromRequest(request, auth.user.id, AuditActions.BULK_IMPORT, 'import', 'bulk', undefined, { type, count: insertCount, total: rows.length } as Record<string, unknown>)

    return NextResponse.json({
      success: insertCount,
      errors: validationErrors,
      total: rows.length,
    })
  } catch (error) {
    if (error instanceof ExcelParseError) {
      return apiError(error.message, 400)
    }
    return handleApiError(error, 'Bulk import error')
  }
}
