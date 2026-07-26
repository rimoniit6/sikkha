import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, verifyAuth } from '@/lib/auth'
import { apiError, withCsrf } from '@/lib/api-utils'
import { toDecimal } from '@/lib/decimal'
import { validateExamAccess, getExamTimeWindow, calculateTimeRemaining, parseSubjectIds } from '@/features/shared/exam-engine'
import logger from '@/lib/logger'
import { handleApiError } from '@/lib/errors'

// ============================================================================
// GET handler — all read operations for MCQ Exam Packages (public-facing)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'

    switch (action) {
      case 'list':
        return await handleList(searchParams, request)
      case 'detail':
        return await handleDetail(searchParams, request)
      case 'take-exam':
        return await handleTakeExam(searchParams, request)
      case 'my-results':
        return await handleMyResults(searchParams, request)
      case 'result-detail':
        return await handleResultDetail(searchParams, request)
      case 'weakness-analysis':
        return await handleWeaknessAnalysis(searchParams, request)
      case 'check-purchase':
        return await handleCheckPurchase(searchParams, request)
      case 'leaderboard':
        return await handleLeaderboard(searchParams, request)
      case 'exam-set-status':
        return await handleExamSetStatus(searchParams, request)
      case 'check-retake':
        return await handleCheckRetake(searchParams, request)
      case 'my-retake-requests':
        return await handleMyRetakeRequests(searchParams, request)
      case 'set-overview':
        return await handleSetOverview(searchParams, request)
      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    logger.error('MCQ Exam Packages API error', error, { route: 'mcq-exam-packages', method: 'GET' })
    return apiError('সার্ভার ত্রুটি হয়েছে', 500)
  }
}

// ============================================================================
// POST handler — submit exam answers
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Enforce CSRF protection on all mutating requests to this endpoint.
    // (The global middleware treats this route as "public", so it skips CSRF,
    //  therefore we verify it explicitly at the handler level.)
    const csrf = await withCsrf(request)
    if ('error' in csrf) return csrf.error

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'save-answers':
        return await handleSaveAnswers(body, request)
      case 'submit-exam':
        return await handleSubmitExam(body, request)
      case 'request-retake':
        return await handleRequestRetake(body, request)
      default:
        return apiError(`Unknown action: ${action}`, 400)
    }
  } catch (error) {
    logger.error('MCQ Exam Packages POST error', error, { route: 'mcq-exam-packages', method: 'POST' })
    return apiError('সার্ভার ত্রুটি হয়েছে', 500)
  }
}

// ============================================================================
// 1. LIST — Published packages with pagination
// ============================================================================

async function handleList(searchParams: URLSearchParams, request: NextRequest) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)))
  let classId = searchParams.get('classId') || ''
  if (!classId) {
    const auth = await verifyAuth(request)
    if (auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
      const classCat = await db.classCategory.findUnique({ where: { slug: auth.user.classLevel }, select: { id: true } })
      if (classCat) classId = classCat.id
    }
  }
  const search = searchParams.get('search') || ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {
    status: 'PUBLISHED',
    isActive: true,
  }

  if (classId) {
    where.classId = classId
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [packages, total] = await Promise.all([
    db.mCQExamPackage.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: {
        class: {
          select: { id: true, name: true, slug: true },
        },
        examSets: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ scheduledDate: 'asc' }, { order: 'asc' }],
          select: {
            id: true,
            scheduledDate: true,
            startTime: true,
            endTime: true,
            duration: true,
            totalMarks: true,
            totalQuestions: true,
            order: true,
          },
        },
        _count: {
          select: {
            examSets: true,
            purchases: true,
          },
        },
      },
    }),
    db.mCQExamPackage.count({ where }),
  ])

  // ---- Batch-fetch subject names for all packages ----
  // Collect all unique subject IDs across all packages
  const allSubjectIds = new Set<string>()
  for (const pkg of packages) {
    for (const id of parseSubjectIds(pkg.subjectIds)) {
      if (id) allSubjectIds.add(id)
    }
  }

  // Fetch subjects in one batch query
  const subjectList = allSubjectIds.size > 0
    ? await db.subject.findMany({
        where: { id: { in: Array.from(allSubjectIds) } },
        select: { id: true, name: true },
      })
    : []
  const subjectMap = new Map(subjectList.map((s) => [s.id, s.name]))

  // ---- Enrich each package with subjects, examSetSummary, and totals ----
  const enrichedPackages = packages.map((pkg) => {
    // Parse subject IDs and resolve names
    const subjectIds = parseSubjectIds(pkg.subjectIds)
    const subjects = subjectIds
      .filter((id) => id)
      .map((id) => ({ id, name: subjectMap.get(id) || 'Unknown' }))

    // Build exam set summary (first 5)
    const examSetSummary = pkg.examSets.slice(0, 5).map((set) => ({
      scheduledDate: set.scheduledDate,
      startTime: set.startTime,
      endTime: set.endTime,
      duration: set.duration,
      totalMarks: set.totalMarks,
      totalQuestions: set.totalQuestions,
    }))

    // Calculate totals from ALL exam sets (not just first 5)
    const totalExamSets = pkg.examSets.length
    const totalMarks = pkg.examSets.reduce((sum, s) => sum + toDecimal(s.totalMarks), 0)
    const totalQuestions = pkg.examSets.reduce((sum, s) => sum + s.totalQuestions, 0)

    // Remove examSets from the output (we only fetched them for summary calculation)
    const { examSets: _examSets, ...pkgWithoutExamSets } = pkg

    return {
      ...pkgWithoutExamSets,
      subjects,
      examSetSummary,
      totalExamSets,
      totalMarks,
      totalQuestions,
    }
  })

  const response = NextResponse.json({
    success: true,
    data: {
      packages: enrichedPackages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  })
  // DO NOT cache this response — it contains user-specific purchase status
  // and must always reflect the latest data after admin edits.
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// ============================================================================
// 2. DETAIL — Single package with exam sets + purchase status for auth'd users
// ============================================================================

async function handleDetail(searchParams: URLSearchParams, request: NextRequest) {
  const id = searchParams.get('id')
  if (!id) {
    return apiError('প্যাকেজ ID প্রদান করুন', 400)
  }

  const pkg = await db.mCQExamPackage.findUnique({
    where: { id },
    include: {
      class: {
        select: { id: true, name: true, slug: true },
      },
      examSets: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ scheduledDate: 'asc' }, { order: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          duration: true,
          totalMarks: true,
          totalQuestions: true,
          marksPerQ: true,
          negativeMarks: true,
          instructions: true,
          status: true,
          order: true,
        },
      },
      _count: {
        select: {
          purchases: true,
        },
      },
    },
  })

  if (!pkg || pkg.status !== 'PUBLISHED' || !pkg.isActive) {
    return apiError('প্যাকেজ খুঁজে পাওয়া যায়নি', 404)
  }

    // Check purchase status for authenticated users
    let purchased = false
    let purchase: Record<string, unknown> | null = null
    let accessSource: 'direct_purchase' | 'course' | 'none' = 'none'

    const auth = await requireAuth(request)
    if (auth) {
      const access = await validateExamAccess(auth.user.id, id, 'mcq')
      if (access.hasAccess) {
        purchased = true
        accessSource = access.accessSource
        if (access.accessSource === 'direct_purchase') {
          const purchaseRecord = await db.mCQExamPackagePurchase.findUnique({
            where: { userId_packageId: { userId: auth.user.id, packageId: id } },
          })
          purchase = purchaseRecord as unknown as Record<string, unknown>
        }
      }
    }

  const response = NextResponse.json({
    success: true,
    data: {
      package: pkg,
      purchased,
      accessSource,
      purchase,
    },
  })
  // DO NOT cache — contains user-specific purchase status
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// ============================================================================
// 3. TAKE EXAM — Get exam set questions (requires auth + purchase)
// ============================================================================

