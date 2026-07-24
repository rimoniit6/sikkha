import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Save,
  Send,
  Sigma,
  Sparkles,
  Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'
import type { BlogStepNumber, BlogPostStatus, BlogCategoryRecord, BlogTagRecord } from './types'
import { statusLabels, blogSteps } from './types'
import EditorShell from '@/components/admin/shared/EditorShell'
import ImageUploader from '@/components/ui/image-uploader'
import SlugField from '@/components/ui/slug-field'
import { MultiSelect } from '@/components/ui/multi-select'
import type { BlogContentBlock } from '@/features/blog/blocks/blog-block-types'

const BlogBlockEditor = dynamic(
  () => import('@/features/blog/blocks/BlogBlockEditor').then(m => ({ default: m.default })),
  { ssr: false }
)

interface BlogEditorViewProps {
  isEdit: boolean
  postId: string | null
  currentStep: BlogStepNumber
  title: string
  setTitle: (v: string) => void
  slug: string
  setSlug: (v: string) => void
  slugError: string
  slugManuallyEdited: boolean
  resetAutoSlug: () => void
  excerpt: string
  setExcerpt: (v: string) => void
  categoryId: string
  setCategoryId: (v: string) => void
  status: BlogPostStatus
  setStatus: (v: BlogPostStatus) => void
  isFeatured: boolean
  setIsFeatured: (v: boolean) => void
  isPinned: boolean
  setIsPinned: (v: boolean) => void
  allowComments: boolean
  setAllowComments: (v: boolean) => void
  featuredImage: string
  setFeaturedImage: (v: string) => void
  ogImage: string
  setOgImage: (v: string) => void
  canonicalUrl: string
  setCanonicalUrl: (v: string) => void
  metaTitle: string
  setMetaTitle: (v: string) => void
  metaDescription: string
  setMetaDescription: (v: string) => void
  tagIds: string[]
  setTagIds: (v: string[]) => void
  categories: BlogCategoryRecord[]
  tags: BlogTagRecord[]
  readingTime: number
  lastSaved: string | null
  draftRecovered: boolean
  previewMode: 'desktop' | 'tablet' | 'mobile'
  setPreviewMode: (v: 'desktop' | 'tablet' | 'mobile') => void
  saving: boolean
  handleSave: (publish?: boolean) => Promise<void>
  navigateBack: () => void
  goNext: () => void
  goPrev: () => void
  canGoNext: () => boolean
  blocks: BlogContentBlock[]
  setBlocks: (blocks: BlogContentBlock[]) => void
}

