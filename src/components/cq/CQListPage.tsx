'use client'

import PurchaseOptionsModal from '@/components/shared/PurchaseOptionsModal'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import SafeImage from '@/components/ui/safe-image'
import { Skeleton } from '@/components/ui/skeleton'
import { getMessages } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/store/auth'
import { useRouterStore, useRouteParams } from '@/store/router'
import { AnimatePresence,motion } from 'framer-motion'
import {
AlertCircle,
ArrowLeft,
BookOpen,
CheckCircle2,
Crown,
Eye,
FileText,
Lock,
} from 'lucide-react'
import { useCallback,useEffect,useMemo,useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────

interface CQListItem {
  id: string
  uddeepok: string
  uddeepokImage?: string | null
  questionCount: number
  isPremium: boolean
  price: number
  difficulty: string
  board: string | null
  year: string | null
  chapterId: string
  chapterSlug: string
  chapterName: string
  subjectName: string
  className: string
  classSlug: string
  subjectId: string
  subjectSlug: string
}

interface PurchaseStatus {
  purchased: boolean
  pendingPayment: boolean
}

// ─── Main Component ─────────────────────────────────────────────

export default function CQListPage() {
  const params = useRouteParams()
  const navigate = useRouterStore((s) => s.navigate)
  const goBack = useRouterStore((s) => s.goBack)
  const user = useAuthUser()
  const msg = getMessages()

  // Route params
  const chapterId = params.chapterId || ''
  const subjectId = params.subjectId || ''
  const classSlug = params.classSlug || ''

  // Data states
  const [cqList, setCqList] = useState<CQListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [apiCounts, setApiCounts] = useState<{ total: number; freeCount: number; premiumCount: number }>({ total: 0, freeCount: 0, premiumCount: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20
  const [chapterInfo, setChapterInfo] = useState<{ name: string; subjectName: string; className: string } | null>(null)
  const [subjectInfo, setSubjectInfo] = useState<{ name: string; className: string } | null>(null)

  // Purchase
  const [purchaseMap, setPurchaseMap] = useState<Record<string, PurchaseStatus>>({})
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseModalData, setPurchaseModalData] = useState<{
    contentType: string; contentId: string; contentTitle: string; contentPrice: number; classLevel: string
  } | null>(null)

  // ─── Fetch CQ list ────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Hierarchy-based query: chapterId > subjectId > classLevel
        // Never combine classLevel with subjectId/chapterId — classLevel values
        // in CQ records may be inconsistent, causing wrong counts
        const queryParams = new URLSearchParams({ type: 'list', page: '1', limit: String(PAGE_SIZE) })
        if (chapterId) {
          queryParams.set('chapterId', chapterId)
        } else if (subjectId) {
          queryParams.set('subjectId', subjectId)
        } else if (classSlug) {
          queryParams.set('classLevel', classSlug)
        }

        const res = await fetch(`/api/cq?${queryParams}`)
        if (res.ok) {
          const data = await res.json()
          setCqList(data.data?.cqs || [])
          setCurrentPage(1)
          setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1))
          setApiCounts({
            total: data.data?.total || 0,
            freeCount: data.data?.freeCount || 0,
            premiumCount: data.data?.premiumCount || 0,
          })
        } else {
          setCqList([])
          setApiCounts({ total: 0, freeCount: 0, premiumCount: 0 })
          setHasMore(false)
        }

        // Fetch context info
        if (chapterId) {
          try {
            const chapterRes = await fetch(`/api/chapters/${chapterId}`)
            if (chapterRes.ok) {
              const chapterData = await chapterRes.json()
              setChapterInfo({
                name: chapterData.name || '',
                subjectName: chapterData.subjectName || '',
                className: chapterData.className || '',
              })
            }
          } catch { /* ignore */ }
        } else if (subjectId) {
          try {
            const subjectRes = await fetch(`/api/subjects/${subjectId}`)
            if (subjectRes.ok) {
              const subjectData = await subjectRes.json()
              setSubjectInfo({
                name: subjectData.name || '',
                className: subjectData.className || '',
              })
            }
          } catch { /* ignore */ }
        }
      } catch {
        setCqList([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [chapterId, subjectId, classSlug])

  // ─── Batch check purchase status ───────────────────────────
  // Both non-logged-in and logged-in users use the same batch-check path

  useEffect(() => {
    if (cqList.length === 0) return

    const premiumItems = cqList.filter(q => q.isPremium)
    if (premiumItems.length === 0) return

    const checkPurchases = async () => {
      try {
        const res = await fetch('/api/payment/batch-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: premiumItems.map(q => ({
              contentType: 'cq',
              contentId: q.id,
            })),
          }),
        })
        if (res.ok) {
          const result = await res.json()
          const data = result.data || result
          const items = data.items || []
          const newMap: Record<string, PurchaseStatus> = {}
          for (const item of items) {
            newMap[item.contentId] = {
              purchased: item.purchased || false,
              pendingPayment: item.pendingPayment || false,
            }
          }
          setPurchaseMap(newMap)
        }
      } catch {
        // Silently fail — premium items will show as locked
      }
    }
    checkPurchases()
  }, [cqList])

  // ─── Derived data ──────────────────────────────────────────

  const isPremiumUser = user?.isPremium && !!user?.premiumExpiry && new Date(user.premiumExpiry) > new Date()

  const _isLocked = useCallback((q: CQListItem) => q.isPremium && !isPremiumUser && !purchaseMap[q.id]?.purchased, [isPremiumUser, purchaseMap])
  const isPending = useCallback((q: CQListItem) => q.isPremium && purchaseMap[q.id]?.pendingPayment, [purchaseMap])

  const { freeCqs, purchasedCqs, lockedCqs } = useMemo(() => {
    const free: CQListItem[] = []
    const purchased: CQListItem[] = []
    const locked: CQListItem[] = []

    for (const q of cqList) {
      if (!q.isPremium || isPremiumUser) {
        free.push(q)
      } else if (purchaseMap[q.id]?.purchased) {
        purchased.push(q)
      } else {
        locked.push(q)
      }
    }
    return { freeCqs: free, purchasedCqs: purchased, lockedCqs: locked }
  }, [cqList, isPremiumUser, purchaseMap])

  // ─── Page title ────────────────────────────────────────────

  // Extract slugs from CQ data for breadcrumb navigation
  const subjectSlug = cqList[0]?.subjectSlug || ''
  const chapterSlug = cqList[0]?.chapterSlug || ''

  const pageTitle = chapterId
    ? `${chapterInfo?.name || 'অধ্যায়'} - সৃজনশীল প্রশ্ন`
    : subjectId
    ? `${subjectInfo?.name || 'বিষয়'} - সৃজনশীল প্রশ্ন`
    : 'সৃজনশীল প্রশ্ন'

  const pageSubtitle = chapterId
    ? chapterInfo?.subjectName || ''
    : subjectId
    ? subjectInfo?.className || ''
    : ''

  // ─── Handlers ─────────────────────────────────────────────

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      const queryParams = new URLSearchParams({ type: 'list', page: String(nextPage), limit: String(PAGE_SIZE) })
      if (chapterId) {
        queryParams.set('chapterId', chapterId)
      } else if (subjectId) {
        queryParams.set('subjectId', subjectId)
      } else if (classSlug) {
        queryParams.set('classLevel', classSlug)
      }

      const res = await fetch(`/api/cq?${queryParams}`)
      if (res.ok) {
        const data = await res.json()
        setCqList(prev => [...prev, ...(data.data?.cqs || [])])
        setCurrentPage(nextPage)
        setHasMore(nextPage < (data.pagination?.totalPages || 1))
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setLoadingMore(false)
    }
  }

  const handleViewCQ = (cq: CQListItem) => {
    navigate('cq-viewer', {
      cqId: cq.id,
      chapterId: cq.chapterId || chapterId,
      subjectId: cq.subjectId || subjectId,
      classSlug: cq.classSlug || classSlug,
    })
  }

  const handleLockedClick = (q: CQListItem) => {
    setPurchaseModalData({
      contentType: 'cq',
      contentId: q.id,
      contentTitle: q.uddeepok.slice(0, 80) + (q.uddeepok.length > 80 ? '...' : ''),
      contentPrice: q.price,
      classLevel: q.classSlug,
    })
    setPurchaseModalOpen(true)
  }

  const handleBack = () => {
    goBack()
  }

  // ─── Helpers ──────────────────────────────────────────────

  const toBengaliNum = (n: number) => n.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)])

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'hard': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    }
  }

  const getDifficultyLabel = (d: string) => {
    switch (d) {
      case 'easy': return 'সহজ'
      case 'hard': return 'কঠিন'
      default: return 'মাঝারি'
    }
  }

  // ─── CQ Card renderer ────────────────────────────────────

  const renderCQCard = (cq: CQListItem, idx: number, variant: 'free' | 'purchased' | 'locked') => {
    const pending = isPending(cq)
    const locked = variant === 'locked'

    const variantStyles = {
      free: {
        accent: 'bg-green-500',
        badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400',
        badgeIcon: <Eye className="size-3" />,
        badgeText: 'ফ্রি',
        iconBg: 'bg-green-50 dark:bg-green-950/30',
        iconColor: 'text-green-600 dark:text-green-400',
      },
      purchased: {
        accent: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
        badgeIcon: <CheckCircle2 className="size-3" />,
        badgeText: 'কেনা',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      },
      locked: {
        accent: 'bg-amber-500',
        badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
        badgeIcon: pending ? <AlertCircle className="size-3" /> : <Lock className="size-3" />,
        badgeText: pending ? 'অপেক্ষমাণ' : 'প্রিমিয়াম',
        iconBg: 'bg-amber-50 dark:bg-amber-950/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
      },
    }

    const style = variantStyles[variant]

    return (
      <motion.div
        key={cq.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: idx * 0.02, duration: 0.2 }}
      >
        <Card
          className={cn(
            'group cursor-pointer hover:shadow-md transition-all relative overflow-hidden',
            locked && 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10',
            variant === 'purchased' && 'border-emerald-200 dark:border-emerald-800',
          )}
          onClick={() => locked && !pending ? handleLockedClick(cq) : handleViewCQ(cq)}
        >
          <div className={cn('absolute left-0 top-0 bottom-0 w-1', style.accent)} />
          {/* Badge */}
          <div className="absolute top-2 right-2 z-10">
            <Badge className={cn('text-xs gap-1', style.badge)}>
              {style.badgeIcon} {style.badgeText}
            </Badge>
          </div>
          <CardContent className="p-4 pl-5">
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-lg shrink-0', style.iconBg)}>
                <FileText className={cn('size-5', style.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                {/* Uddeepok preview */}
                {locked ? (
                  <RichContentRenderer
                    content={cq.uddeepok.slice(0, 80) + (cq.uddeepok.length > 80 ? '...' : '')}
                    className="font-medium text-sm leading-relaxed line-clamp-2 pr-16 text-foreground/60"
                  />
                ) : (
                  <>
                    <RichContentRenderer
                      content={cq.uddeepok}
                      className="font-medium text-sm leading-relaxed line-clamp-2 pr-16"
                    />
                    {cq.uddeepokImage && (
                      <SafeImage src={cq.uddeepokImage} alt="উদ্দীপক চিত্র" className="mt-2 max-w-full rounded-lg border max-h-32" />
                    )}
                  </>
                )}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {cq.chapterName && (
                    <>
                      <BookOpen className={cn('size-3', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
                      <span className={cn('text-xs', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')}>{cq.chapterName}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge className={cn('text-[10px] px-1.5', getDifficultyColor(cq.difficulty))}>
                    {getDifficultyLabel(cq.difficulty)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {toBengaliNum(cq.questionCount)}টি প্রশ্ন
                  </Badge>
                  {cq.year && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{cq.year}</Badge>
                  )}
                  {cq.board && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{cq.board}</Badge>
                  )}
                  {locked && cq.price > 0 && !pending && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                      ৳{cq.price}
                    </Badge>
                  )}
                </div>
                {/* Buy button for locked */}
                {locked && !pending && (
                  <Button
                    size="sm"
                    className="mt-2 gap-1 text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={(e) => { e.stopPropagation(); handleLockedClick(cq) }}
                  >
                    <Lock className="size-3" /> ৳{cq.price} - কিনুন
                  </Button>
                )}
                {/* View button for free/purchased */}
                {!locked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1 text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); handleViewCQ(cq) }}
                  >
                    <Eye className="size-3" /> দেখুন
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ─── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-32 sm:h-40 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500" />
        <div className="max-w-4xl mx-auto px-4 -mt-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (cqList.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-md">
          <FileText className="size-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">{msg.noQuestionsFound}</p>
          <p className="text-sm text-muted-foreground mb-4">{msg.cqComingSoon}</p>
          <Button variant="outline" onClick={handleBack}>ফিরে যান</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-32 sm:h-40 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.12),transparent)]" />
        <div className="relative z-10 flex items-center h-full max-w-5xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 -ml-2" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{pageTitle}</h1>
              {pageSubtitle && <p className="text-amber-100 text-sm mt-0.5">{pageSubtitle}</p>}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('home')}>হোম</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {classSlug && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('class-detail', { classSlug })}>
                    {chapterInfo?.className || subjectInfo?.className || classSlug}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            {(subjectId || chapterInfo?.subjectName) && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => navigate('subject-detail', { subjectId: subjectId || '', classSlug, subjectSlug })}
                  >
                    {chapterInfo?.subjectName || subjectInfo?.name || 'বিষয়'}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            {chapterId && chapterInfo?.name && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => navigate('chapter-detail', { chapterId, subjectId, classSlug, subjectSlug, chapterSlug })}
                  >
                    {chapterInfo.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>সৃজনশীল প্রশ্ন</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Stats Summary */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {freeCqs.length > 0 && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1 px-3 py-1 text-sm">
              <BookOpen className="size-3.5" />
              ফ্রি {toBengaliNum(freeCqs.length)}টি
            </Badge>
          )}
          {purchasedCqs.length > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 px-3 py-1 text-sm">
              <CheckCircle2 className="size-3.5" />
              কেনা {toBengaliNum(purchasedCqs.length)}টি
            </Badge>
          )}
          {lockedCqs.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1 px-3 py-1 text-sm">
              <Lock className="size-3.5" />
              প্রিমিয়াম {toBengaliNum(lockedCqs.length)}টি
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            মোট {toBengaliNum(cqList.length)}টি সৃজনশীল প্রশ্ন
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 pb-8">
        {/* ──── Free CQs Section ──── */}
        {freeCqs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                ফ্রি সৃজনশীল প্রশ্ন ({toBengaliNum(freeCqs.length)}টি)
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {freeCqs.map((cq, idx) => renderCQCard(cq, idx, 'free'))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ──── Purchased Premium CQs Section ──── */}
        {purchasedCqs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-2.5 rounded-full bg-emerald-500" />
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                কেনা প্রিমিয়াম সৃজনশীল প্রশ্ন ({toBengaliNum(purchasedCqs.length)}টি)
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {purchasedCqs.map((cq, idx) => renderCQCard(cq, idx, 'purchased'))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ──── Locked Premium CQs Section ──── */}
        {lockedCqs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="size-2.5 rounded-full bg-amber-500" />
              <Crown className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                প্রিমিয়াম সৃজনশীল প্রশ্ন ({toBengaliNum(lockedCqs.length)}টি)
              </span>
            </div>

            {/* Premium summary card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3"
            >
              <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 shrink-0">
                      <Crown className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                        {toBengaliNum(lockedCqs.length)}টি প্রিমিয়াম সৃজনশীল প্রশ্ন আটকে আছে
                      </h3>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                        কিনলে সম্পূর্ণ সমাধান দেখতে পাবেন
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                      onClick={() => {
                        if (lockedCqs.length > 0) {
                          handleLockedClick(lockedCqs[0])
                        }
                      }}
                    >
                      <Lock className="size-3.5" />
                      কিনুন
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Locked CQ list with preview */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {lockedCqs.map((cq, idx) => renderCQCard(cq, idx, 'locked'))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 min-w-48"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  লোড হচ্ছে...
                </>
              ) : (
                <>
                  আরও দেখুন
                  <span className="text-xs text-muted-foreground">
                    ({cqList.length}/{toBengaliNum(apiCounts.total)})
                  </span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Purchase Options Modal */}
      {purchaseModalData && (
        <PurchaseOptionsModal
          open={purchaseModalOpen}
          onOpenChange={setPurchaseModalOpen}
          contentType={purchaseModalData.contentType}
          contentId={purchaseModalData.contentId}
          contentTitle={purchaseModalData.contentTitle}
          contentPrice={purchaseModalData.contentPrice}
          classLevel={purchaseModalData.classLevel}
        />
      )}
    </div>
  )
}
