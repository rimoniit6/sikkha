'use client'

import { useEffect,useState } from 'react'

import { PurchaseStatusBadge } from '@/components/shared/PurchaseStatusBadge'
import PurchaseLockOverlay from '@/components/shared/PurchaseLockOverlay'
import PurchaseOptionsModal from '@/components/shared/PurchaseOptionsModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import ContentBlockEditor,{ ContentBlock,deserializeBlocks } from '@/components/ui/content-block-editor'
import { downloadPdf,getFilenameFromUrl } from '@/lib/pdf-download'
import { getSuggestionFromCache } from '@/lib/suggestion-cache'
import { useAuthUser } from '@/store/auth'
import { useRouterStore, useRouteParams } from '@/store/router'
import {
ArrowLeft,
BookOpen,
CheckCircle2,
Clock,
Crown,
Download,
Eye,
FileText,
GraduationCap,
Lightbulb
} from 'lucide-react'

interface SuggestionData {
  id: string
  title: string
  content: string | null
  thumbnail: string | null
  pdfUrl: string | null
  classId: string | null
  subjectId: string | null
  chapterId: string | null
  isPremium: boolean
  price: number | null
  isActive: boolean
  order: number
  viewCount: number
  slug: string
  className?: string
  subjectName?: string
  chapterName?: string
  createdAt: string
}

