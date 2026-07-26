'use client'

import BookmarkButton from '@/components/shared/BookmarkButton'
import NoteEditor from '@/components/shared/NoteEditor'
import PremiumLock from '@/components/shared/PremiumLock'
import ReadingSettingsPanel from '@/components/lecture/ReadingSettingsPanel'
import LocalNoteDrawer from '@/components/lecture/LocalNoteDrawer'
import ImageLightbox from '@/components/lecture/ImageLightbox'
import { useReadingSettings } from '@/hooks/use-reading-settings'
import { useReadingSession } from '@/hooks/use-reading-session'
import { useLocalNotes } from '@/hooks/use-local-notes'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card,CardContent } from '@/components/ui/card'
import ContentBlockEditor,{ deserializeBlocks } from '@/components/ui/content-block-editor'
import { headingsFromBlocks } from '@/components/ui/content-block-types'
import { Progress } from '@/components/ui/progress'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import SafeImage from '@/components/ui/safe-image'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet,SheetContent,SheetHeader,SheetTitle,SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchCsrfToken } from '@/lib/api-client'
import { downloadPdf,getFilenameFromUrl } from '@/lib/pdf-download'
import { useAuthUser } from '@/store/auth'
import { useRouterStore, useRouteParams } from '@/store/router'
import {
ArrowLeft,ArrowRight,
BookOpen,
CheckCircle2,
Clock,
Crown,
Download,
FileText,
ListTree,
Lock,
Menu,Play,
StickyNote,
X
} from 'lucide-react'
import { useEffect,useRef,useState } from 'react'

interface LectureNavItem {
  id: string
  title: string
  number: number
  isCompleted: boolean
  isCurrent: boolean
}

interface LectureData {
  id: string
  title: string
  content: string
  videoUrl: string | null
  pdfUrl: string | null
  thumbnail: string | null
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
  progress: number
  lectures: LectureNavItem[]
  currentIndex: number
  resources: { name: string; url: string; type: string }[]
}