async function handleTakeExam(searchParams: URLSearchParams, request: NextRequest) {
  const setId = searchParams.get('setId')
  if (!setId) {
    return apiError('সেট ID প্রদান করুন', 400)
  }

  // Require authentication
  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('পরীক্ষা দিতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Get the exam set with package info
  const examSet = await db.mCQExamSet.findUnique({
    where: { id: setId },
    include: {
      package: {
        select: {
          id: true,
          title: true,
          status: true,
          isActive: true,
        },
      },
    },
  })

  if (!examSet || examSet.status !== 'PUBLISHED') {
    return apiError('পরীক্ষার সেট খুঁজে পাওয়া যায়নি', 404)
  }

  // Check purchase — direct or course-granted
  const access = await validateExamAccess(auth.user.id, examSet.packageId, 'mcq')
  if (!access.hasAccess) {
    logger.warn('exam_access_denied', { userId: auth.user.id, packageId: examSet.packageId, reason: 'not_purchased' })
    return apiError('আপনি এই প্যাকেজটি কিনেননি', 403, 'NOT_PURCHASED')
  }

  const hasPurchase = access.hasAccess

  // ── Practice Mode ──
  // Purchased students can access in practice mode regardless of schedule.
  const isPracticeMode = hasPurchase && examSet.practiceMode
  if (isPracticeMode) {
    // Skip all time-window checks — start anytime, ignore end time.
    // Fall through to the result/attempt logic below.
  } else {
    // LIVE EXAM mode: enforce the scheduled time window.
    const { nowMs, examStartMs, effectiveEndMs } = getExamTimeWindow(examSet)
    if (nowMs < examStartMs) {
      const diffDays = Math.ceil((examStartMs - nowMs) / (1000 * 60 * 60 * 24))
      return apiError(`পরীক্ষা এখনো শুরু হয়নি। ${diffDays} দিন পর পরীক্ষা শুরু হবে।`, 400, 'EXAM_NOT_YET_AVAILABLE', { scheduledDate: examSet.scheduledDate, startTime: examSet.startTime })
    }

    if (nowMs > effectiveEndMs) {
      return apiError('পরীক্ষার সময় শেষ হয়েছে।', 400, 'EXAM_TIME_EXPIRED')
    }
  }

  // ── Attempt / Retake Logic ──
  // Get the latest result for this user + set
  let latestResult = await db.mCQExamSetResult.findFirst({
    where: { userId: auth.user.id, setId },
    orderBy: { attemptNumber: 'desc' },
  })
  const totalAttempts = await db.mCQExamSetResult.count({
    where: { userId: auth.user.id, setId },
  })

  // Practice mode: unlimited attempts unless maxAttempts is configured
  const canPracticeRetake = isPracticeMode && (examSet.allowUnlimitedAttempts || totalAttempts < (examSet.maxAttempts || Infinity))
  // Live mode retake: set-level allowRetake or admin-granted individual canRetake
  const canLiveRetake = !isPracticeMode && latestResult?.status === ('COMPLETED' as const) && (examSet.allowRetake || latestResult?.canRetake)

  // If we can start a new attempt (either practice retake or live retake), simply
  // advance the attemptNumber. Old results are kept for history.
  if (isPracticeMode && latestResult?.status === ('COMPLETED' as const) && canPracticeRetake) {
    // Fall through to create new attempt below — do NOT return old result
    latestResult = null // force new attempt creation
  } else if (!isPracticeMode && latestResult?.status === ('COMPLETED' as const) && canLiveRetake) {
    // Live retake: preserve old result, create a new attempt
    latestResult = null
  }

  // If completed and no retake allowed, return existing result for review
  if (latestResult && latestResult.status === ('COMPLETED' as const)) {
    // Get questions with answers for review
    const setQuestions = await db.mCQExamSetQuestion.findMany({
      where: { setId },
      orderBy: { order: 'asc' },
      include: {
        mcq: {
          select: {
            id: true,
            question: true,
            questionImage: true,
            optionA: true,
            optionAImage: true,
            optionB: true,
            optionBImage: true,
            optionC: true,
            optionCImage: true,
            optionD: true,
            optionDImage: true,
            correctAnswer: true,
            explanation: true,
            explanationImage: true,
            chapterId: true,
            chapter: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

  const questionsWithAnswers = setQuestions.map((sq) => ({
    id: sq.id,
    mcqId: sq.mcqId,
    question: sq.mcq.question,
    questionImage: sq.mcq.questionImage,
    optionA: sq.mcq.optionA,
    optionAImage: sq.mcq.optionAImage,
    optionB: sq.mcq.optionB,
    optionBImage: sq.mcq.optionBImage,
    optionC: sq.mcq.optionC,
    optionCImage: sq.mcq.optionCImage,
    optionD: sq.mcq.optionD,
    optionDImage: sq.mcq.optionDImage,
    correctAnswer: sq.mcq.correctAnswer,
    explanation: sq.mcq.explanation,
    explanationImage: sq.mcq.explanationImage,
    marks: sq.marks,
    order: sq.order,
    chapterId: sq.mcq.chapterId ?? null,
    chapterName: sq.mcq.chapter?.name ?? null,
  }))

    return NextResponse.json({
      success: true,
      data: {
        set: {
          id: examSet.id,
          title: examSet.title,
          description: examSet.description,
          scheduledDate: examSet.scheduledDate,
          startTime: examSet.startTime,
          endTime: examSet.endTime,
          duration: examSet.duration,
          marksPerQ: examSet.marksPerQ,
          negativeMarks: examSet.negativeMarks,
          totalMarks: examSet.totalMarks,
          totalQuestions: examSet.totalQuestions,
          instructions: examSet.instructions,
        },
        result: latestResult,
        questions: questionsWithAnswers,
        alreadyCompleted: true,
        timeRemaining: 0,
        practiceMode: isPracticeMode,
      },
    })
  }

  // Determine next attempt number
  const nextAttemptNumber = totalAttempts + 1

  // If in-progress, resume it
  if (latestResult && latestResult.status === 'IN_PROGRESS') {
    const setQuestions = await db.mCQExamSetQuestion.findMany({
      where: { setId },
      orderBy: { order: 'asc' },
      include: {
        mcq: {
          select: {
            id: true,
            question: true,
            questionImage: true,
            optionA: true,
            optionAImage: true,
            optionB: true,
            optionBImage: true,
            optionC: true,
            optionCImage: true,
            optionD: true,
            optionDImage: true,
          },
        },
      },
    })

    // Questions without correct answer or explanation during exam
    const questionsForExam = setQuestions.map((sq) => ({
      id: sq.id,
      mcqId: sq.mcqId,
      question: sq.mcq.question,
      questionImage: sq.mcq.questionImage,
      optionA: sq.mcq.optionA,
      optionAImage: sq.mcq.optionAImage,
      optionB: sq.mcq.optionB,
      optionBImage: sq.mcq.optionBImage,
      optionC: sq.mcq.optionC,
      optionCImage: sq.mcq.optionCImage,
      optionD: sq.mcq.optionD,
      optionDImage: sq.mcq.optionDImage,
      marks: sq.marks,
      order: sq.order,
    }))

    // Calculate time remaining
    const timeRemaining = calculateTimeRemaining(latestResult.startedAt, examSet.duration)

    return NextResponse.json({
      success: true,
      data: {
        set: {
          id: examSet.id,
          title: examSet.title,
          description: examSet.description,
          scheduledDate: examSet.scheduledDate,
          startTime: examSet.startTime,
          endTime: examSet.endTime,
          duration: examSet.duration,
          marksPerQ: examSet.marksPerQ,
          negativeMarks: examSet.negativeMarks,
          totalMarks: examSet.totalMarks,
          totalQuestions: examSet.totalQuestions,
          instructions: examSet.instructions,
        },
        questions: questionsForExam,
        result: {
          id: latestResult.id,
          status: latestResult.status,
          startedAt: latestResult.startedAt,
          answers: latestResult.answers,
        },
        timeRemaining: Math.max(0, timeRemaining),
        resuming: true,
        practiceMode: isPracticeMode,
      },
    })
  }

  // No existing result or starting new attempt — create an in-progress result
  const setQuestions = await db.mCQExamSetQuestion.findMany({
    where: { setId },
    orderBy: { order: 'asc' },
    include: {
      mcq: {
        select: {
          id: true,
          question: true,
          questionImage: true,
          optionA: true,
          optionAImage: true,
          optionB: true,
          optionBImage: true,
          optionC: true,
          optionCImage: true,
          optionD: true,
          optionDImage: true,
        },
      },
    },
  })

  let newResult: Awaited<ReturnType<typeof db.mCQExamSetResult.create>> | null = null
  try {
    newResult = await db.$transaction(async (tx) => {
      // Re-check attempt count atomically inside the transaction (TOCTOU prevention)
      const currentAttempts = await tx.mCQExamSetResult.count({
        where: { userId: auth.user.id, setId },
      })
      const currentAttemptNumber = currentAttempts + 1

      if (isPracticeMode && !examSet.allowUnlimitedAttempts && examSet.maxAttempts && examSet.maxAttempts > 0 && currentAttempts >= examSet.maxAttempts) {
        throw new Error('PRACTICE_LIMIT_REACHED')
      }

      return tx.mCQExamSetResult.create({
        data: {
          userId: auth.user.id,
          setId: setId,
          attemptNumber: currentAttemptNumber,
          practiceMode: isPracticeMode,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          answers: '{}',
          totalMarks: examSet.totalMarks,
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PRACTICE_LIMIT_REACHED') {
      return apiError('আপনার প্র্যাকটিসের সীমা শেষ হয়েছে', 403, 'PRACTICE_LIMIT_REACHED')
    }
    throw error
  }

  // Questions without correct answer or explanation during exam
  const questionsForExam = setQuestions.map((sq) => ({
    id: sq.id,
    mcqId: sq.mcqId,
    question: sq.mcq.question,
    questionImage: sq.mcq.questionImage,
    optionA: sq.mcq.optionA,
    optionAImage: sq.mcq.optionAImage,
    optionB: sq.mcq.optionB,
    optionBImage: sq.mcq.optionBImage,
    optionC: sq.mcq.optionC,
    optionCImage: sq.mcq.optionCImage,
    optionD: sq.mcq.optionD,
    optionDImage: sq.mcq.optionDImage,
    marks: sq.marks,
    order: sq.order,
  }))

  const timeRemaining = calculateTimeRemaining(newResult.startedAt, examSet.duration)

  logger.info('exam_start', { userId: auth.user.id, setId, attemptNumber: newResult.attemptNumber, practiceMode: isPracticeMode })

  return NextResponse.json({
    success: true,
    data: {
      set: {
        id: examSet.id,
        title: examSet.title,
        description: examSet.description,
        scheduledDate: examSet.scheduledDate,
        startTime: examSet.startTime,
        endTime: examSet.endTime,
        duration: examSet.duration,
        marksPerQ: examSet.marksPerQ,
        negativeMarks: examSet.negativeMarks,
        totalMarks: examSet.totalMarks,
        totalQuestions: examSet.totalQuestions,
        instructions: examSet.instructions,
      },
      questions: questionsForExam,
      result: {
        id: newResult.id,
        status: newResult.status,
        startedAt: newResult.startedAt,
        answers: newResult.answers,
      },
      timeRemaining: Math.max(0, timeRemaining),
      resuming: false,
      practiceMode: isPracticeMode,
    },
  })
}

// ============================================================================
// 3b. SAVE ANSWERS — Persist in-progress answers so they survive refresh
// ============================================================================

async function handleSaveAnswers(body: Record<string, unknown>, request: NextRequest) {
  const { resultId, answers } = body as {
    resultId?: string
    answers?: Record<string, string>
  }

  if (!resultId || !answers) {
    return apiError('resultId এবং answers প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('উত্তর সংরক্ষণ করতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Verify the result exists and belongs to this user
  const result = await db.mCQExamSetResult.findUnique({
    where: { id: resultId },
    select: { id: true, userId: true, status: true },
  })

  if (!result) {
    return apiError('ফলাফল খুঁজে পাওয়া যায়নি', 404)
  }

  if (result.userId !== auth.user.id) {
    return apiError('এই ফলাফল আপনার নয়', 403, 'FORBIDDEN')
  }

  // Only save answers for in-progress results
  if (result.status !== 'IN_PROGRESS') {
    return apiError('পরীক্ষা ইতিমধ্যে জমা দেওয়া হয়েছে', 400, 'ALREADY_SUBMITTED')
  }

  await db.mCQExamSetResult.update({
    where: { id: resultId },
    data: { answers: JSON.stringify(answers) },
  })

  return NextResponse.json({ success: true })
}

// ============================================================================
// 4. SUBMIT EXAM — Calculate scores and complete the result
// ============================================================================

async function handleSubmitExam(body: Record<string, unknown>, request: NextRequest) {
  const { setId, resultId, answers } = body as {
    setId?: string
    resultId?: string
    answers?: Record<string, string>
  }

  if (!setId || !resultId || !answers) {
    return apiError('setId, resultId এবং answers প্রদান করুন', 400)
  }

  // Require authentication
  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('পরীক্ষা জমা দিতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Get the result and verify ownership
  const result = await db.mCQExamSetResult.findUnique({
    where: { id: resultId },
  })

  if (!result) {
    return apiError('ফলাফল খুঁজে পাওয়া যায়নি', 404)
  }

  if (result.userId !== auth.user.id) {
    return apiError('এই ফলাফল আপনার নয়', 403, 'FORBIDDEN')
  }

  if (result.status !== ('IN_PROGRESS' as const)) {
    return apiError('এই পরীক্ষা ইতিমধ্যে জমা দেওয়া হয়েছে', 400, 'ALREADY_SUBMITTED')
  }

  // Verify the result belongs to the given setId
  if (result.setId !== setId) {
    return apiError('সেট ID ফলাফলের সাথে মিলছে না', 400)
  }

  // Get the exam set for scoring info
  const examSet = await db.mCQExamSet.findUnique({
    where: { id: setId },
    select: {
      id: true,
      duration: true,
      marksPerQ: true,
      negativeMarks: true,
      totalMarks: true,
      totalQuestions: true,
      practiceMode: true,
      reviewAnswers: true,
      showExplanations: true,
    },
  })

  if (!examSet) {
    return apiError('পরীক্ষার সেট খুঁজে পাওয়া যায়নি', 404)
  }

  // ── Authoritative time tracking (server-side) ──
  // The client sends a timeTaken value, but it must NOT be trusted: a user could
  // tamper with it to gain extra time. We compute elapsed seconds from the
  // server-recorded startedAt timestamp and clamp to the exam duration.
  const serverTimeTakenSeconds = result.startedAt
    ? Math.max(0, Math.floor((Date.now() - result.startedAt.getTime()) / 1000))
    : examSet.duration * 60
  const timeTaken = Math.min(serverTimeTakenSeconds, examSet.duration * 60)

  // Get all questions in the set with MCQ data
  const setQuestions = await db.mCQExamSetQuestion.findMany({
    where: { setId },
    orderBy: { order: 'asc' },
    include: {
      mcq: {
        select: {
          id: true,
          question: true,
          questionImage: true,
          optionA: true,
          optionAImage: true,
          optionB: true,
          optionBImage: true,
          optionC: true,
          optionCImage: true,
          optionD: true,
          optionDImage: true,
          correctAnswer: true,
          explanation: true,
          explanationImage: true,
          chapterId: true,
          subjectId: true,
          classLevel: true,
          difficulty: true,
        },
      },
    },
  })

  // Calculate scores
  let totalCorrect = 0
  let totalWrong = 0
  let totalSkipped = 0
  let marksObtained = 0

  for (const sq of setQuestions) {
    const userAnswer = answers[sq.mcqId]

    if (!userAnswer || userAnswer.trim() === '') {
      // Skipped
      totalSkipped++
    } else if (userAnswer.toUpperCase() === sq.mcq.correctAnswer.toUpperCase()) {
      // Correct
      totalCorrect++
      marksObtained += toDecimal(sq.marks)
    } else {
      // Wrong
      totalWrong++
      marksObtained -= toDecimal(examSet.negativeMarks)
    }
  }

    // Ensure marks don't go negative
    marksObtained = Math.max(0, marksObtained)

    // ── Derive totals from the ACTUAL questions in the set ──
    // The set's cached totalQuestions/totalMarks can drift from reality if an
    // admin edited questions after publish. Always grade and report against the
    // real question count/marks so the percentage denominator is correct.
    const actualTotalQuestions = setQuestions.length
    const actualTotalMarks = setQuestions.reduce(
      (sum, sq) => sum + toDecimal(sq.marks || 0),
      0
    )

    // Keep the set's cached totals consistent with the live questions.
    if (
      examSet.totalQuestions !== actualTotalQuestions ||
      toDecimal(examSet.totalMarks) !== actualTotalMarks
    ) {
      await db.mCQExamSet.update({
        where: { id: setId },
        data: {
          totalQuestions: actualTotalQuestions,
          totalMarks: actualTotalMarks,
        },
      })
    }

    // Update the result — answers must be a JSON string, not an object
    const updatedResult = await db.mCQExamSetResult.update({
      where: { id: resultId },
      data: {
        status: 'COMPLETED' as const,
        submittedAt: new Date(),
          answers: JSON.stringify(answers),
        totalCorrect,
        totalWrong,
        totalSkipped,
        marksObtained,
        totalMarks: actualTotalMarks,
        timeTaken: timeTaken || 0,
    },
  })

  logger.info('exam_submit', { userId: auth.user.id, setId, timeTaken: timeTaken || 0, totalMarks: actualTotalMarks })

  // Build questions with correctAnswer and explanation for review
  const questionsWithAnswers = setQuestions.map((sq) => ({
    id: sq.id,
    mcqId: sq.mcqId,
    question: sq.mcq.question,
    questionImage: sq.mcq.questionImage,
    optionA: sq.mcq.optionA,
    optionAImage: sq.mcq.optionAImage,
    optionB: sq.mcq.optionB,
    optionBImage: sq.mcq.optionBImage,
    optionC: sq.mcq.optionC,
    optionCImage: sq.mcq.optionCImage,
    optionD: sq.mcq.optionD,
    optionDImage: sq.mcq.optionDImage,
    correctAnswer: sq.mcq.correctAnswer,
    explanation: sq.mcq.explanation,
    explanationImage: sq.mcq.explanationImage,
    marks: sq.marks,
    order: sq.order,
  }))

  return NextResponse.json({
    success: true,
      data: {
        result: updatedResult,
        questions: questionsWithAnswers,
        reviewAnswers: examSet.reviewAnswers,
        showExplanations: examSet.showExplanations,
        practiceMode: result.practiceMode,
      },
  })
}

// ============================================================================
// 5. MY RESULTS — User's exam results/history
// ============================================================================

async function handleMyResults(searchParams: URLSearchParams, request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('ফলাফল দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  const userId = auth.user.id
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit
  const packageId = searchParams.get('packageId') || ''
  const sortBy = searchParams.get('sortBy') || 'recent'

  const where: Record<string, unknown> = { userId }
  if (packageId) {
    where.set = { packageId }
  }

  let orderBy: Record<string, string> = { startedAt: 'desc' }
  if (sortBy === 'date') orderBy = { startedAt: 'asc' }
  else if (sortBy === 'score') orderBy = { marksObtained: 'desc' }

  // Targeted aggregate queries (not paginated — these cover ALL results)
  const [totalExams, sumAgg, scoreRows, packageRows, trendRows] = await Promise.all([
    db.mCQExamSetResult.count({ where: { userId } }),
    db.mCQExamSetResult.aggregate({
      where: { userId },
      _sum: { totalCorrect: true, totalWrong: true },
    }),
    db.mCQExamSetResult.findMany({
      where: { userId },
      select: { marksObtained: true, totalMarks: true },
    }),
    db.mCQExamSetResult.findMany({
      where: { userId },
      select: {
        set: {
          select: {
            package: { select: { id: true, title: true } },
          },
        },
      },
    }),
    db.mCQExamSetResult.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        marksObtained: true,
        totalMarks: true,
        submittedAt: true,
        startedAt: true,
        set: { select: { title: true } },
      },
    }),
  ])

  const sumCorrect = sumAgg._sum.totalCorrect || 0
  const sumWrong = sumAgg._sum.totalWrong || 0
  const totalAttempted = sumCorrect + sumWrong

  let totalPercentage = 0
  let highestScore = 0
  for (const r of scoreRows) {
    const pct = toDecimal(r.totalMarks) > 0 ? (toDecimal(r.marksObtained) / toDecimal(r.totalMarks)) * 100 : 0
    totalPercentage += pct
    if (pct > highestScore) highestScore = pct
  }
  const avgScore = totalExams > 0 ? totalPercentage / totalExams : 0
  const accuracyRate = totalAttempted > 0 ? (sumCorrect / totalAttempted) * 100 : 0

  // Distinct packages from user results
  const packageMap = new Map<string, string>()
  for (const r of packageRows) {
    const pkg = r.set?.package
    if (pkg?.id) packageMap.set(pkg.id, pkg.title)
  }

  // Trend: last 10 results by date ascending
  const trend = trendRows
    .reverse()
    .map((r) => ({
      id: r.id,
      title: r.set?.title || 'পরীক্ষা',
      percentage: toDecimal(r.totalMarks) > 0 ? Math.round((toDecimal(r.marksObtained) / toDecimal(r.totalMarks)) * 100) : 0,
      date: r.submittedAt
        ? r.submittedAt.toISOString()
        : r.startedAt
        ? r.startedAt.toISOString()
        : '',
    }))

  const [results, total] = await Promise.all([
    db.mCQExamSetResult.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        set: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            duration: true,
            totalMarks: true,
            totalQuestions: true,
            package: {
              select: { id: true, title: true, thumbnail: true },
            },
          },
        },
      },
    }),
    db.mCQExamSetResult.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      aggregates: {
        totalExams,
        avgScore,
        highestScore,
        totalCorrect: sumCorrect,
        totalWrong: sumWrong,
        accuracyRate,
      },
      packages: Array.from(packageMap.entries()).map(([id, title]) => ({ id, title })),
      trend,
    },
  })
}

// ============================================================================
// 6. RESULT DETAIL — Single result with full question review
// ============================================================================

async function handleResultDetail(searchParams: URLSearchParams, request: NextRequest) {
  const resultId = searchParams.get('resultId')
  if (!resultId) {
    return apiError('ফলাফল ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('ফলাফল দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  const result = await db.mCQExamSetResult.findUnique({
    where: { id: resultId },
    include: {
      set: {
        select: {
          id: true,
          title: true,
          description: true,
          scheduledDate: true,
          duration: true,
          totalMarks: true,
          totalQuestions: true,
          marksPerQ: true,
          negativeMarks: true,
          instructions: true,
          practiceMode: true,
          reviewAnswers: true,
          showExplanations: true,
          package: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              class: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  })

  if (!result) {
    return apiError('ফলাফল খুঁজে পাওয়া যায়নি', 404)
  }

  if (result.userId !== auth.user.id) {
    return apiError('এই ফলাফল আপনার নয়', 403, 'FORBIDDEN')
  }

  // Get questions with correctAnswer and explanation
  const setQuestions = await db.mCQExamSetQuestion.findMany({
    where: { setId: result.setId },
    orderBy: { order: 'asc' },
    include: {
      mcq: {
        select: {
          id: true,
          question: true,
          questionImage: true,
          optionA: true,
          optionAImage: true,
          optionB: true,
          optionBImage: true,
          optionC: true,
          optionCImage: true,
          optionD: true,
          optionDImage: true,
          correctAnswer: true,
          explanation: true,
          explanationImage: true,
          chapterId: true,
          subjectId: true,
          chapter: {
            select: { id: true, name: true },
          },
        },
      },
    },
  })

  const questionsWithAnswers = setQuestions.map((sq) => ({
    id: sq.id,
    mcqId: sq.mcqId,
    question: sq.mcq.question,
    questionImage: sq.mcq.questionImage,
    optionA: sq.mcq.optionA,
    optionAImage: sq.mcq.optionAImage,
    optionB: sq.mcq.optionB,
    optionBImage: sq.mcq.optionBImage,
    optionC: sq.mcq.optionC,
    optionCImage: sq.mcq.optionCImage,
    optionD: sq.mcq.optionD,
    optionDImage: sq.mcq.optionDImage,
    correctAnswer: sq.mcq.correctAnswer,
    explanation: sq.mcq.explanation,
    explanationImage: sq.mcq.explanationImage,
    marks: sq.marks,
    order: sq.order,
  }))

  const resultData = {
    ...result,
    practiceMode: result.practiceMode,
    attemptNumber: result.attemptNumber,
  }

  return NextResponse.json({
    success: true,
    data: {
      result: resultData,
      questions: questionsWithAnswers,
      reviewAnswers: result.set.reviewAnswers,
      showExplanations: result.set.showExplanations,
    },
  })
}

// ============================================================================
// 7. WEAKNESS ANALYSIS — Subject/chapter-wise analysis for a package
// ============================================================================

async function handleWeaknessAnalysis(searchParams: URLSearchParams, request: NextRequest) {
  const packageId = searchParams.get('packageId')
  if (!packageId) {
    return apiError('প্যাকেজ ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('বিশ্লেষণ দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Check purchase or course access
  const access = await validateExamAccess(auth.user.id, packageId, 'mcq')
  if (!access.hasAccess) {
    return apiError('আপনি এই প্যাকেজটি কিনেননি', 403, 'NOT_PURCHASED')
  }

  // Get all sets in this package
  const sets = await db.mCQExamSet.findMany({
    where: { packageId },
    select: { id: true },
  })

  const setIds = sets.map((s) => s.id)

  // Get all completed results for these sets for this user
  const results = await db.mCQExamSetResult.findMany({
    where: {
      userId: auth.user.id,
      setId: { in: setIds },
      status: 'COMPLETED' as const,
    },
    select: {
      id: true,
      answers: true,
      setId: true,
    },
  })

  if (results.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        overallStats: {
          totalExams: 0,
          avgScore: 0,
          totalCorrect: 0,
          totalWrong: 0,
        },
        subjectWise: [],
        chapterWise: [],
      },
    })
  }

  // Aggregate overall stats from results
  const resultsWithDetails = await db.mCQExamSetResult.findMany({
    where: {
      userId: auth.user.id,
      setId: { in: setIds },
      status: 'COMPLETED' as const,
    },
    select: {
      totalCorrect: true,
      totalWrong: true,
      marksObtained: true,
      totalMarks: true,
    },
  })

  const totalExams = resultsWithDetails.length
  const totalCorrect = resultsWithDetails.reduce((sum, r) => sum + r.totalCorrect, 0)
  const totalWrong = resultsWithDetails.reduce((sum, r) => sum + r.totalWrong, 0)
  const avgScore = totalExams > 0
    ? resultsWithDetails.reduce((sum, r) => sum + (toDecimal(r.totalMarks) > 0 ? (toDecimal(r.marksObtained) / toDecimal(r.totalMarks)) * 100 : 0), 0) / totalExams
    : 0

  // Build a map of mcqId -> userAnswer from all results
  const answerMap: Record<string, string> = {}
  for (const result of results) {
    try {
      const parsed = (typeof result.answers === 'string' ? JSON.parse(result.answers) : result.answers) as Record<string, string>
      for (const [mcqId, answer] of Object.entries(parsed)) {
        answerMap[mcqId] = answer
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Get all MCQ IDs that appear in these sets
  const allSetQuestions = await db.mCQExamSetQuestion.findMany({
    where: { setId: { in: setIds } },
    include: {
      mcq: {
        select: {
          id: true,
          correctAnswer: true,
          subjectId: true,
          chapterId: true,
        },
      },
    },
  })

  // Subject-wise analysis
  const subjectStats: Record<string, { totalCorrect: number; totalWrong: number; total: number }> = {}
  // Chapter-wise analysis
  const chapterStats: Record<string, { totalCorrect: number; totalWrong: number; total: number }> = {}

  for (const sq of allSetQuestions) {
    const mcq = sq.mcq
    const userAnswer = answerMap[mcq.id]

    // Subject stats
    if (!subjectStats[mcq.subjectId]) {
      subjectStats[mcq.subjectId] = { totalCorrect: 0, totalWrong: 0, total: 0 }
    }
    subjectStats[mcq.subjectId].total++

    // Chapter stats
    if (!chapterStats[mcq.chapterId]) {
      chapterStats[mcq.chapterId] = { totalCorrect: 0, totalWrong: 0, total: 0 }
    }
    chapterStats[mcq.chapterId].total++

    if (userAnswer && userAnswer.trim() !== '') {
      if (userAnswer.toUpperCase() === mcq.correctAnswer.toUpperCase()) {
        subjectStats[mcq.subjectId].totalCorrect++
        chapterStats[mcq.chapterId].totalCorrect++
      } else {
        subjectStats[mcq.subjectId].totalWrong++
        chapterStats[mcq.chapterId].totalWrong++
      }
    }
    // Skipped questions are counted in total but not in correct/wrong
  }

  // Fetch subject names
  const subjectIds = Object.keys(subjectStats)
  const subjects = await db.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  })
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]))

  // Fetch chapter names
  const chapterIds = Object.keys(chapterStats)
  const chapters = await db.chapter.findMany({
    where: { id: { in: chapterIds } },
    select: { id: true, name: true },
  })
  const chapterNameMap = new Map(chapters.map((c) => [c.id, c.name]))

  // Build response
  const subjectWise = subjectIds.map((id) => {
    const stats = subjectStats[id]
    return {
      subjectId: id,
      subjectName: subjectNameMap.get(id) || 'Unknown',
      totalCorrect: stats.totalCorrect,
      totalWrong: stats.totalWrong,
      accuracy: stats.total > 0 ? Math.round((stats.totalCorrect / stats.total) * 100) : 0,
    }
  })

  const chapterWise = chapterIds.map((id) => {
    const stats = chapterStats[id]
    return {
      chapterId: id,
      chapterName: chapterNameMap.get(id) || 'Unknown',
      totalCorrect: stats.totalCorrect,
      totalWrong: stats.totalWrong,
      accuracy: stats.total > 0 ? Math.round((stats.totalCorrect / stats.total) * 100) : 0,
    }
  })

  // Sort by accuracy ascending (weakest first)
  subjectWise.sort((a, b) => a.accuracy - b.accuracy)
  chapterWise.sort((a, b) => a.accuracy - b.accuracy)

  return NextResponse.json({
    success: true,
    data: {
      overallStats: {
        totalExams,
        avgScore: Math.round(avgScore * 10) / 10,
        totalCorrect,
        totalWrong,
      },
      subjectWise,
      chapterWise,
    },
  })
}

// ============================================================================
// 8. CHECK PURCHASE — Check if user has purchased a package
// ============================================================================

async function handleCheckPurchase(searchParams: URLSearchParams, request: NextRequest) {
  const packageId = searchParams.get('packageId')
  if (!packageId) {
    return apiError('প্যাকেজ ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('ক্রয় অবস্থা দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  const access = await validateExamAccess(auth.user.id, packageId, 'mcq')

  const purchased = access.hasAccess
  const accessSource = access.accessSource

  let purchaseRecord = null
  if (purchased && access.accessSource === 'direct_purchase') {
    purchaseRecord = await db.mCQExamPackagePurchase.findUnique({
      where: { userId_packageId: { userId: auth.user.id, packageId } },
    })
  }

  // Check for pending payment in the Payment table
  let pendingPayment = false
  if (!purchased) {
    const pendingPay = await db.payment.findFirst({
      where: {
        userId: auth.user.id,
        contentType: 'mcq-exam-package',
        contentId: packageId,
        status: 'PENDING',
      },
      select: { id: true },
    })
    pendingPayment = !!pendingPay
  }

  return NextResponse.json({
    success: true,
    data: {
      purchased,
      accessSource,
      pendingPayment,
      purchase: purchased ? purchaseRecord : null,
    },
  })
}

// ============================================================================
// 9. LEADERBOARD — Leaderboard for a specific exam set
// ============================================================================

async function handleLeaderboard(searchParams: URLSearchParams, request: NextRequest) {
  const setId = searchParams.get('setId')
  if (!setId) {
    return apiError('সেট ID প্রদান করুন', 400)
  }

  // Require authentication
  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('লিডারবোর্ড দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Verify the exam set exists and is published
  const examSet = await db.mCQExamSet.findUnique({
    where: { id: setId },
    select: {
      id: true,
      title: true,
      totalMarks: true,
      totalQuestions: true,
      package: {
        select: {
          id: true,
          title: true,
          status: true,
          isActive: true,
        },
      },
    },
  })

  if (!examSet || examSet.package.status !== 'PUBLISHED' || !examSet.package.isActive) {
    return apiError('পরীক্ষার সেট খুঁজে পাওয়া যায়নি', 404)
  }

  // Get all completed results for this set, ordered by marksObtained descending
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const [results, total] = await Promise.all([
    db.mCQExamSetResult.findMany({
      where: {
        setId,
        status: 'COMPLETED' as const,
      },
      orderBy: [
        { marksObtained: 'desc' },
        { timeTaken: 'asc' }, // Tie-break: less time is better
      ],
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            classLevel: true,
          },
        },
      },
    }),
    db.mCQExamSetResult.count({
      where: {
        setId,
        status: 'COMPLETED' as const,
      },
    }),
  ])

  // Find current user's best completed result for ranking
  const userResult = await db.mCQExamSetResult.findFirst({
    where: { userId: auth.user.id, setId, status: 'COMPLETED' as const },
    orderBy: [{ marksObtained: 'desc' }, { timeTaken: 'asc' }],
    select: {
      id: true,
      marksObtained: true,
      timeTaken: true,
      status: true,
    },
  })

  let myRank: number | null = null
  if (userResult && userResult.status === ('COMPLETED' as const)) {
    // Count how many results have higher marksObtained, or same marks but less time
    const higherCount = await db.mCQExamSetResult.count({
      where: {
        setId,
        status: 'COMPLETED' as const,
        OR: [
          { marksObtained: { gt: userResult.marksObtained } },
          {
            marksObtained: userResult.marksObtained,
            timeTaken: { lt: userResult.timeTaken },
          },
        ],
      },
    })
    myRank = higherCount + 1
  }

  const leaderboard = results.map((r, index) => ({
    rank: skip + index + 1,
    user: {
      id: r.user.id,
      name: r.user.name || 'বেনামী ব্যবহারকারী',
      avatar: r.user.avatar,
      classLevel: r.user.classLevel,
    },
    marksObtained: r.marksObtained,
    totalMarks: r.totalMarks,
    totalCorrect: r.totalCorrect,
    totalWrong: r.totalWrong,
    timeTaken: r.timeTaken,
    submittedAt: r.submittedAt,
  }))

  return NextResponse.json({
    success: true,
    data: {
      set: {
        id: examSet.id,
        title: examSet.title,
        totalMarks: examSet.totalMarks,
        totalQuestions: examSet.totalQuestions,
      },
      leaderboard,
      myRank,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  })
}

// ============================================================================
// 10. EXAM SET STATUS — Status of each exam set for the current user
// ============================================================================

async function handleExamSetStatus(searchParams: URLSearchParams, request: NextRequest) {
  const packageId = searchParams.get('packageId')
  if (!packageId) {
    return apiError('প্যাকেজ ID প্রদান করুন', 400)
  }

  // Require authentication
  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('পরীক্ষার অবস্থা দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Get the package with its exam sets
  const pkg = await db.mCQExamPackage.findUnique({
    where: { id: packageId },
    include: {
      examSets: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ scheduledDate: 'asc' }, { order: 'asc' }],
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          duration: true,
          totalMarks: true,
          totalQuestions: true,
          allowRetake: true,
          practiceMode: true,
          allowUnlimitedAttempts: true,
          maxAttempts: true,
          reviewAnswers: true,
          showExplanations: true,
        },
      },
    },
  })

  if (!pkg || pkg.status !== 'PUBLISHED' || !pkg.isActive) {
    return apiError('প্যাকেজ খুঁজে পাওয়া যায়নি', 404)
  }

  // Get all results for this user for these sets
  const setIds = pkg.examSets.map((s) => s.id)

  const userResults = setIds.length > 0
    ? await db.mCQExamSetResult.findMany({
        where: {
          userId: auth.user.id,
          setId: { in: setIds },
        },
      })
    : []

  const resultMap = new Map(userResults.map((r) => [r.setId, r]))

  const attemptCounts = setIds.length > 0
    ? await db.mCQExamSetResult.groupBy({
        by: ['setId'],
        where: { userId: auth.user.id, setId: { in: setIds } },
        _count: { id: true },
      })
    : []
  const attemptCountMap = new Map(attemptCounts.map((r) => [r.setId, r._count.id]))

  // Fetch retake requests for this user's sets
  const retakeRequests = setIds.length > 0
    ? await db.mCQExamRetakeRequest.findMany({
        where: {
          userId: auth.user.id,
          setId: { in: setIds },
        },
      })
    : []

  const retakeRequestMap = new Map(retakeRequests.map((r) => [r.setId, r]))

  // Check purchase status for practice mode logic
  const access = await validateExamAccess(auth.user.id, packageId, 'mcq')
  const hasPurchase = access.hasAccess

  const setsWithStatus = pkg.examSets.map((set) => {
    const result = resultMap.get(set.id)
    const isPracticeMode = hasPurchase && set.practiceMode

    const { nowMs, examStartMs, effectiveEndMs } = getExamTimeWindow(set)
    const isExpired = nowMs > effectiveEndMs
    const isUpcoming = nowMs < examStartMs

    let status: 'completed' | 'not-started' | 'in-progress' | 'missed' | 'upcoming' | 'practice-available'

    if (result && result.status === ('COMPLETED' as const)) {
      status = 'completed'
    } else if (result && result.status === 'IN_PROGRESS') {
      status = 'in-progress'
    } else if (isUpcoming) {
      status = 'upcoming'
    } else if (isExpired && isPracticeMode) {
      // Purchased user + practice mode enabled: allow practice
      status = 'practice-available'
    } else if (isExpired) {
      status = 'missed'
    } else {
      status = 'not-started'
    }

    const retakeReq = retakeRequestMap.get(set.id)
    return {
      setId: set.id,
      title: set.title,
      scheduledDate: set.scheduledDate,
      startTime: set.startTime,
      endTime: set.endTime,
      duration: set.duration,
      totalMarks: set.totalMarks,
      totalQuestions: set.totalQuestions,
      status,
      allowRetake: set.allowRetake,
      canRetake: !!(result && result.canRetake),
      retakeRequestStatus: retakeReq?.status || null,
      practiceMode: isPracticeMode,
      practiceModeEnabled: set.practiceMode,
      allowUnlimitedAttempts: set.allowUnlimitedAttempts,
      maxAttempts: set.maxAttempts,
      reviewAnswers: set.reviewAnswers,
      showExplanations: set.showExplanations,
      totalAttempts: attemptCountMap.get(set.id) || 0,
      result: result
        ? {
            id: result.id,
            marksObtained: result.marksObtained,
            totalMarks: result.totalMarks,
            totalCorrect: result.totalCorrect,
            totalWrong: result.totalWrong,
            totalSkipped: result.totalSkipped,
            timeTaken: result.timeTaken,
            submittedAt: result.submittedAt,
            startedAt: result.startedAt,
            resultStatus: result.status,
          }
        : null,
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      packageId: pkg.id,
      packageTitle: pkg.title,
      sets: setsWithStatus,
    },
  })
}

// ============================================================================
// 11. CHECK RETAKE — Check if user can retake or has pending request
// ============================================================================

async function handleCheckRetake(searchParams: URLSearchParams, request: NextRequest) {
  const setId = searchParams.get('setId')
  if (!setId) {
    return apiError('সেট ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('চেক করতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Check exam set allowRetake + practice mode
  const examSet = await db.mCQExamSet.findUnique({
    where: { id: setId },
    select: { allowRetake: true, practiceMode: true, allowUnlimitedAttempts: true, maxAttempts: true },
  })

  // Check user purchase for practice mode
  let hasPurchase = false
  if (examSet?.practiceMode) {
    const examSetWithPackage = await db.mCQExamSet.findUnique({
      where: { id: setId },
      select: { packageId: true },
    })
    if (examSetWithPackage) {
      const access = await validateExamAccess(auth.user.id, examSetWithPackage.packageId, 'mcq')
      hasPurchase = access.hasAccess
    }
  }

  const isPracticeRetake = hasPurchase && examSet?.practiceMode

  // Check total attempts for practice mode
  const totalAttempts = await db.mCQExamSetResult.count({
    where: { userId: auth.user.id, setId },
  })

  // In practice mode: auto-allow retake if under limit
  if (isPracticeRetake) {
    const underLimit = examSet!.allowUnlimitedAttempts || totalAttempts < (examSet!.maxAttempts || Infinity)
    return NextResponse.json({
      success: true,
      data: {
        canRetake: underLimit,
        hasPendingRequest: false,
        hasApprovedRequest: true,
        requestStatus: 'approved',
        resultStatus: null,
        practiceMode: true,
        totalAttempts,
        allowUnlimitedAttempts: examSet!.allowUnlimitedAttempts,
        maxAttempts: examSet!.maxAttempts,
      },
    })
  }

  // Check individual canRetake on result (live mode)
  const result = await db.mCQExamSetResult.findFirst({
    where: { userId: auth.user.id, setId },
    orderBy: { attemptNumber: 'desc' },
    select: { canRetake: true, status: true },
  })

  // Check pending retake request
  const retakeRequest = await db.mCQExamRetakeRequest.findUnique({
    where: { userId_setId: { userId: auth.user.id, setId } },
  })

  return NextResponse.json({
    success: true,
    data: {
      canRetake: !!((result?.canRetake || examSet?.allowRetake) && result?.status === ('COMPLETED' as const)),
      hasPendingRequest: retakeRequest?.status === 'PENDING',
      hasApprovedRequest: retakeRequest?.status === 'APPROVED',
      requestStatus: retakeRequest?.status || null,
      resultStatus: result?.status || null,
      practiceMode: false,
    },
  })
}

// ============================================================================
// 12. MY RETAKE REQUESTS — Get user's retake requests for a package
// ============================================================================

async function handleMyRetakeRequests(searchParams: URLSearchParams, request: NextRequest) {
  const packageId = searchParams.get('packageId')
  if (!packageId) {
    return apiError('প্যাকেজ ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('অনুরোধ দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  const requests = await db.mCQExamRetakeRequest.findMany({
    where: {
      userId: auth.user.id,
      set: { packageId },
    },
    include: {
      set: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: { requests } })
}

// ============================================================================
// 13. REQUEST RETAKE — User requests retake for a completed exam set
// ============================================================================

async function handleRequestRetake(body: Record<string, unknown>, request: NextRequest) {
  const { setId, reason } = body as { setId?: string; reason?: string }

  if (!setId) {
    return apiError('সেট ID প্রদান করুন', 400)
  }

  const auth = await requireAuth(request)
  if (!auth) {
    return apiError('অনুরোধ করতে লগইন করুন', 401, 'UNAUTHORIZED')
  }

  // Validate set exists and is not soft-deleted
  const examSet = await db.mCQExamSet.findUnique({
    where: { id: setId },
    select: { id: true, status: true, package: { select: { id: true, deletedAt: true } } },
  })
  if (!examSet) {
    return apiError('এক্সাম সেটটি খুঁজে পাওয়া যায়নি', 404)
  }
  if (examSet.package.deletedAt || examSet.status === 'ARCHIVED') {
    return apiError('এই পরীক্ষাটি আর উপলব্ধ নেই', 400)
  }

  // Check if already requested
  const existing = await db.mCQExamRetakeRequest.findUnique({
    where: { userId_setId: { userId: auth.user.id, setId } },
  })

  if (existing) {
    if (existing.status === 'PENDING') {
      return apiError('ইতিমধ্যে একটি অনুরোধ জমা দেওয়া হয়েছে', 400)
    }
    if (existing.status === 'APPROVED') {
      return apiError('ইতিমধ্যে পুনরায় পরীক্ষার অনুমতি দেওয়া হয়েছে', 400)
    }
    // If rejected, allow re-request
    const updated = await db.mCQExamRetakeRequest.update({
      where: { id: existing.id },
      data: { status: 'PENDING', reason: reason || null, reviewedBy: null, reviewedAt: null },
    })
    return NextResponse.json({ success: true, data: { request: updated } })
  }

  const retakeRequest = await db.mCQExamRetakeRequest.create({
    data: {
      userId: auth.user.id,
      setId,
      reason: reason || null,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ success: true, data: { request: retakeRequest } })
}

// ============================================================================
// 13b. SET OVERVIEW — Combine detail + exam-set-status + my-retake-requests
// into a single request (avoids 3 separate round-trips on the detail page).
// ============================================================================

async function handleSetOverview(searchParams: URLSearchParams, request: NextRequest) {
  const [detailRes, statusRes, retakeRes] = await Promise.all([
    handleDetail(searchParams, request),
    handleExamSetStatus(searchParams, request),
    handleMyRetakeRequests(searchParams, request),
  ])

  const [detail, status, retake] = await Promise.all([
    detailRes.json(),
    statusRes.json(),
    retakeRes.json(),
  ])

  const response = NextResponse.json({
    // Only the package detail is mandatory; status/retake can legitimately
    // fail for guests (they require auth) without breaking the whole overview.
    success: detail.success,
    data: {
      package: detail.data?.package,
      purchased: detail.data?.purchased,
      accessSource: detail.data?.accessSource,
      examSetStatuses: status.success ? status.data?.sets : [],
      retakeRequests: retake.success ? retake.data?.requests : [],
    },
  })
  // DO NOT cache — contains user-specific purchase status and package price/premium data
  response.headers.set('Cache-Control', 'no-store')
  return response
}