export default function SuggestionDetailPage() {
  const params = useRouteParams()
  const navigate = useRouterStore((s) => s.navigate)
  const goBack = useRouterStore((s) => s.goBack)
  const user = useAuthUser()
  const [suggestionData, setSuggestionData] = useState<SuggestionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [paymentStatus, setPaymentStatus] = useState<{
    purchased: boolean
    pendingPayment: boolean
    rejected: boolean
    checked: boolean
  }>({ purchased: false, pendingPayment: false, rejected: false, checked: false })
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)

  const isPremiumUser = user?.isPremium && !!user?.premiumExpiry && new Date(user.premiumExpiry) > new Date()
  const isPremiumContent = suggestionData?.isPremium ?? false
  const isLocked = isPremiumContent && !isPremiumUser && !paymentStatus.purchased

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const id = params.suggestionId || ''
        if (!id) throw new Error('No ID')

        // Try to get from cache first
        const cached = getSuggestionFromCache<Partial<SuggestionData> & { id: string }>(id)

        const res = await fetch(`/api/suggestions/${id}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()

        // Merge cached info (class/subject names) if available
        const merged = cached
          ? { ...data, className: data.className || cached.className, subjectName: data.subjectName || cached.subjectName, chapterName: data.chapterName || cached.chapterName }
          : data

        setSuggestionData(merged)

        // Parse content blocks
        if (merged.content) {
          try {
            const parsed = deserializeBlocks(merged.content)
            if (parsed.length > 0 && parsed[0].id) {
              setBlocks(parsed)
            }
          } catch {
            // not block content
          }
        }
      } catch {
        // Set fallback data from cache
        const id = params.suggestionId || ''
        const cached = getSuggestionFromCache(id)
        if (cached) {
          setSuggestionData(cached as SuggestionData)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.suggestionId, user?.id])

  // Check payment status when suggestion data is loaded and content is premium
  useEffect(() => {
    if (!suggestionData?.isPremium || !suggestionData?.id) return

    const checkPayment = async () => {
      try {
        const searchParams = new URLSearchParams({
          contentType: 'suggestion',
          contentId: suggestionData.id,
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
  }, [suggestionData?.isPremium, suggestionData?.id, user?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-muted/50 animate-pulse" />
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="h-8 bg-muted/50 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted/50 rounded animate-pulse w-1/2" />
          <div className="h-64 bg-muted/50 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!suggestionData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4 border border-border/50">
          <Lightbulb className="w-7 h-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-1">সাজেশন খুঁজে পাওয়া যায়নি</h3>
        <p className="text-sm text-muted-foreground mb-4">এই সাজেশনটি আর উপলব্ধ নেই</p>
        <Button variant="outline" onClick={goBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          ফিরে যান
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 px-4 py-2">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{suggestionData.title}</p>
              {isPremiumContent && paymentStatus.purchased && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-[10px] px-1.5 py-0 shrink-0">
                  <CheckCircle2 className="size-3" />
                  কেনা
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lightbulb className="w-3 h-3" />
              <span>সাজেশন</span>
              {suggestionData.viewCount > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Eye className="w-3 h-3" />
                    {suggestionData.viewCount}
                  </span>
                </>
              )}
            </div>
          </div>
          {isPremiumContent && !paymentStatus.purchased && !isPremiumUser && (
            <PurchaseStatusBadge size="sm" />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb / Navigation */}
        {(suggestionData.className || suggestionData.subjectName || suggestionData.chapterName) && (
          <div className="animate-fade-in-up flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <button
              className="hover:text-foreground transition-colors flex items-center gap-1"
              onClick={() => navigate('suggestions')}
            >
              <Lightbulb className="w-3 h-3" />
              সাজেশন
            </button>
            {suggestionData.className && (
              <>
                <span>/</span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  {suggestionData.className}
                </span>
              </>
            )}
            {suggestionData.subjectName && (
              <>
                <span>/</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {suggestionData.subjectName}
                </span>
              </>
            )}
            {suggestionData.chapterName && (
              <>
                <span>/</span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {suggestionData.chapterName}
                </span>
              </>
            )}
          </div>
        )}

        {/* Title Section */}
        <div className="animate-fade-in-up mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight mb-2">{suggestionData.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {suggestionData.className && (
                  <Badge variant="outline" className="text-xs gap-1 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400">
                    <GraduationCap className="w-3 h-3" />
                    {suggestionData.className}
                  </Badge>
                )}
                {suggestionData.subjectName && (
                  <Badge variant="outline" className="text-xs gap-1 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                    <BookOpen className="w-3 h-3" />
                    {suggestionData.subjectName}
                  </Badge>
                )}
                {suggestionData.chapterName && (
                  <Badge variant="outline" className="text-xs gap-1 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400">
                    <FileText className="w-3 h-3" />
                    {suggestionData.chapterName}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs gap-1">
                  <Eye className="w-3 h-3" />
                  {suggestionData.viewCount} ভিউ
                </Badge>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(suggestionData.createdAt).toLocaleDateString('bn-BD')}
                </Badge>
              </div>
            </div>
          </div>

          {/* Premium badge + price - show for locked content */}
          {isPremiumContent && isLocked && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-300/30" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">প্রিমিয়াম কন্টেন্ট</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  {suggestionData.price ? `মূল্য: ৳${suggestionData.price}` : 'পেমেন্ট করুন'}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-1.5 shadow-lg shadow-amber-500/20"
                onClick={() => setShowPurchaseModal(true)}
              >
                <Crown className="w-3.5 h-3.5" />
                কেনার অপশন দেখুন
              </Button>
            </div>
          )}

          {/* Purchased badge - show for purchased content */}
          {isPremiumContent && paymentStatus.purchased && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">কেনা কন্টেন্ট</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  আপনি এই সাজেশনটি কিনেছেন, সম্পূর্ণ দেখতে পারবেন
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1">
                <CheckCircle2 className="size-3" />
                কেনা
              </Badge>
            </div>
          )}

          {/* Pending payment badge */}
          {isPremiumContent && paymentStatus.pendingPayment && !paymentStatus.purchased && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">পেমেন্ট অপেক্ষমাণ</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  আপনার পেমেন্ট যাচাই করা হচ্ছে, অনুমোদিত হলে কন্টেন্ট দেখতে পারবেন
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1">
                <Clock className="size-3" />
                অপেক্ষমাণ
              </Badge>
            </div>
          )}

          {/* PDF Download */}
          {suggestionData.pdfUrl && !isLocked && (
            <Card className="mt-3 border-dashed">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">PDF ডাউনলোড</p>
                  <p className="text-xs text-muted-foreground">অফলাইনে পড়ার জন্য ডাউনলোড করুন</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadPdf(suggestionData.pdfUrl!, getFilenameFromUrl(suggestionData.pdfUrl!))}>
                  <Download className="w-4 h-4" />
                  ডাউনলোড
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Content Section */}
        <div className="animate-fade-in-up delay-150">
          {isLocked ? (
            <PurchaseLockOverlay
              purchased={paymentStatus.purchased}
              pendingPayment={paymentStatus.pendingPayment}
              rejected={paymentStatus.rejected}
              price={suggestionData.price || 0}
              contentType="suggestion"
              contentId={suggestionData.id}
              contentTitle={suggestionData.title}
              classLevel={suggestionData.className}
              title="এটি একটি প্রিমিয়াম কন্টেন্ট"
              description={suggestionData.price
                ? `পুরো সাজেশনটি দেখতে ৳${suggestionData.price} পেমেন্ট করুন`
                : 'পুরো সাজেশনটি দেখতে পেমেন্ট করুন'
              }
              onUpgrade={() => navigate('payment', {
                contentType: 'suggestion',
                contentId: suggestionData.id,
                contentTitle: suggestionData.title,
                contentPrice: String(suggestionData.price || 0),
              })}
            >
              {/* Blurred preview of content */}
              {blocks.length > 0 && (
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <ContentBlockEditor blocks={blocks} onChange={() => {}} previewMode />
                </div>
              )}
            </PurchaseLockOverlay>
          ) : blocks.length > 0 ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ContentBlockEditor blocks={blocks} onChange={() => {}} previewMode />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">এই সাজেশনে এখনো কন্টেন্ট যোগ করা হয়নি</p>
            </div>
          )}
        </div>

        {/* Back to suggestions */}
        <div className="animate-fade-in delay-300 mt-8 pt-6 border-t">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('suggestions')}
          >
            <ArrowLeft className="w-4 h-4" />
            সকল সাজেশন দেখুন
          </Button>
        </div>
      </div>

      {/* Purchase Options Modal */}
      {isPremiumContent && suggestionData && (
        <PurchaseOptionsModal
          open={showPurchaseModal}
          onOpenChange={setShowPurchaseModal}
          contentType="suggestion"
          contentId={suggestionData.id}
          contentTitle={suggestionData.title}
          contentPrice={suggestionData.price || 0}
          classLevel={suggestionData.className}
        />
      )}
    </div>
  )
}
