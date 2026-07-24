'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAdminBlog, useAdminBlogCategories, useAdminBlogTags } from '@/features/blog/hooks/use-admin-blogs'
import { blogService } from '@/features/blog/services/blog.service'
import { useRouterStore, useRouteParam } from '@/store/router'
import { useToast } from '@/hooks/use-toast'
import { useAutoSlug } from '@/hooks/use-auto-slug'
import { slugify } from '@/lib/slug'
import { Skeleton } from '@/components/ui/skeleton'
import BlogEditorView from '@/components/admin/blog/BlogEditorView'
import type { BlogPostStatus } from '@/features/blog/types/blog'
import type { BlogStepNumber } from '@/components/admin/blog/types'
import type { BlogContentBlock } from '@/features/blog/blocks/blog-block-types'
import { serializeBlogBlocks } from '@/features/blog/blocks/blog-block-serializer'
import { deserializeBlogBlocks } from '@/features/blog/blocks/blog-block-serializer'

export default function AdminBlogEditor() {
  const navigate = useRouterStore((s) => s.navigate)
  const postId = useRouteParam('postId')
  const isEdit = !!postId
  const { toast } = useToast()

  const { data: editPost, isLoading: postLoading } = useAdminBlog(postId || '')
  const { categories } = useAdminBlogCategories()
  const { tags } = useAdminBlogTags()

  const [title, setTitle] = useState('')
  const [slug, setSlugState] = useState('')
  const [slugError, setSlugError] = useState('')
  const [blocks, setBlocks] = useState<BlogContentBlock[]>([])
  const [excerpt, setExcerpt] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<BlogPostStatus>('DRAFT')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [allowComments, setAllowComments] = useState(true)
  const [featuredImage, setFeaturedImage] = useState('')
  const [ogImage, setOgImage] = useState('')
  const [canonicalUrl, setCanonicalUrl] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [readingTime, setReadingTime] = useState(0)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [currentStep, setCurrentStep] = useState<BlogStepNumber>(1)

  const AUTOSAVE_KEY_PREFIX = 'blog-editor-draft-'
  const AUTOSAVE_DELAY = 3000
  const autosaveKey = useMemo(() => `${AUTOSAVE_KEY_PREFIX}${postId || 'new'}`, [postId])
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Blocks are the primary data model — reading time is derived from block text content
  const handleBlocksChange = useCallback((newBlocks: BlogContentBlock[]) => {
    setBlocks(newBlocks)
    const text = newBlocks.map(b => {
      if ('content' in b && typeof b.content === 'string') return b.content.replace(/<[^>]*>/g, '')
      return ''
    }).join(' ')
    const words = text.split(/\s+/).filter(Boolean).length
    setReadingTime(Math.max(1, Math.ceil(words / 200)))
  }, [])

  // Auto-save to localStorage
  const saveToLocalStorage = useCallback(() => {
    const draft = { title, slug, blocks, excerpt, categoryId, status, featuredImage, ogImage, metaTitle, metaDescription, tagIds, isFeatured, isPinned, allowComments, canonicalUrl }
    try {
      localStorage.setItem(autosaveKey, JSON.stringify(draft))
      setLastSaved(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* quota exceeded */ }
  }, [title, slug, blocks, excerpt, categoryId, status, featuredImage, ogImage, metaTitle, metaDescription, tagIds, isFeatured, isPinned, allowComments, canonicalUrl, autosaveKey])

  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(saveToLocalStorage, AUTOSAVE_DELAY)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [title, slug, blocks, excerpt, categoryId, status, featuredImage, ogImage, metaTitle, metaDescription, tagIds, isFeatured, isPinned, allowComments, canonicalUrl, saveToLocalStorage])

  // Recover draft on load
  useEffect(() => {
    if (isEdit && editPost) return
    if (postLoading) return
    try {
      const saved = localStorage.getItem(autosaveKey)
      if (!saved) return
      const draft = JSON.parse(saved)
      if (!draft.blocks && !draft.title) return
      if (draft.blocks || draft.title) {
        setTitle(draft.title || '')
        setSlugState(draft.slug || '')
        setBlocks(draft.blocks || deserializeBlogBlocks(draft.content || ''))
        setExcerpt(draft.excerpt || '')
        setFeaturedImage(draft.featuredImage || '')
        setOgImage(draft.ogImage || '')
        setCategoryId(draft.categoryId || '')
        setStatus(draft.status || 'DRAFT')
        setIsFeatured(draft.isFeatured || false)
        setIsPinned(draft.isPinned || false)
        setAllowComments(draft.allowComments ?? true)
        setMetaTitle(draft.metaTitle || '')
        setMetaDescription(draft.metaDescription || '')
        setCanonicalUrl(draft.canonicalUrl || '')
        setTagIds(draft.tagIds || [])
        setDraftRecovered(true)
      }
    } catch { /* ignore parse errors */ }
  }, [isEdit, editPost, postLoading, autosaveKey])

  // Load edit post — blocks are primary, legacy HTML content is fallback only
  useEffect(() => {
    if (isEdit && editPost) {
      setTitle(editPost.title)
      setSlugState(editPost.slug)
      // Load blocks from contentBlocks if available, otherwise deserialize from legacy content field
      const postWithBlocks = editPost as typeof editPost & { contentBlocks?: string }
      if (postWithBlocks.contentBlocks) {
        try {
          setBlocks(JSON.parse(postWithBlocks.contentBlocks))
        } catch {
          setBlocks(deserializeBlogBlocks(editPost.content))
        }
      } else {
        setBlocks(deserializeBlogBlocks(editPost.content))
      }
      setExcerpt(editPost.excerpt || '')
      setFeaturedImage(editPost.featuredImage || '')
      setOgImage(editPost.ogImage || '')
      setCategoryId(editPost.categoryId || '')
      setStatus(editPost.status as BlogPostStatus)
      setIsFeatured(editPost.isFeatured)
      setIsPinned(editPost.isPinned)
      setAllowComments(editPost.allowComments)
      setMetaTitle(editPost.metaTitle || '')
      setMetaDescription(editPost.metaDescription || '')
      setCanonicalUrl(editPost.canonicalUrl || '')
      setReadingTime(editPost.readingTime || 0)
      setTagIds(editPost.tags?.map((t: { tag: { id: string } }) => t.tag.id) || [])
    }
  }, [isEdit, editPost])

  // Auto-slug
  const autoSlugInitRef = useRef(false)
  const { slug: autoSlug, isManuallyEdited: slugManuallyEdited, setSlug: setAutoSlug, reset: resetAutoSlug } = useAutoSlug(title, '')

  useEffect(() => {
    setSlugState(autoSlug)
  }, [autoSlug])

  useEffect(() => {
    if (isEdit && editPost && !autoSlugInitRef.current) {
      autoSlugInitRef.current = true
      const editSlug = editPost.slug || slugify(editPost.title)
      setAutoSlug(editSlug)
    }
  }, [isEdit, editPost, setAutoSlug])

  // Slug validation
  const validateSlug = useCallback(async (): Promise<boolean> => {
    if (!slug) {
      setSlugError('স্লাগ প্রয়োজন')
      return false
    }
    try {
      const params = new URLSearchParams({ model: 'blogPost', slug })
      if (isEdit && postId) params.set('excludeId', postId)
      const res = await fetch(`/api/admin/check-slug?${params}`)
      const body = await res.json()
      if (!body.data?.available) {
        setSlugError('এই শিরোনামের জন্য তৈরি হওয়া স্লাগটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি শিরোনাম দিন।')
        return false
      }
      setSlugError('')
      return true
    } catch {
      return true
    }
  }, [slug, isEdit, postId])

  const handleSave = useCallback(async (publish: boolean = false) => {
    if (!title.trim()) {
      toast({ title: 'শিরোনাম দিন', variant: 'destructive' })
      return
    }
    const slugValid = await validateSlug()
    if (!slugValid) {
      toast({ title: slugError || 'স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const input = {
        title,
        slug: slug || undefined,
        content: serializeBlogBlocks(blocks),
        contentBlocks: JSON.stringify(blocks),
        excerpt: excerpt || null,
        featuredImage: featuredImage || null,
        ogImage: ogImage || null,
        canonicalUrl: canonicalUrl || null,
        categoryId: categoryId || null,
        status: publish ? 'PUBLISHED' as const : status,
        isFeatured,
        isPinned,
        allowComments,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        tagIds,
      }
      if (isEdit) {
        await blogService.admin.update(postId!, input)
        toast({ title: 'পোস্ট আপডেট হয়েছে' })
      } else {
        await blogService.admin.create(input)
        toast({ title: 'পোস্ট তৈরি হয়েছে' })
      }
      try { localStorage.removeItem(autosaveKey) } catch { /* ignore */ }
      setDraftRecovered(false)
      navigate('admin-blog')
    } catch (e) {
      toast({ title: 'সেভ করতে সমস্যা হয়েছে', variant: 'destructive' })
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [title, slug, blocks, excerpt, featuredImage, ogImage, canonicalUrl, categoryId, status, isFeatured, isPinned, allowComments, metaTitle, metaDescription, tagIds, isEdit, postId, validateSlug, slugError, toast, navigate, autosaveKey])

  const navigateBack = useCallback(() => {
    navigate('admin-blog')
  }, [navigate])

  const canGoNext = useCallback(() => {
    if (currentStep === 1) return title.trim().length > 0
    return true
  }, [currentStep, title])

  const goNext = useCallback(() => {
    if (currentStep < 3 && canGoNext()) {
      setCurrentStep((currentStep + 1) as BlogStepNumber)
    }
  }, [currentStep, canGoNext])

  const goPrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as BlogStepNumber)
    }
  }, [currentStep])

  if (isEdit && postLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <BlogEditorView
      isEdit={isEdit}
      postId={postId || null}
      currentStep={currentStep}
      title={title}
      setTitle={setTitle}
      slug={slug}
      setSlug={(v) => { setAutoSlug(v); setSlugError('') }}
      slugError={slugError}
      slugManuallyEdited={slugManuallyEdited}
      resetAutoSlug={() => { resetAutoSlug(); setSlugError('') }}
      excerpt={excerpt}
      setExcerpt={setExcerpt}
      categoryId={categoryId}
      setCategoryId={setCategoryId}
      status={status}
      setStatus={setStatus}
      isFeatured={isFeatured}
      setIsFeatured={setIsFeatured}
      isPinned={isPinned}
      setIsPinned={setIsPinned}
      allowComments={allowComments}
      setAllowComments={setAllowComments}
      featuredImage={featuredImage}
      setFeaturedImage={setFeaturedImage}
      ogImage={ogImage}
      setOgImage={setOgImage}
      canonicalUrl={canonicalUrl}
      setCanonicalUrl={setCanonicalUrl}
      metaTitle={metaTitle}
      setMetaTitle={setMetaTitle}
      metaDescription={metaDescription}
      setMetaDescription={setMetaDescription}
      tagIds={tagIds}
      setTagIds={setTagIds}
      categories={categories}
      tags={tags}
      readingTime={readingTime}
      lastSaved={lastSaved}
      draftRecovered={draftRecovered}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      saving={saving}
      handleSave={handleSave}
      navigateBack={navigateBack}
      goNext={goNext}
      goPrev={goPrev}
      canGoNext={canGoNext}
      blocks={blocks}
      setBlocks={handleBlocksChange}
    />
  )
}