// Blog editor with fully independent block editor.
// No Lecture files are modified or imported.
export default function BlogEditorView({
  isEdit,
  postId,
  currentStep,
  title,
  setTitle,
  slug,
  setSlug,
  slugError,
  slugManuallyEdited,
  resetAutoSlug,
  excerpt,
  setExcerpt,
  categoryId,
  setCategoryId,
  status,
  setStatus,
  isFeatured,
  setIsFeatured,
  isPinned,
  setIsPinned,
  allowComments,
  setAllowComments,
  featuredImage,
  setFeaturedImage,
  ogImage,
  setOgImage,
  canonicalUrl,
  setCanonicalUrl,
  metaTitle,
  setMetaTitle,
  metaDescription,
  setMetaDescription,
  tagIds,
  setTagIds,
  categories,
  tags,
  readingTime,
  lastSaved,
  draftRecovered,
  previewMode,
  setPreviewMode,
  saving,
  handleSave,
  navigateBack,
  goNext,
  goPrev,
  canGoNext,
  blocks,
  setBlocks,
}: BlogEditorViewProps) {
  return (
    <EditorShell
      title={isEdit ? 'পোস্ট সম্পাদনা' : 'নতুন পোস্ট যোগ করুন'}
      editId={postId}
      currentStep={currentStep}
      steps={blogSteps}
      onBack={navigateBack}
      onCancel={navigateBack}
      goNext={goNext}
      goPrev={goPrev}
      canGoNext={canGoNext}
    >
      {/* ── Status / Recovery ── */}
      {(lastSaved || draftRecovered) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {draftRecovered && (
            <span className="text-amber-600 font-medium">পূর্ববর্তী খসড়া পুনরুদ্ধার করা হয়েছে</span>
          )}
          {lastSaved && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastSaved} এ অটোসেভ
            </span>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 1: মৌলিক তথ্য
          ══════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                মৌলিক তথ্য
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-base font-semibold">শিরোনাম *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ব্লগ পোস্টের শিরোনাম"
                  className={cn("h-11 text-base", slugError && 'border-destructive')}
                />
                {slugError && (
                  <p className="text-xs text-red-500">{slugError}</p>
                )}
              </div>

              <SlugField
                value={slug}
                onChange={setSlug}
                sourceText={title}
                isManuallyEdited={slugManuallyEdited}
                onReset={resetAutoSlug}
                previewPrefix="blog"
                error={slugError}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">ক্যাটাগরি</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue placeholder="ক্যাটাগরি নির্বাচন" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold">স্ট্যাটাস</Label>
                  <Select value={status} onValueChange={(v: BlogPostStatus) => setStatus(v)}>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">খসড়া</SelectItem>
                      <SelectItem value="PUBLISHED">প্রকাশিত</SelectItem>
                      <SelectItem value="ARCHIVED">আর্কাইভড</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 2: কন্টেন্ট ব্লক ও মিডিয়া
          ══════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LayoutGrid className="h-5 w-5 text-emerald-600" />
                  কন্টেন্ট ব্লকসমূহ
                </CardTitle>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Sigma className="h-3 w-3" /> $...$ ম্যাথ
                  <span className="opacity-40">|</span>
                  <ImageIcon className="h-3 w-3" /> ছবি
                  <span className="opacity-40">|</span>
                  <Table2 className="h-3 w-3" /> ডাটা
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <BlogBlockEditor
                blocks={blocks}
                onChange={setBlocks}
              />
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-emerald-600" />
                মিডিয়া ও বিবরণ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-base font-semibold">ফিচার্ড ইমেজ</Label>
                <ImageUploader
                  value={featuredImage}
                  onChange={setFeaturedImage}
                  onRemove={() => setFeaturedImage('')}
                  label=""
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">OG ইমেজ (শেয়ার করার সময়)</Label>
                <ImageUploader
                  value={ogImage}
                  onChange={setOgImage}
                  onRemove={() => setOgImage('')}
                  label=""
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">ট্যাগ</Label>
                <MultiSelect
                  options={tags.map((t) => ({ label: t.name, value: t.id }))}
                  selectedValues={tagIds}
                  onChange={setTagIds}
                  placeholder="ট্যাগ নির্বাচন করুন"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">সারসংক্ষেপ</Label>
                <Textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="পোস্টের সংক্ষিপ্ত বিবরণ"
                  rows={3}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 3: প্রিভিউ ও প্রকাশ
          ══════════════════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Preview Card */}
          <Card className="border-2 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5 text-emerald-600" />
                  পোস্ট প্রিভিউ
                </CardTitle>
                <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                  {(['desktop', 'tablet', 'mobile'] as const).map((mode) => {
                    const Icon = mode === 'desktop' ? ImageIcon : mode === 'tablet' ? ImageIcon : ImageIcon
                    return (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          previewMode === mode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-muted-foreground hover:bg-muted/60'
                        )}
                        onClick={() => setPreviewMode(mode)}
                        title={mode === 'desktop' ? 'ডেস্কটপ' : mode === 'tablet' ? 'ট্যাবলেট' : 'মোবাইল'}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-wrap gap-2 text-sm">
                {categoryId && <Badge variant="outline">{categories.find(c => c.id === categoryId)?.name || categoryId}</Badge>}
                <Badge variant="outline">{statusLabels[status]}</Badge>
                {readingTime > 0 && (
                  <Badge variant="outline">{readingTime} মিনিট পঠন</Badge>
                )}
              </div>

              <Separator />

              <div
                className={cn(
                  'border rounded-xl bg-white dark:bg-zinc-950 overflow-auto mx-auto transition-all',
                  previewMode === 'desktop' && 'max-w-4xl',
                  previewMode === 'tablet' && 'max-w-[768px]',
                  previewMode === 'mobile' && 'max-w-[375px]',
                )}
              >
                <div className="p-6">
                  {featuredImage && (
                    <img src={featuredImage} alt={title} className="w-full max-h-64 object-cover rounded-lg mb-6" />
                  )}
                  <h1 className="text-3xl font-bold mb-2">{title || '(শিরোনাম ছাড়া)'}</h1>
                  {excerpt && <p className="text-muted-foreground mb-4">{excerpt}</p>}
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <BlogBlockEditor blocks={blocks} onChange={() => {}} previewMode />
                  </div>
                </div>
              </div>

              {blocks.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg border-border/30">
                  <p className="text-sm text-muted-foreground">কন্টেন্ট ব্লক যোগ করা হয়নি</p>
                </div>
              )}

              <Separator />

              {/* Publish Card */}
              <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                        <Sparkles className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{isEdit ? 'পোস্ট আপডেট করুন' : 'পোস্ট প্রকাশ করুন'}</p>
                        <p className="text-xs text-muted-foreground">
                          {isEdit ? 'পরিবর্তনগুলো সংরক্ষণ করুন' : 'সব তথ্য ঠিক থাকলে প্রকাশ করুন'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        {saving ? 'সেভ হচ্ছে...' : 'খসড়া সেভ'}
                      </Button>
                      <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        প্রকাশ
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SEO Settings */}
              <Card className="border-2">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="h-5 w-5 text-emerald-600" />
                    SEO সেটিংস
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span>পঠন সময়: <strong>{readingTime}</strong> মিনিট</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Meta Title</Label>
                    <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO টাইটেল (ডিফল্ট: শিরোনাম)" className="h-11 text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Meta Description</Label>
                    <Textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="SEO বিবরণ — ১৫০-১৬০ অক্ষরের মধ্যে রাখুন"
                      rows={3}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Canonical URL</Label>
                    <Input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://example.com/original-post" className="h-11 text-base" />
                  </div>
                </CardContent>
              </Card>

              {/* Post Settings */}
              <Card className="border-2">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ImageIcon className="h-5 w-5 text-emerald-600" />
                    পোস্ট সেটিংস
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50/60 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/30 dark:border-amber-800/20">
                    <div>
                      <Label className="text-base font-semibold">ফিচার্ড</Label>
                      <p className="text-xs text-muted-foreground">হোমপেজে বিশেষ স্থানে দেখানো হবে</p>
                    </div>
                    <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/30 dark:border-blue-800/20">
                    <div>
                      <Label className="text-base font-semibold">পিন করা</Label>
                      <p className="text-xs text-muted-foreground">তালিকার উপরে দেখানো হবে</p>
                    </div>
                    <Switch checked={isPinned} onCheckedChange={setIsPinned} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/30 dark:border-emerald-800/20">
                    <div>
                      <Label className="text-base font-semibold">কমেন্ট অনুমতি</Label>
                      <p className="text-xs text-muted-foreground">পাঠকরা কমেন্ট করতে পারবে</p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </EditorShell>
  )
}
