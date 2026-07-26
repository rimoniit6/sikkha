import { db } from '@/lib/db'
import { apiError, withCsrf } from '@/lib/api-utils'
import { verifyAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { toDecimal } from '@/lib/decimal'
import { validateExamAccess, getExamTimeWindow } from '@/features/shared/exam-engine'
import logger from '@/lib/logger'

function getMaxPracticeAttempts(set: { allowUnlimitedAttempts: boolean; maxAttempts: number | null }): number | null {
  if (set.allowUnlimitedAttempts) return null // unlimited
  if (set.maxAttempts != null && set.maxAttempts > 0) return set.maxAttempts
  return 0 // effectively blocked
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    
    // Get authenticated user (optional for public endpoints)
    const auth = await verifyAuth(request)
    const userId = auth?.user?.id

    // List available packages (public) - with pagination
    if (action === 'list') {
      let classSlug = searchParams.get('classSlug') || ''
      if (!classSlug && auth?.user?.learningMode === 'CLASS_BASED' && auth?.user?.classLevel) {
        classSlug = auth.user.classLevel
      }
      const search = searchParams.get('search') || ''
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

      const where: Record<string, unknown> = { status: 'PUBLISHED', isActive: true }
      if (classSlug) {
        where.class = { slug: classSlug }
      }
      if (search) {
        where.title = { contains: search, mode: 'insensitive' }
      }

      const [packages, total] = await Promise.all([
        db.cQExamPackage.findMany({
          where,
          include: {
            class: { select: { id: true, name: true, slug: true } },
            _count: { select: { examSets: true } },
          },
          orderBy: { order: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.cQExamPackage.count({ where }),
      ])

      const response = NextResponse.json({ success: true, data: { packages }, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
      // DO NOT cache — contains user-specific purchase status
      response.headers.set('Cache-Control', 'no-store')
      return response
    }

    // Package detail with sets
    if (action === 'detail') {
      const id = searchParams.get('id')
      if (!id) return apiError('Package ID required', 400)

      const pkg = await db.cQExamPackage.findUnique({
        where: { id },
        include: {
          class: { select: { id: true, name: true, slug: true } },
          examSets: {
            where: { status: 'PUBLISHED' },
            include: { _count: { select: { questions: true, submissions: true } } },
            orderBy: { order: 'asc' },
          },
          _count: { select: { purchases: true } },
        },
      })
      if (!pkg) return apiError('Package not found', 404)

      // Check if user has purchased - use authenticated user only
      let hasPurchased = false
      let hasPendingPayment = false
      let accessSource: 'direct_purchase' | 'course' | 'none' = 'none'
      if (userId) {
        const access = await validateExamAccess(userId, id, 'cq')
        if (access.hasAccess) {
          hasPurchased = true
          accessSource = access.accessSource
        }

        // Check for pending payment if not purchased
        if (!hasPurchased) {
          const pendingPay = await db.payment.findFirst({
            where: {
              userId,
              contentType: 'cq-exam-package',
              contentId: id,
              status: 'PENDING',
            },
            select: { id: true },
          })
          hasPendingPayment = !!pendingPay
        }
      }

      // Get user's submissions for this package (purchased OR free packages)
      let submissions: unknown[] = []
      if (userId && (hasPurchased || !pkg.isPremium)) {
        submissions = await db.cQExamSubmission.findMany({
          where: {
            userId,
            set: { packageId: id },
          },
          select: {
            id: true,
            setId: true,
            totalMarks: true,
            obtainedMarks: true,
            timeTaken: true,
            status: true,
            canRetake: true,
            attemptNumber: true,
            practiceMode: true,
            set: { select: { id: true, title: true, totalQuestions: true, totalMarks: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      // ── Enrich each exam set with practice availability ──
      const enrichedSets = pkg.examSets.map((set) => {
        const setSubmissions = submissions.filter((s: any) => s.setId === set.id)
        const totalAttempts = setSubmissions.length
        const maxAttempts = set.allowUnlimitedAttempts ? null : (set.maxAttempts && set.maxAttempts > 0 ? set.maxAttempts : null)
        const attemptLimitReached = maxAttempts !== null && totalAttempts >= maxAttempts

        return {
          ...set,
          practiceAvailability: hasPurchased && set.practiceMode
            ? attemptLimitReached
              ? 'limit-reached'
              : 'available'
            : 'unavailable',
          totalPracticeAttempts: totalAttempts,
          maxAttempts: maxAttempts,
          practiceMode: set.practiceMode,
        }
      })

      return NextResponse.json({ success: true, data: { package: { ...pkg, examSets: enrichedSets }, hasPurchased, accessSource, hasPendingPayment, submissions } })
    }

    // Check purchase status for a user - requires auth
    if (action === 'check-purchase') {
      const packageId = searchParams.get('packageId')
      if (!packageId) {
        return apiError('Package ID required', 400)
      }

      if (!userId) {
        return apiError('ক্রয় অবস্থা দেখতে লগইন করুন', 401, 'UNAUTHORIZED')
      }

      const access = await validateExamAccess(userId, packageId, 'cq')

      const purchased = access.hasAccess
      const accessSource = access.accessSource
      const purchaseRecord = purchased && access.accessSource === 'direct_purchase'
        ? await db.cQExamPackagePurchase.findUnique({
            where: { userId_packageId: { userId, packageId } },
          })
        : null

      // Check for pending payment
      let pendingPayment = false
      if (!purchased) {
        const pendingPay = await db.payment.findFirst({
          where: {
            userId,
            contentType: 'cq-exam-package',
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

    // User's retake requests for a package - requires auth
    if (action === 'my-retake-requests') {
      const packageId = searchParams.get('packageId')
      if (!userId || !packageId) return apiError('Package ID required', 400)

      const access = await validateExamAccess(userId, packageId, 'cq')
      if (!access.hasAccess) {
        return apiError('কোন রিটেক অনুরোধ পাওয়া যায়নি', 404, 'NO_RETAKE_REQUESTS')
      }

      const requests = await db.cQExamRetakeRequest.findMany({
        where: {
          userId,
          set: { packageId },
        },
        include: {
          set: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ success: true, data: { requests } })
    }

    // Get submission detail for user - requires auth
    if (action === 'my-submission') {
      const submissionId = searchParams.get('submissionId')
      if (!submissionId) return apiError('Submission ID required', 400)

      if (!userId) return apiError('লগইন প্রয়োজন', 401, 'UNAUTHORIZED')

      const submission = await db.cQExamSubmission.findUnique({
        where: { id: submissionId },
        include: {
          set: {
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  cq: {
                    include: { chapter: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
          answers: {
            include: { images: { orderBy: { order: 'asc' } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      if (!submission) return apiError('Submission not found', 404)

      // Verify submission belongs to authenticated user
      if (submission.userId !== userId) {
        return apiError('Unauthorized', 403)
      }

      // If showAnnotatedImages is false, strip annotations from answer images
      const showAnnotated = submission.set.showAnnotatedImages
      if (!showAnnotated) {
        const serialized = JSON.parse(JSON.stringify(submission))
        for (const answer of serialized.answers) {
          for (const image of answer.images) {
            delete image.annotations
          }
        }
        return NextResponse.json({ success: true, data: { submission: serialized } })
      }

      return NextResponse.json({ success: true, data: { submission } })
    }

    // Get set detail for user (requires auth + purchase for premium packages)
    if (action === 'set-detail') {
      const setId = searchParams.get('setId')
      if (!setId) return apiError('Set ID required', 400)

      if (!userId) {
        return apiError('লগইন প্রয়োজন', 401, 'UNAUTHORIZED')
      }

      const set = await db.cQExamSet.findUnique({
        where: { id: setId },
        include: {
          package: { select: { id: true, isPremium: true, status: true, isActive: true } },
          questions: {
            orderBy: { order: 'asc' },
            include: {
              cq: {
                include: { chapter: { select: { id: true, name: true } } },
              },
            },
          },
        },
      })
      if (!set) return apiError('Set not found', 404)
      if (set.status !== 'PUBLISHED') return apiError('পরীক্ষা সেটটি প্রকাশিত হয়নি', 404)

      if (set.package.isPremium) {
        const access = await validateExamAccess(userId, set.package.id, 'cq')
        if (!access.hasAccess) {
          return apiError('আপনি এই প্যাকেজটি কিনেননি। প্রথমে প্যাকেজটি কিনুন।', 403, 'NOT_PURCHASED')
        }
      }

      return NextResponse.json({ success: true, data: { set } })
    }

    return apiError('Unknown action', 400)
  } catch (error) {
    logger.error('CQ Exam API error', error, { route: 'cq-exam-packages', method: 'GET' })
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return apiError('লগইন প্রয়োজন', 401, 'UNAUTHORIZED')
    }
    const userId = auth.user.id

    const csrfCheck = await withCsrf(request)
    if ('error' in csrfCheck) return csrfCheck.error

    const body = await request.json()
    const { action } = body

    // Start exam attempt
    if (action === 'start-exam') {
      const { setId } = body
      if (!setId) return apiError('Set ID required', 400)

      // Get set details with package info
      const set = await db.cQExamSet.findUnique({
        where: { id: setId },
        include: {
          questions: true,
          package: { select: { id: true, isPremium: true, price: true, status: true, isActive: true } },
        },
      })
      if (!set) return apiError('Set not found', 404)
      if (set.status !== 'PUBLISHED') return apiError('পরীক্ষা সেটটি প্রকাশিত হয়নি', 404)

      // Check purchase for premium packages
      let hasPurchase = false
      if (set.package.isPremium) {
        const access = await validateExamAccess(userId, set.package.id, 'cq')
        hasPurchase = access.hasAccess
        if (!hasPurchase) {
          logger.warn('exam_access_denied', { userId, packageId: set.packageId, reason: 'not_purchased' })
          return apiError('আপনি এই প্যাকেজটি কিনেননি। প্রথমে প্যাকেজটি কিনুন।', 403)
        }
      }

      // ── Practice Mode ──
      // Purchased students can access in practice mode regardless of schedule.
      const isPracticeMode = hasPurchase && set.practiceMode
      if (isPracticeMode) {
        // Skip all time-window checks
      } else {
        // LIVE EXAM mode: enforce the scheduled time window.
        const { windowOpen } = getExamTimeWindow({ scheduledDate: set.scheduledDate, startTime: set.startTime, endTime: set.endTime })
        if (!windowOpen) {
          return apiError('পরীক্ষা এখনো শুরু হয়নি। নির্ধারিত সময়ে পরীক্ষা শুরু হবে।', 400)
        }
      }

      // Helper to create answer slots per question based on type
      const createAnswersForQuestions = (questions: typeof set.questions) => questions.flatMap((q) => {
        const qType = (q.type || 'cq').toLowerCase()
        if (qType === 'cq' || qType === 'typed') {
          let subMarks: number[] = []
          if (q.subMarks && Array.isArray(q.subMarks)) {
            subMarks = q.subMarks as number[]
          }
          const ans = Array.from({ length: 4 }, (_, si) => ({
            questionId: q.id,
            subIndex: si,
            maxMarks: subMarks[si] ?? toDecimal(q.marks) / 4,
            answerText: null,
            obtainedMarks: 0,
          }))
          ans.push({ questionId: q.id, subIndex: 4, maxMarks: 0, answerText: null, obtainedMarks: 0 })
          return ans
        }
        if (qType === 'fill-blanks') {
          let blanks: { id: string; marks: number }[] = []
          const cfg = q.config || {}; blanks = (cfg as any).blanks || []
          return blanks.map((blank, si) => ({
            questionId: q.id,
            subIndex: si,
            maxMarks: blank.marks || toDecimal(q.marks) / (blanks.length || 1),
            answerText: null,
            obtainedMarks: 0,
          }))
        }
        if (qType === 'written') {
          return [
            { questionId: q.id, subIndex: 0, maxMarks: q.marks, answerText: null, obtainedMarks: 0 },
            { questionId: q.id, subIndex: 1, maxMarks: 0, answerText: null, obtainedMarks: 0 },
          ]
        }
        // mcq-single, mcq-multiple: 1 slot
        return [
          { questionId: q.id, subIndex: 0, maxMarks: q.marks, answerText: null, obtainedMarks: 0 },
        ]
      })

      const createSubmissionWithAnswers = async (pm: boolean) => {
        const submission = await db.cQExamSubmission.create({
          data: {
            userId,
            setId,
            attemptNumber: nextAttempt,
            practiceMode: pm,
            totalMarks: set.totalMarks,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            answers: { create: createAnswersForQuestions(set.questions) },
          },
          include: {
            answers: {
              include: { images: true },
              orderBy: [{ questionId: 'asc' }, { subIndex: 'asc' }],
            },
          },
        })

        logger.info('exam_start', { userId, setId, attemptNumber: nextAttempt, practiceMode: pm })

        return NextResponse.json({ success: true, data: { submission, status: 'new', practiceMode: pm } }, { status: 201 })
      }

      // ── Attempt / Retake Logic ──
      const latestSubmission = await db.cQExamSubmission.findFirst({
        where: { userId, setId },
        orderBy: { attemptNumber: 'desc' },
      })
      const totalAttempts = await db.cQExamSubmission.count({
        where: { userId, setId },
      })
      const nextAttempt = totalAttempts + 1

      // ── Practice mode attempt limit ──
      const maxPracticeAttempts = getMaxPracticeAttempts(set)
      const canPracticeRetake = isPracticeMode && (
        maxPracticeAttempts === null || totalAttempts < maxPracticeAttempts
      )
      const canLiveRetake = !isPracticeMode && latestSubmission && (set.allowRetake || latestSubmission.canRetake)

      // Block if practice mode limit reached
      if (isPracticeMode && !canPracticeRetake && maxPracticeAttempts !== null && totalAttempts >= maxPracticeAttempts) {
        logger.warn('cq_practice_blocked', { userId, setId, packageId: set.packageId, totalAttempts, maxAllowed: maxPracticeAttempts })
        return apiError('আপনি এই CQ পরীক্ষার সর্বোচ্চ অনুমোদিত সংখ্যক অনুশীলন সম্পন্ন করেছেন।', 400, 'PRACTICE_LIMIT_REACHED')
      }

      // Practice mode: allow new attempt regardless of old results
      if (isPracticeMode && latestSubmission?.status === 'SUBMITTED' && canPracticeRetake) {
        return createSubmissionWithAnswers(true)
      }

      // Live retake: allow if set-level or admin-granted
      if (!isPracticeMode && latestSubmission && canLiveRetake) {
        return createSubmissionWithAnswers(false)
      }

      // Return existing in-progress submission
      if (latestSubmission && (latestSubmission.status === 'IN_PROGRESS')) {
        const submission = await db.cQExamSubmission.findUnique({
          where: { id: latestSubmission.id },
          include: {
            answers: {
              include: { images: true },
              orderBy: [{ questionId: 'asc' }, { subIndex: 'asc' }],
            },
          },
        })
        return NextResponse.json({ success: true, data: { submission, status: 'IN_PROGRESS', practiceMode: isPracticeMode } })
      }

      // Return already-submitted submission — let client redirect
      if (latestSubmission && latestSubmission.status === 'SUBMITTED') {
        const submission = await db.cQExamSubmission.findUnique({
          where: { id: latestSubmission.id },
          include: {
            answers: {
              include: { images: true },
              orderBy: [{ questionId: 'asc' }, { subIndex: 'asc' }],
            },
          },
        })
        return NextResponse.json({ success: true, data: { submission, status: 'SUBMITTED' } })
      }

      // Graded/published — reject unless practice mode retake (with limit check)
      if (latestSubmission && (latestSubmission.status === 'GRADED' || latestSubmission.status === 'PUBLISHED')) {
        if (isPracticeMode && !canPracticeRetake && maxPracticeAttempts !== null && totalAttempts >= maxPracticeAttempts) {
          logger.warn('cq_practice_blocked', { userId, setId, packageId: set.packageId, totalAttempts, maxAllowed: maxPracticeAttempts })
          return apiError('আপনি এই CQ পরীক্ষার সর্বোচ্চ অনুমোদিত সংখ্যক অনুশীলন সম্পন্ন করেছেন।', 400, 'PRACTICE_LIMIT_REACHED')
        }
        if (isPracticeMode && canPracticeRetake) {
          return createSubmissionWithAnswers(true)
        }
        return apiError('আপনার পরীক্ষা মূল্যায়ন সম্পন্ন হয়েছে। পুনরায় পরীক্ষা দিতে "রিটেক অনুরোধ" করুন।', 400, 'ALREADY_GRADED')
      }

      // Create submission with type-appropriate answer slots
      return createSubmissionWithAnswers(isPracticeMode)
    }

    // Helper: verify answer exists, submission is in progress, and owned by user
    async function assertOwnedAnswerInProgress(answerId: string, uid: string): Promise<string> {
      const ans = await db.cQExamAnswer.findUnique({
        where: { id: answerId },
        select: {
          submissionId: true,
          submission: { select: { status: true, userId: true } },
        },
      })
      if (!ans) throw new Error('Answer not found')
      if (ans.submission.userId !== uid) {
        throw new Error('Unauthorized')
      }
      if (ans.submission.status !== 'IN_PROGRESS') {
        throw new Error('পরীক্ষা ইতিমধ্যে জমা দেওয়া হয়েছে — উত্তর পরিবর্তন করা যাবে না')
      }
      return ans.submissionId
    }

    // Submit answer text
    if (action === 'save-answer') {
      const { answerId, answerText } = body
      if (!answerId) return apiError('Answer ID required', 400)
      await assertOwnedAnswerInProgress(answerId, userId)

      const answer = await db.cQExamAnswer.update({
        where: { id: answerId },
        data: { answerText },
      })

      return NextResponse.json({ success: true, data: { answer } })
    }

    // Add image to an answer
    if (action === 'add-image') {
      const { answerId, imageUrl } = body
      if (!answerId || !imageUrl) return apiError('Answer ID and image URL required', 400)
      await assertOwnedAnswerInProgress(answerId, userId)

      // Get the current max order for this answer
      const existingImages = await db.cQExamAnswerImage.findMany({
        where: { answerId },
        orderBy: { order: 'desc' },
        take: 1,
      })
      const nextOrder = existingImages.length > 0 ? existingImages[0].order + 1 : 0

      const image = await db.cQExamAnswerImage.create({
        data: {
          answerId,
          imageUrl,
          order: nextOrder,
        },
      })

      return NextResponse.json({ success: true, data: { image } }, { status: 201 })
    }

    // Remove image from an answer
    if (action === 'remove-image') {
      const { imageId } = body
      if (!imageId) return apiError('Image ID required', 400)

      // Look up the answer to check submission status and ownership
      const img = await db.cQExamAnswerImage.findUnique({
        where: { id: imageId },
        select: { answer: { select: { submissionId: true, submission: { select: { status: true, userId: true } } } } },
      })
      if (!img) return apiError('Image not found', 404)
      if (img.answer.submission.userId !== userId) {
        return apiError('Unauthorized', 403)
      }
      if (img.answer.submission.status !== 'IN_PROGRESS') {
        return apiError('পরীক্ষা ইতিমধ্যে জমা দেওয়া হয়েছে — ছবি পরিবর্তন করা যাবে না', 400)
      }

      await db.cQExamAnswerImage.delete({
        where: { id: imageId },
      })

      return NextResponse.json({ success: true })
    }

    // Request retake
    if (action === 'request-retake') {
      const { setId, reason } = body
      if (!setId) return apiError('Set ID required', 400)

      // Check if already requested
      const existing = await db.cQExamRetakeRequest.findUnique({
        where: { userId_setId: { userId, setId } },
      })
      if (existing) {
        if (existing.status === 'PENDING') {
          return apiError('ইতিমধ্যে একটি অনুরোধ জমা দেওয়া হয়েছে', 400)
        }
        if (existing.status === 'APPROVED') {
          return apiError('ইতিমধ্যে পুনরায় পরীক্ষার অনুমতি দেওয়া হয়েছে', 400)
        }
        // If rejected, allow re-request — build clean response, never leak admin data
        await db.cQExamRetakeRequest.update({
          where: { id: existing.id },
          data: { status: 'PENDING', reason: reason || null, reviewedBy: null, reviewedAt: null },
        })
        return NextResponse.json({ success: true, data: { request: { id: existing.id, userId, setId: existing.setId, status: 'PENDING', reason: reason || null, createdAt: existing.createdAt, updatedAt: new Date().toISOString() } } })
      }

      const request = await db.cQExamRetakeRequest.create({
        data: {
          userId,
          setId,
          reason: reason || null,
          status: 'PENDING',
        },
      })

      return NextResponse.json({ success: true, data: { request } })
    }

    // Submit exam
    if (action === 'submit-exam') {
      const { submissionId, timeTaken } = body
      if (!submissionId) return apiError('Submission ID required', 400)
      if (timeTaken !== undefined && (typeof timeTaken !== 'number' || timeTaken < 0 || timeTaken > 86400)) {
        return apiError('Invalid timeTaken value', 400)
      }

      const existing = await db.cQExamSubmission.findUnique({
        where: { id: submissionId },
        select: { status: true, userId: true },
      })
      if (!existing) return apiError('Submission not found', 404)
      if (existing.userId !== userId) {
        return apiError('Unauthorized', 403)
      }
      if (existing.status !== 'IN_PROGRESS') {
        return apiError('পরীক্ষা ইতিমধ্যে জমা দেওয়া হয়েছে', 400)
      }

      const submission = await db.cQExamSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'SUBMITTED',
          timeTaken: timeTaken || 0,
          submittedAt: new Date(),
        },
      })

      logger.info('exam_submit', { userId, setId: submission.setId, timeTaken: timeTaken || 0, totalMarks: submission.totalMarks })

      return NextResponse.json({ success: true, data: { submission, message: 'আপনার উত্তর জমা দেওয়া হয়েছে। শিক্ষক উত্তর মূল্যায়ন করে ফলাফল প্রকাশ করবেন।' } })
    }

    return apiError('Unknown action', 400)
  } catch (error) {
    logger.error('CQ Exam POST error', error, { route: 'cq-exam-packages', method: 'POST' })
    return apiError('Internal server error', 500)
  }
}
