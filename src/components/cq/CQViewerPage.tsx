'use client'

import BookmarkButton from '@/components/shared/BookmarkButton'
import PurchaseLockOverlay from '@/components/shared/PurchaseLockOverlay'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import SafeImage from '@/components/ui/safe-image'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchCsrfToken } from '@/lib/api-client'
import { getMessages } from '@/lib/messages'
import { useAuthUser } from '@/store/auth'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateLearningCaches } from '@/lib/invalidate-learning-caches'
import { useRouterStore, useRouteParams } from '@/store/router'
import { AnimatePresence,motion } from 'framer-motion'
import { ArrowLeft,BookOpen,CheckCircle2,Eye,EyeOff,FileDown,Printer } from 'lucide-react'
import { useEffect,useState } from 'react'

interface CQQuestion {
  id: string
  label: string // ক, খ, গ, ঘ — from API
  number: number
  text: string
  marks: number // ক=১, খ=২, গ=৩, ঘ=৪
  answer: string
  questionImage?: string | null
  answerImage?: string | null
}

interface CQData {
  id: string
  uddeepok: string
  uddeepokImage?: string | null
  questions: CQQuestion[]
  chapterName: string
  subjectName: string
  className: string
  classSlug: string
  subjectId: string
  subjectSlug: string
  chapterId: string
  chapterSlug: string
  isPremium: boolean
  price: number
  year?: string
  board?: string
}

