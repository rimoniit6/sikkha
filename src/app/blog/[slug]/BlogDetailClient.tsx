'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Home, Calendar, User, Clock, Eye, ArrowRight, Share2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import RichContentRenderer from '@/components/ui/rich-content-renderer'
import { useImageViewer } from '@/providers/ImageViewerProvider'
import TableOfContents from '@/components/ui/table-of-contents'
import { deserializeBlogBlocks } from '@/features/blog/blocks/blog-block-serializer'
import { headingsFromBlogBlocks } from '@/features/blog/blocks/blog-block-utils'
import type { BlogPostRecord } from '@/features/blog/types/blog'

const BlogBlockEditor = dynamic(
  () => import('@/features/blog/blocks/BlogBlockEditor').then(m => ({ default: m.default })),
  { ssr: false }
)

interface Props {
  post: BlogPostRecord
  relatedPosts: BlogPostRecord[]
  prevPost?: { slug: string; title: string } | null
  nextPost?: { slug: string; title: string } | null
}

export default function BlogDetailClient({ post, relatedPosts, prevPost, nextPost }: Props) {
  const viewer = useImageViewer()
  const [copied, setCopied] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)

  const contentRef = useRef<HTMLDivElement>(null)

  // Deserialize content blocks (supports both JSON blocks and legacy HTML)
  const blocks = useMemo(() => {
    const postWithBlocks = post as typeof post & { contentBlocks?: string }
    if (postWithBlocks.contentBlocks) {
      try { return JSON.parse(postWithBlocks.contentBlocks) } catch { /* fall through */ }
    }
    return deserializeBlogBlocks(post.content)
  }, [post])

  const tocHeadings = useMemo(() => headingsFromBlogBlocks(blocks), [blocks])

  // Image click delegation for lightbox
  useEffect(() => {
    if (!viewer) return
    const el = contentRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' && target.closest('.blog-content')) {
        const img = target as HTMLImageElement
        viewer.openViewer([{ src: img.src, alt: img.alt || undefined }])
      }
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [viewer])

  // Assign IDs to content headings for TOC anchor links
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const headings = el.querySelectorAll('h2, h3')
    headings.forEach((heading) => {
      if (!heading.id) {
        const text = heading.textContent || ''
        const id = text
          .toLowerCase()
          .replace(/[^\w\u0980-\u09FF\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'heading'
        heading.id = id
      }
    })
  }, [blocks])

  // Reading progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight > 0) {
        setReadingProgress(Math.min((scrollTop / docHeight) * 100, 100))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = post.title

  return (
    <>
      {/* Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-emerald-500 z-50 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
      />

      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8 justify-center">
        <article className="max-w-3xl w-full">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">
                  <Home className="h-4 w-4 mr-1 inline" />
                  হোম
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/blog">ব্লগ</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{post.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {post.featuredImage && (
            <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
              <Image
                src={post.featuredImage}
                alt={post.title}
                fill
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}

          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {post.category && (
                <Badge
                  variant="outline"
                  style={{ borderColor: post.category.color || undefined, color: post.category.color || undefined }}
                >
                  {post.category.name}
                </Badge>
              )}
              {post.tags?.map(({ tag }) => (
                <Link key={tag.id} href={`/blog/tag/${tag.slug}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
              {post.author && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {post.author.name}
                </span>
              )}
              {post.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt).toLocaleDateString('bn-BD', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </span>
              )}
              {post.updatedAt && post.updatedAt !== post.publishedAt && (
                <span className="flex items-center gap-1 text-xs opacity-70">
                  (সর্বশেষ আপডেট: {new Date(post.updatedAt).toLocaleDateString('bn-BD', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })})
                </span>
              )}
              {post.readingTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {post.readingTime} মিনিট পড়া
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {post.viewCount} বার দেখা
              </span>
            </div>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            <div className="flex items-center gap-2 mb-6">
              {/* Share Buttons */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                      {copied ? 'কপি করা হয়েছে' : 'লিংক কপি'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>পোস্টের লিংক কপি করুন</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener')
                }}
              >
                Facebook
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank', 'noopener')
                }}
              >
                WhatsApp
              </Button>
            </div>

            <Separator className="mb-8" />

            {/* Content blocks — rendered via BlogBlockEditor in preview mode */}
            <div
              ref={contentRef}
              className="prose prose-lg dark:prose-invert max-w-none blog-content"
              style={{ cursor: 'zoom-in' }}
            >
              {blocks.length > 0 && blocks[0].id ? (
                <BlogBlockEditor blocks={blocks} onChange={() => {}} previewMode />
              ) : (
                <RichContentRenderer content={post.content} />
              )}
            </div>
          </div>
        </article>

        {/* Table of Contents (desktop sidebar) */}
        <div className="hidden lg:block w-56 shrink-0">
          <TableOfContents headings={tocHeadings} />
        </div>

        {/* Mobile TOC (floating button) */}
        <div className="lg:hidden">
          <TableOfContents headings={tocHeadings} />
        </div>
      </div>

        {/* Previous / Next Article Navigation */}
        {(prevPost || nextPost) && (
          <div className="max-w-4xl mx-auto px-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                {prevPost && (
                  <Link
                    href={`/blog/${prevPost.slug}`}
                    className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <div>
                      <div className="text-xs opacity-60">পূর্ববর্তী</div>
                      <div className="font-medium line-clamp-1">{prevPost.title}</div>
                    </div>
                  </Link>
                )}
              </div>
              <div className="text-right">
                {nextPost && (
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div>
                      <div className="text-xs opacity-60">পরবর্তী</div>
                      <div className="font-medium line-clamp-1">{nextPost.title}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {relatedPosts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <Separator className="mb-8" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">সম্পর্কিত পোস্ট</h2>
              <Link href="/blog" className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
                সবগুলো দেখুন <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((rp) => (
                <Link key={rp.id} href={`/blog/${rp.slug}`}>
                  <Card className="group h-full overflow-hidden hover:shadow-lg transition-shadow">
                    {rp.featuredImage && (
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={rp.featuredImage}
                          alt={rp.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      {rp.category && (
                        <Badge
                          variant="outline"
                          style={{ borderColor: rp.category.color || undefined, color: rp.category.color || undefined }}
                          className="mb-2"
                        >
                          {rp.category.name}
                        </Badge>
                      )}
                      <h3 className="font-semibold line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {rp.title}
                      </h3>
                      {rp.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{rp.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                        {rp.author && <span>{rp.author.name}</span>}
                        {rp.readingTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {rp.readingTime} মিনিট
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