export default function LectureViewerPage() {
  const params = useRouteParams()
  const navigate = useRouterStore((s) => s.navigate)
  const goBack = useRouterStore((s) => s.goBack)
  const user = useAuthUser()
  const [lectureData, setLectureData] = useState<LectureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showVideo, setShowVideo] = useState(true)
  const [showPdf, setShowPdf] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<{
    purchased: boolean
    pendingPayment: boolean
    rejected: boolean
    checked: boolean
  }>({ purchased: false, pendingPayment: false, rejected: false, checked: false })
  const [_isBookmarked, setIsBookmarked] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [tocOpen, setTocOpen] = useState(false)
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([])
  const [headerHidden, setHeaderHidden] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const lastSentProgress = useRef(0)
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lectureIdRef = useRef<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { settings, updateSettings, contentClassName } = useReadingSettings()
  const { sessionSeconds, totalSeconds, lastOpened, formatTime, formatDate } = useReadingSession(lectureData?.id ?? null)
  const { notes: localNotes, loaded: localNotesLoaded, addNote: addLocalNote, updateNote: updateLocalNote, deleteNote: deleteLocalNote } = useLocalNotes(lectureData?.id ?? null)

  // Reading progress + auto-hide header
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)

      // Auto-hide header on scroll down, show on scroll up
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        const diff = scrollTop - lastScrollY.current
        if (diff > 20 && scrollTop > 120) {
          setHeaderHidden(true)
        } else if (diff < -10 || scrollTop < 60) {
          setHeaderHidden(false)
        }
        lastScrollY.current = scrollTop
      }, 50)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [])

  // Save scroll position to sessionStorage for resume-reading
  useEffect(() => {
    if (!lectureData?.id) return
    const timer = setInterval(() => {
      const scrollY = window.scrollY
      if (scrollY > 0) {
        sessionStorage.setItem(`lecture-scroll-${lectureData.id}`, String(scrollY))
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [lectureData?.id])

  // Send scroll-based progress to server (debounced)
  useEffect(() => {
    if (!user?.id || !lectureData?.id) return

    // Reset progress tracking when lecture changes
    if (lectureIdRef.current !== lectureData.id) {
      lectureIdRef.current = lectureData.id
      lastSentProgress.current = 0
    }

    // Map scroll ratio (0-1) to content progress (5-100)
    const contentProgress = Math.min(100, Math.round(5 + scrollProgress * 95))

    // Only send if meaningful increase (≥5% more than last sent)
    if (contentProgress <= lastSentProgress.current + 4) return

    if (progressTimer.current) clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(async () => {
      if (contentProgress <= lastSentProgress.current) return
      lastSentProgress.current = contentProgress
      try {
        const csrfToken = await fetchCsrfToken()
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: lectureData.id,
            contentType: 'lecture',
            progress: contentProgress,
            _csrf: csrfToken,
          }),
        })
      } catch { /* ignore */ }
    }, 2000)

    return () => { if (progressTimer.current) clearTimeout(progressTimer.current) }
  }, [scrollProgress, user?.id, lectureData?.id])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let lectureId = params.lectureId
        // If no lectureId provided, try to fetch the first lecture
        if (!lectureId) {
          try {
            // Try chapterId first, then subjectId as fallback
            const filterParam = params.chapterId
              ? `chapterId=${params.chapterId}`
              : params.subjectId
                ? `subjectId=${params.subjectId}`
                : ''
            if (filterParam) {
              const listRes = await fetch(`/api/lectures?${filterParam}&limit=1`)
              if (listRes.ok) {
                const listData = await listRes.json()
                const lectures = listData.data?.lectures || []
                if (lectures.length > 0) {
                  lectureId = lectures[0].id
                }
              }
            }
          } catch {
            // Continue without lectureId
          }
        }
        if (!lectureId) {
          setLectureData(null)
          return
        }

        // Restore last scroll position for this lecture
        const savedPos = sessionStorage.getItem(`lecture-scroll-${lectureId}`)

        const res = await fetch(`/api/lectures/${lectureId}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        const lectureObjData = data.data
        setLectureData(lectureObjData)

        // Extract headings from content blocks for Table of Contents
        try {
          const blocks = deserializeBlocks(lectureObjData.content)
          const extracted = headingsFromBlocks(blocks)
          if (extracted.length > 0) {
            setHeadings(extracted)
          }
        } catch {
          // Not block content — no TOC
        }

        // Auto-scroll to saved position after render
        if (savedPos) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const pos = parseInt(savedPos, 10)
              if (!isNaN(pos) && pos > 0) {
                window.scrollTo({ top: pos, behavior: 'instant' as ScrollBehavior })
              }
            })
          })
        }

        // Record recently viewed & update progress
        const lectureObj = data?.data
        if (user?.id && lectureObj?.id) {
          const csrfToken = await fetchCsrfToken()

          fetch('/api/recently-viewed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contentId: lectureObj.id,
              contentType: 'lecture',
              title: lectureObj.title,
              _csrf: csrfToken,
            }),
          }).catch((err) => {
            console.error('[LectureViewer] Failed to record recently viewed:', err)
          })

          // Auto-update progress to at least 5% when opening a lecture
          const currentProgress = lectureObj.progress || 0
          if (currentProgress < 5) {
            fetch('/api/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contentId: lectureObj.id,
                contentType: 'lecture',
                progress: 5,
                _csrf: csrfToken,
            }),
          }).catch((err) => {
            console.error('[LectureViewer] Failed to save progress:', err)
          })
          }
        }
      } catch {
        setLectureData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.lectureId, params.chapterId, params.subjectId, params.classSlug, user?.id])

  // Check payment status when lecture data is loaded and content is premium
  useEffect(() => {
    if (!lectureData?.isPremium || !lectureData?.id) return

    const checkPayment = async () => {
      try {
        const params = new URLSearchParams({
          contentType: 'lecture',
          contentId: lectureData.id,
        })
        if (user?.id) {
          params.set('userId', user.id)
        }
        const res = await fetch(`/api/payment/check?${params}`)
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
  }, [lectureData?.isPremium, lectureData?.id, user?.id])

  // Determine access: premium users always have access, or if content is not premium
  const isPremiumUser = user?.isPremium && !!user?.premiumExpiry && new Date(user.premiumExpiry) > new Date()
  const isPremiumContent = lectureData?.isPremium ?? false
  const isLocked = isPremiumContent && !isPremiumUser && !paymentStatus.purchased
  const _showContent = !isPremiumContent || isPremiumUser || paymentStatus.purchased

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Sticky header skeleton */}
        <div className="sticky top-0 z-40 bg-background border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="hidden sm:block size-9 rounded-lg" />
          </div>
          <Skeleton className="h-1 w-full rounded-none" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>

          {/* Title skeleton */}
          <Skeleton className="h-8 w-3/4 rounded-lg mb-2" />
          <Skeleton className="h-4 w-1/2 rounded-lg mb-8" />

          {/* Video skeleton */}
          <Skeleton className="aspect-video w-full rounded-xl mb-8" />

          {/* Paragraph skeletons */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-11/12 rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>

          {/* Image skeleton */}
          <Skeleton className="aspect-video w-3/4 mx-auto rounded-xl my-8" />

          {/* More paragraph skeletons */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!lectureData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-12 bg-muted" />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">লেকচার পাওয়া যায়নি</h2>
            <p className="text-muted-foreground mb-4">এই অধ্যায়ের লেকচার শীঘ্রই যোগ করা হবে</p>
            <Button variant="outline" className="gap-2" onClick={goBack}>
              <ArrowLeft className="size-4" />
              ফিরে যান
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const SidebarContent = () => (
    <div className="space-y-1">
      <div className="px-3 py-2 mb-2">
        <h3 className="font-semibold text-sm">অধ্যায়: {lectureData.chapterName}</h3>
        <p className="text-xs text-muted-foreground mt-1">{lectureData.lectures.length}টি লেকচার</p>
      </div>
      <Separator className="mb-2" />
      {lectureData.lectures.map((lec) => (
        <button
          key={lec.id}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
            lec.isCurrent
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-muted'
          }`}
          onClick={() => {
            navigate('lecture-viewer', {
              lectureId: lec.id,
              chapterId: lectureData.chapterId,
              subjectId: lectureData.subjectId,
              classSlug: lectureData.classSlug,
            })
            setSidebarOpen(false)
          }}
        >
          <div className={`flex items-center justify-center size-6 rounded-full shrink-0 text-xs font-medium ${
            lec.isCompleted
              ? 'bg-emerald-500 text-white'
              : lec.isCurrent
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}>
            {lec.isCompleted ? <CheckCircle2 className="size-4" /> : lec.number}
          </div>
          <span className="truncate">{lec.title}</span>
        </button>
      ))}
    </div>
  )

  const hasPrev = lectureData.currentIndex > 0
  const hasNext = lectureData.currentIndex < lectureData.lectures.length - 1

  // Content rendering function
  const renderContent = () => (
    <>
      {/* Thumbnail Hero Banner */}
      {lectureData.thumbnail && (
        <div className="mb-6 overflow-hidden rounded-xl animate-fade-in-up">
          <div className="relative">
            <SafeImage
              src={lectureData.thumbnail}
              alt={lectureData.title}
              className="w-full max-h-80 object-cover rounded-xl"
            />
            {/* Gradient overlay at bottom for text readability */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent rounded-b-xl" />
          </div>
        </div>
      )}
      {/* Video Embed */}
      {lectureData.videoUrl && showVideo && (
        <div className="mb-6 animate-fade-in-up">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
            <iframe
              src={lectureData.videoUrl}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              title="লেকচার ভিডিও"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 gap-1 text-muted-foreground"
            onClick={() => setShowVideo(false)}
          >
            <X className="size-4" />
            ভিডিও লুকান
          </Button>
        </div>
      )}

      {!showVideo && lectureData.videoUrl && (
        <Button
          variant="outline"
          size="sm"
          className="mb-4 gap-2"
          onClick={() => setShowVideo(true)}
        >
          <Play className="size-4" />
          ভিডিও দেখুন
        </Button>
      )}

      {/* PDF Viewer */}
      {lectureData.pdfUrl && showPdf && (
        <div className="mb-6 animate-fade-in-up">
          <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/20">
            <iframe
              src={`/api/pdf?url=${encodeURIComponent(lectureData.pdfUrl)}&inline=true`}
              className="w-full h-[500px] sm:h-[600px]"
              title="PDF"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 gap-1 text-muted-foreground"
            onClick={() => setShowPdf(false)}
          >
            <X className="size-4" />
            PDF লুকান
          </Button>
        </div>
      )}
      {!showPdf && lectureData.pdfUrl && (
        <Button
          variant="outline"
          size="sm"
          className="mb-4 gap-2"
          onClick={() => setShowPdf(true)}
        >
          <FileText className="size-4" />
          PDF দেখুন
        </Button>
      )}

      {/* Article Content */}
      <div ref={contentRef} className={`${contentClassName} mb-8 animate-fade-in`}
      >
        {(() => {
          try {
            const blocks = deserializeBlocks(lectureData.content)
            if (blocks.length > 0 && blocks[0].id) {
              return <ContentBlockEditor blocks={blocks} onChange={() => {}} previewMode />
            }
          } catch { /* not block content */ }
          // Fallback: render as HTML
          return <RichContentRenderer content={lectureData.content} />
        })()}
      </div>

      {/* PDF Attachment */}
      {lectureData.pdfUrl && (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="size-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">PDF নোটস</p>
              <p className="text-xs text-muted-foreground">ডাউনলোড করে অফলাইনে পড়ুন</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadPdf(lectureData.pdfUrl!, getFilenameFromUrl(lectureData.pdfUrl!))}>
              <Download className="size-4" />
              ডাউনলোড
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {lectureData.resources.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Download className="size-5" />
            রিসোর্স
          </h3>
          <div className="space-y-2">
            {lectureData.resources.map((res, i) => (
              <Card key={i} className="hover:shadow-sm transition-shadow border-border/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <FileText className="size-5 text-primary shrink-0" />
                  <span className="flex-1 text-sm truncate">{res.name}</span>
                  <Badge variant="secondary" className="text-xs uppercase">{res.type}</Badge>
                  <Button size="sm" variant="ghost" className="gap-1" asChild>
                    <a href={res.url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="size-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  )

  // Collect images from content blocks for lightbox
  useEffect(() => {
    if (!lectureData?.content) return
    try {
      const blocks = deserializeBlocks(lectureData.content)
      const imgs = blocks
        .filter((b) => b.type === 'image' && (b as any).url)
        .map((b: any) => ({ src: b.url, alt: b.caption || lectureData.title }))
      if (imgs.length > 0) setLightboxImages(imgs)
    } catch { /* ignore */ }
  }, [lectureData?.content, lectureData?.title])

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Image Lightbox */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/60">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-transform duration-150 origin-left shadow-sm shadow-emerald-500/20"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      {/* Floating Table of Contents Sheet */}
      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent side="right" className="w-72 sm:w-80">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ListTree className="size-4" />
              বিষয়সূচী
            </SheetTitle>
          </SheetHeader>
          {headings.length === 0 ? (
            <p className="text-sm text-muted-foreground">কোনো শিরোনাম পাওয়া যায়নি</p>
          ) : (
            <nav className="space-y-1">
              {headings.map((h, idx) => (
                <button
                  key={h.id}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-muted ${
                    h.level === 2 ? 'font-medium' : 'text-muted-foreground ml-4'
                  }`}
                  onClick={() => {
                    const el = document.getElementById(h.id)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      setTocOpen(false)
                    }
                  }}
                >
                  <span className="text-xs text-muted-foreground/50 mr-2 tabular-nums">{idx + 1}.</span>
                  {h.text}
                </button>
              ))}
            </nav>
          )}
        </SheetContent>
      </Sheet>

      {/* Header — auto-hides on scroll down (respects reduced motion) */}
      <div className={`sticky top-0 z-40 bg-background border-b motion-safe:transition-transform motion-safe:duration-300 ${
        headerHidden ? '-translate-y-full' : 'translate-y-0'
      }`}>
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 pb-2">
                <SheetTitle>{lectureData.subjectName}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-4rem)]">
                <div className="p-2">
                  <SidebarContent />
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="size-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{lectureData.title}</p>
              {isPremiumContent && paymentStatus.purchased && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-[10px] px-1.5 py-0 shrink-0">
                  <CheckCircle2 className="size-3" />
                  কেনা
                </Badge>
              )}
              {isPremiumContent && !paymentStatus.purchased && !isPremiumUser && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1 text-[10px] px-1.5 py-0 shrink-0">
                  <Lock className="size-3" />
                  প্রিমিয়াম
                </Badge>
              )}
              {isPremiumContent && isPremiumUser && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1 text-[10px] px-1.5 py-0 shrink-0">
                  <Crown className="size-3" />
                  প্রিমিয়াম
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{lectureData.subjectName}</span>
              <span>•</span>
              <span>{lectureData.className}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* TOC button — desktop only */}
            {headings.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex size-9 text-muted-foreground"
                onClick={() => setTocOpen(true)}
                aria-label="বিষয়সূচী"
              >
                <ListTree className="size-4" />
              </Button>
            )}

            {/* Reading Settings Panel — replaces old font size controls */}
            <ReadingSettingsPanel settings={settings} onUpdate={updateSettings} />

            {/* Local Notes Drawer */}
            <LocalNoteDrawer
              notes={localNotes}
              loaded={localNotesLoaded}
              onAdd={addLocalNote}
              onUpdate={updateLocalNote}
              onDelete={deleteLocalNote}
            />

            <BookmarkButton
              contentId={lectureData.id}
              contentType="lecture"
              contentTitle={lectureData.title}
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-amber-600"
              onToggle={(b) => setIsBookmarked(b)}
            />
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1" title={`মোট ${formatTime(totalSeconds)} পড়া`}>
                <Clock className="size-3.5" />
                <span>{formatTime(sessionSeconds)}</span>
              </div>
              {lastOpened && (
                <div className="flex items-center gap-1 text-[10px]" title="শেষবার খোলা">
                  <span className="text-muted-foreground/50">|</span>
                  <span>{formatDate(lastOpened)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Progress value={lectureData.progress} className="h-1 rounded-none" />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex">
          {/* Left Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 border-r min-h-[calc(100vh-5rem)] p-2 sticky top-[5rem] self-start max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin">
            <SidebarContent />
          </aside>

          {/* Center Content */}
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('home')}>হোম</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('class-detail', { classSlug: lectureData.classSlug })}>
                    {lectureData.className}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('subject-detail', { subjectId: lectureData.subjectId, classSlug: lectureData.classSlug, subjectSlug: lectureData.subjectSlug })}>
                    {lectureData.subjectName}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{lectureData.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Premium Content Check */}
            {isLocked ? (
              <PremiumLock
                purchased={paymentStatus.purchased}
                pendingPayment={paymentStatus.pendingPayment}
                rejected={paymentStatus.rejected}
                price={lectureData.price}
                contentType="lecture"
                contentId={lectureData.id}
                contentTitle={lectureData.title}
                classLevel={lectureData.classSlug}
                title="প্রিমিয়াম লেকচার"
                description={lectureData.price > 0 
                  ? `এই লেকচারটি দেখতে ৳${lectureData.price} পেমেন্ট করুন`
                  : 'এই লেকচারটি দেখতে পেমেন্ট করুন'
                }
                onUpgrade={() => navigate('payment', {
                  contentType: 'lecture',
                  contentId: lectureData.id,
                  contentTitle: lectureData.title,
                  contentPrice: String(lectureData.price),
                })}
              >
                {/* Blurred preview content when locked */}
                <div className="blur-md pointer-events-none select-none opacity-50">
                  {renderContent()}
                </div>
              </PremiumLock>
            ) : (
              <>
                {/* কেনা Badge wrapper for purchased premium content */}
                {isPremiumContent && paymentStatus.purchased && (
                  <PremiumLock
                    purchased={true}
                    onUpgrade={() => {}}
                  >
                    {renderContent()}
                  </PremiumLock>
                )}
                {/* Normal content - either free or premium user (but not already purchased) */}
                {(!isPremiumContent || (isPremiumUser && !paymentStatus.purchased)) && renderContent()}
              </>
            )}

            {/* Bottom Learning Bar — mobile sticky, desktop inline */}
            <Separator className="my-6" />
            
            {/* Desktop: inline navigation */}
            <div className="hidden sm:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Button
                variant="outline"
                className="gap-2 justify-start min-h-[44px]"
                disabled={!hasPrev}
                onClick={() => {
                  if (hasPrev) {
                    const prev = lectureData.lectures[lectureData.currentIndex - 1]
                    navigate('lecture-viewer', {
                      lectureId: prev.id,
                      chapterId: lectureData.chapterId,
                      subjectId: lectureData.subjectId,
                      classSlug: lectureData.classSlug,
                    })
                  }
                }}
              >
                <ArrowLeft className="size-4" />
                আগের লেকচার
              </Button>
              <span className="text-sm text-muted-foreground text-center">
                {lectureData.currentIndex + 1} / {lectureData.lectures.length}
              </span>
              <Button
                className="gap-2 justify-end min-h-[44px]"
                disabled={!hasNext}
                onClick={() => {
                  if (hasNext) {
                    const next = lectureData.lectures[lectureData.currentIndex + 1]
                    navigate('lecture-viewer', {
                      lectureId: next.id,
                      chapterId: lectureData.chapterId,
                      subjectId: lectureData.subjectId,
                      classSlug: lectureData.classSlug,
                    })
                  }
                }}
              >
                পরের লেকচার
                <ArrowRight className="size-4" />
              </Button>
            </div>

            {/* Mobile: sticky bottom learning bar */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md safe-bottom pb-safe">
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 gap-1.5 h-11 text-xs font-medium min-w-0"
                  disabled={!hasPrev}
                  onClick={() => {
                    if (hasPrev) {
                      const prev = lectureData.lectures[lectureData.currentIndex - 1]
                      navigate('lecture-viewer', {
                        lectureId: prev.id,
                        chapterId: lectureData.chapterId,
                        subjectId: lectureData.subjectId,
                        classSlug: lectureData.classSlug,
                      })
                    }
                  }}
                >
                  <ArrowLeft className="size-4 shrink-0" />
                  <span className="truncate">পূর্ববর্তী</span>
                </Button>

                <div className="flex items-center gap-0.5">
                  {headings.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      onClick={() => setTocOpen(true)}
                      aria-label="বিষয়সূচী"
                    >
                      <ListTree className="size-5" />
                    </Button>
                  )}
                  <BookmarkButton
                    contentId={lectureData.id}
                    contentType="lecture"
                    contentTitle={lectureData.title}
                    size="icon"
                    variant="ghost"
                    className="size-11 text-muted-foreground hover:text-amber-600"
                    onToggle={setIsBookmarked}
                  />
                </div>

                <Button
                  size="sm"
                  className="flex-1 gap-1.5 h-11 text-xs font-medium min-w-0"
                  disabled={!hasNext}
                  onClick={() => {
                    if (hasNext) {
                      const next = lectureData.lectures[lectureData.currentIndex + 1]
                      navigate('lecture-viewer', {
                        lectureId: next.id,
                        chapterId: lectureData.chapterId,
                        subjectId: lectureData.subjectId,
                        classSlug: lectureData.classSlug,
                      })
                    }
                  }}
                >
                  <span className="truncate">পরবর্তী</span>
                  <ArrowRight className="size-4 shrink-0" />
                </Button>
              </div>
            </div>

            {/* Bottom padding for mobile sticky bar */}
            <div className="sm:hidden h-[4.5rem]" />
          </main>

          {/* Right Panel - Desktop */}
          <aside className="hidden xl:block w-72 border-l p-4 sticky top-[5rem] self-start max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin">
            {/* Notes */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <StickyNote className="size-4 text-primary" />
                  নোটস
                </h4>
                {lectureData?.id && (
                  <NoteEditor contentId={lectureData.id} contentType="lecture" />
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