export default function CQViewerPage() {
  const params = useRouteParams()
  const navigate = useRouterStore((s) => s.navigate)
  const goBack = useRouterStore((s) => s.goBack)
  const source = params.source || ''
  const paramYear = params.year || ''
  const paramBoard = params.boardName || ''
  const user = useAuthUser()
  const queryClient = useQueryClient()
  const msg = getMessages()
  const [cqData, setCqData] = useState<CQData | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set())
  const [paymentStatus, setPaymentStatus] = useState<{
    purchased: boolean
    pendingPayment: boolean
    rejected: boolean
    checked: boolean
  }>({ purchased: false, pendingPayment: false, rejected: false, checked: false })
  const [_isBookmarked, setIsBookmarked] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let cqId = params.cqId
        // If no cqId provided, try to fetch the first CQ
        if (!cqId) {
          try {
            // Try chapterId first, then subjectId as fallback
            const filterParam = params.chapterId
              ? `chapterId=${params.chapterId}`
              : params.subjectId
                ? `subjectId=${params.subjectId}`
                : ''
            if (filterParam) {
              const listRes = await fetch(`/api/cq?${filterParam}&limit=1`)
              if (listRes.ok) {
                const listData = await listRes.json()
                const cqs = listData.data?.cqs || listData.cqs || listData.questions || listData
                if (Array.isArray(cqs) && cqs.length > 0) {
                  cqId = cqs[0].id
                }
              }
            }
          } catch {
            // Continue without cqId
          }
        }
        if (!cqId) {
          setCqData(null)
          return
        }
        const res = await fetch(`/api/cq/${cqId}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setCqData(data.data)

        // Record recently viewed & update progress
        if (user?.id && data.data?.id) {
          const csrfToken = await fetchCsrfToken()

          fetch('/api/recently-viewed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentId: data.data.id,
              contentType: 'cq',
              title: `${data.data.chapterName} - সৃজনশীল প্রশ্ন`,
              _csrf: csrfToken,
            }),
          }).then((rvRes) => {
            if (rvRes.ok) invalidateLearningCaches(queryClient)
          }).catch((err) => {
            console.error('[CQViewer] Failed to record recently viewed:', err)
          })

          // Auto-update progress to at least 5% when opening
          fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentId: data.data.id,
              contentType: 'cq',
              progress: 5,
              _csrf: csrfToken,
            }),
          }).then((pRes) => {
            if (pRes.ok) invalidateLearningCaches(queryClient)
          }).catch((err) => {
            console.error('[CQViewer] Failed to update progress:', err)
          })
        }
      } catch {
        setCqData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.cqId, params.chapterId, params.subjectId, params.classSlug, user?.id])

  // Check payment status when CQ data is loaded and content is premium
  useEffect(() => {
    if (!cqData?.isPremium || !cqData?.id) return

    const checkPayment = async () => {
      try {
        const searchParams = new URLSearchParams({
          contentType: 'cq',
          contentId: cqData.id,
        })
        if (user?.id) {
          searchParams.set('userId', user.id)
        }
        const res = await fetch(`/api/payment/check?${searchParams}`)
        if (res.ok) {
          const result = await res.json()
          const data = result.data || result
          setPaymentStatus({
            purchased: data.purchased || false,
            pendingPayment: data.pendingPayment || false,
            rejected: data.rejected || false,
            checked: true,
          })
        } else {
          setPaymentStatus({ purchased: false, pendingPayment: false, rejected: false, checked: true })
        }
      } catch {
        setPaymentStatus({ purchased: false, pendingPayment: false, rejected: false, checked: true })
      }
    }

    checkPayment()
  }, [cqData?.isPremium, cqData?.id, user?.id])

  const toggleAnswer = (questionId: string) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-32 bg-gradient-to-r from-amber-500 to-amber-600" />
        <div className="max-w-3xl mx-auto px-4 -mt-10">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-48 rounded-xl mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl mb-3" />
          ))}
        </div>
      </div>
    )
  }

  if (!cqData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-32 bg-gradient-to-r from-amber-500 to-amber-600" />
        <div className="flex-1 flex items-center justify-center px-4 -mt-16">
          <div className="text-center max-w-md">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">সৃজনশীল প্রশ্ন পাওয়া যায়নি</h2>
            <p className="text-muted-foreground mb-4">{msg.cqComingSoon}</p>
            <Button variant="outline" className="gap-2" onClick={goBack}>
              <ArrowLeft className="size-4" />
              ফিরে যান
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isPremiumContent = cqData.isPremium
  const isPremiumUser = user?.isPremium && !!user?.premiumExpiry && new Date(user.premiumExpiry) > new Date()
  // Non-logged-in = free user: premium content requires purchase
  const isLocked = isPremiumContent && !isPremiumUser && !paymentStatus.purchased
  const totalMarks = cqData.questions?.reduce((sum, q) => sum + q.marks, 0) || 0

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-32 sm:h-40 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
        {/* Back button */}
        <div className="absolute top-3 left-3 z-20">
          <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" onClick={() => {
            if (source === 'board' && paramYear && paramBoard) {
              navigate('board-questions', { year: paramYear, boardName: paramBoard, classLevel: params.classLevel || '' })
            } else {
              goBack()
            }
          }}>
            <ArrowLeft className="size-5" />
          </Button>
        </div>
        <div className="relative z-10 flex items-center justify-between h-full px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center flex-1"
          >
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">সৃজনশীল প্রশ্ন</h1>
              {isPremiumContent && paymentStatus.purchased && (
                <Badge className="bg-emerald-500/90 text-white gap-1 text-xs">
                  <CheckCircle2 className="size-3" />
                  কেনা
                </Badge>
              )}

            </div>
              <p className="text-amber-100 text-sm mt-1">
               {cqData.chapterName}{totalMarks > 0 ? ` • মোট নম্বর: ${totalMarks}` : ''}
             </p>
          </motion.div>
          <BookmarkButton
            contentId={cqData.id}
            contentType="cq"
            contentTitle={`${cqData.chapterName} - সৃজনশীল প্রশ্ন`}
            size="icon"
            variant="ghost"
            className="text-white/70 hover:text-amber-200 hover:bg-white/10 shrink-0"
            onToggle={(b) => setIsBookmarked(b)}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('home')}>হোম</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('class-detail', { classSlug: cqData.classSlug })}>
                {cqData.className}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('subject-detail', { subjectId: cqData.subjectId, classSlug: cqData.classSlug, subjectSlug: cqData.subjectSlug })}>
                {cqData.subjectName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('chapter-detail', { chapterId: cqData.chapterId, subjectId: cqData.subjectId, classSlug: cqData.classSlug, subjectSlug: cqData.subjectSlug, chapterSlug: cqData.chapterSlug })}>
                {cqData.chapterName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>সৃজনশীল প্রশ্ন</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Uddeepok / Passage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="size-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-amber-700 dark:text-amber-400">উদ্দীপক</h3>
                {cqData.year && (
                  <Badge variant="secondary" className="text-xs">{cqData.year}</Badge>
                )}
                {cqData.board && (
                  <Badge variant="secondary" className="text-xs">{cqData.board} বোর্ড</Badge>
                )}
              </div>
              <RichContentRenderer content={cqData.uddeepok} className="text-sm leading-relaxed" />
              {cqData.uddeepokImage && (
                <SafeImage src={cqData.uddeepokImage} alt="উদ্দীপক চিত্র" className="mt-3 max-w-full rounded-lg border max-h-64" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Premium Lock for entire CQ */}
        {isLocked ? (
          <div className="mt-6">
            <PurchaseLockOverlay
              purchased={paymentStatus.purchased}
              pendingPayment={paymentStatus.pendingPayment}
              rejected={paymentStatus.rejected}
              price={cqData.price}
              contentType="cq"
              contentId={cqData.id}
              contentTitle={`সৃজনশীল প্রশ্ন - ${cqData.chapterName}`}
              classLevel={cqData.classSlug}
              title="প্রিমিয়াম সৃজনশীল প্রশ্ন"
              description={cqData.price > 0
                ? `এই সৃজনশীল প্রশ্নটি দেখতে ৳${cqData.price} পেমেন্ট করুন`
                : 'এই সৃজনশীল প্রশ্নটি দেখতে পেমেন্ট করুন'
              }
              onUpgrade={() => navigate('payment', {
                contentType: 'cq',
                contentId: cqData.id,
                contentTitle: `সৃজনশীল প্রশ্ন - ${cqData.chapterName}`,
                contentPrice: String(cqData.price),
              })}
            >
              {/* Blurred preview of questions */}
              {cqData.questions && cqData.questions.length > 0 && (
                <div className="blur-md pointer-events-none select-none opacity-50 space-y-4">
                  {cqData.questions.map((question) => (
                    <Card key={question.id} className="border-border/50">
                      <CardContent className="p-5 sm:p-6">
                        <div className="flex items-start gap-3 mb-4">
                          <Badge variant="outline" className="font-mono shrink-0 mt-0.5">
                            {question.label}
                          </Badge>
                          <div className="flex-1">
                            <RichContentRenderer content={question.text} className="text-base font-medium leading-relaxed" />
                            {question.questionImage && (
                              <SafeImage src={question.questionImage} alt="প্রশ্ন চিত্র" className="mt-2 max-w-full rounded-lg border max-h-40" />
                            )}
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {question.marks} নম্বর
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </PurchaseLockOverlay>
          </div>
        ) : (
          /* Questions - accessible */
          <div className="mt-6 space-y-4">
            {/* কেনা badge for purchased content */}
            {isPremiumContent && paymentStatus.purchased && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30"
              >
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">এই কন্টেন্টটি আপনি কিনেছেন</span>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 ml-auto text-xs">
                  <CheckCircle2 className="size-3" />
                  কেনা
                </Badge>
              </motion.div>
            )}

            {cqData.questions?.map((question, index) => {
              const isRevealed = revealedAnswers.has(question.id)
              return (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card className="relative border-border/50 overflow-hidden">
                    <CardContent className="p-5 sm:p-6">
                      {/* Question Header - Label, Text, and Marks in one line */}
                      <div className="flex items-start gap-3 mb-4">
                        <Badge variant="outline" className="font-mono shrink-0 mt-0.5 min-w-[28px] text-center">
                          {question.label}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <RichContentRenderer content={question.text} className="text-base font-medium leading-relaxed" />
                          {question.questionImage && (
                            <SafeImage src={question.questionImage} alt="প্রশ্ন চিত্র" className="mt-2 max-w-full rounded-lg border max-h-40" />
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {question.marks} নম্বর
                          </Badge>
                        </div>
                      </div>

                      {/* Show Answer Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => toggleAnswer(question.id)}
                      >
                        {isRevealed ? (
                          <>
                            <EyeOff className="size-4" />
                            উত্তর লুকান
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" />
                            উত্তর দেখুন
                          </>
                        )}
                      </Button>

                      {/* Answer */}
                      <AnimatePresence>
                        {isRevealed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Separator className="my-3" />
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 mr-2 inline-block">উত্তর:</span>
                              <RichContentRenderer content={question.answer} className="text-sm leading-relaxed inline" />
                              {question.answerImage && (
                                <SafeImage src={question.answerImage} alt="উত্তর চিত্র" className="mt-2 max-w-full rounded-lg border max-h-48" />
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Action Buttons */}
        {!isLocked && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.print()}
            >
              <Printer className="size-4" />
              প্রিন্ট করুন
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                // Use the browser's print-to-PDF feature
                // This opens the print dialog where users can save as PDF
                window.print()
              }}
            >
              <FileDown className="size-4" />
              PDF ডাউনলোড
            </Button>
            <Button
              variant="ghost"
              className="gap-2 ml-auto"
              onClick={() => {
                if (source === 'board' && paramYear && paramBoard) {
                  navigate('board-questions', { year: paramYear, boardName: paramBoard, classLevel: params.classLevel || '' })
                } else {
                  goBack()
                }
              }}
            >
              <ArrowLeft className="size-4" />
              ফিরে যান
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
