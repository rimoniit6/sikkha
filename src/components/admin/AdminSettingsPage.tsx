'use client'

import { Button } from '@/components/ui/button'
import { Dialog,DialogContent,DialogDescription,DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs'
import { QueryError } from '@/components/admin/QueryError'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/hooks/admin/use-settings'
import { settingsService } from '@/services/api/settings.service'
import { triggerDownload } from '@/lib/dom-utils'
import {
AlertTriangle,
CheckCircle2,
Database,
Loader2,
Palette,
Phone,
Save,
Scale,
Settings,
Share2,
Shield,
Trash2,
Wallet
} from 'lucide-react'
import React,{ useEffect,useState } from 'react'
import { GeneralTab } from './settings/GeneralTab'
import { AppearanceTab } from './settings/AppearanceTab'
import { UIContentTab } from './settings/UIContentTab'
import { MessagesTab, MESSAGE_CONFIG } from './settings/MessagesTab'
import { ContactTab } from './settings/ContactTab'
import { PaymentTab } from './settings/PaymentTab'
import { LegalTab } from './settings/LegalTab'
import { DatabaseTab } from './settings/DatabaseTab'
import { SecurityTab } from './settings/SecurityTab'

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const { settings, isLoading, isError, error, refetch, invalidate } = useSettings()
  const [siteName, setSiteName] = useState('শিক্ষা বাংলা')
  const [siteDescription, setSiteDescription] = useState('বাংলাদেশের সেরা শিক্ষা প্ল্যাটফর্ম')
  const [contactEmail, setContactEmail] = useState('info@shikhabangla.com')
  const [contactPhone, setContactPhone] = useState('+৮৮০ ১৭০০-০০০০০০')
  const [contactAddress, setContactAddress] = useState('')
  const [facebook, setFacebook] = useState('https://facebook.com/shikhabangla')
  const [youtube, setYoutube] = useState('https://youtube.com/@shikhabangla')
  const [telegram, setTelegram] = useState('https://t.me/shikhabangla')
  const [bkash, setBkash] = useState('01712345678')
  const [nagad, setNagad] = useState('01812345678')
  const [rocket, setRocket] = useState('01612345678')

  const [heroBadge, setHeroBadge] = useState('')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [statsSubtitle, setStatsSubtitle] = useState('')
  const [footerDescription, setFooterDescription] = useState('')
  const [premiumFeaturesText, setPremiumFeaturesText] = useState('')
  const [mcqFeaturesText, setMcqFeaturesText] = useState('')
  const [searchSuggestionsText, setSearchSuggestionsText] = useState('')

  const [homepageClassesBadge, setHomepageClassesBadge] = useState('')
  const [homepageClassesTitle, setHomepageClassesTitle] = useState('')
  const [homepageClassesSubtitle, setHomepageClassesSubtitle] = useState('')
  const [homepageBoardTitle, setHomepageBoardTitle] = useState('')
  const [homepageBoardSubtitle, setHomepageBoardSubtitle] = useState('')
  const [homepageMcqTitle, setHomepageMcqTitle] = useState('')
  const [homepageMcqSubtitle, setHomepageMcqSubtitle] = useState('')
  const [homepageFaqTitle, setHomepageFaqTitle] = useState('')
  const [homepageFaqSubtitle, setHomepageFaqSubtitle] = useState('')
  const [homepageTestimonialsTitle, setHomepageTestimonialsTitle] = useState('')
  const [homepageTestimonialsSubtitle, setHomepageTestimonialsSubtitle] = useState('')
  const [homepageStatsTitle, setHomepageStatsTitle] = useState('')
  const [homepageStatsSubtitleState, setHomepageStatsSubtitleState] = useState('')
  const [homepageFeaturedTitle, setHomepageFeaturedTitle] = useState('')
  const [homepageFeaturedSubtitle, setHomepageFeaturedSubtitle] = useState('')
  const [homepagePremiumTitle, setHomepagePremiumTitle] = useState('')
  const [homepagePremiumSubtitle, setHomepagePremiumSubtitle] = useState('')
  const [homepageTeachersTitle, setHomepageTeachersTitle] = useState('')
  const [homepageTeachersSubtitle, setHomepageTeachersSubtitle] = useState('')
  const [homepageExamTitle, setHomepageExamTitle] = useState('')
  const [homepageExamSubtitle, setHomepageExamSubtitle] = useState('')
  const [homepageExam1Name, setHomepageExam1Name] = useState('')
  const [homepageExam1Date, setHomepageExam1Date] = useState('')
  const [homepageExam1DateLabel, setHomepageExam1DateLabel] = useState('')
  const [homepageExam2Name, setHomepageExam2Name] = useState('')
  const [homepageExam2Date, setHomepageExam2Date] = useState('')
  const [homepageExam2DateLabel, setHomepageExam2DateLabel] = useState('')

  const [messages, setMessages] = useState<Record<string, string>>({})

  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoKeywords, setSeoKeywords] = useState('')
  const [seoAuthor, setSeoAuthor] = useState('')

  const [privacyContent, setPrivacyContent] = useState('')
  const [termsContent, setTermsContent] = useState('')

  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [enableCsrfProtection, setEnableCsrfProtection] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<Record<string, { imported: number; errors: number }> | null>(null)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isLoading) return
    const map = settings?.map
    if (!map) return
    if (map.siteName) setSiteName(map.siteName)
    if (map.siteDescription) setSiteDescription(map.siteDescription)
    if (map.contactEmail) setContactEmail(map.contactEmail)
    if (map.contactPhone) setContactPhone(map.contactPhone)
    if (map.contactAddress) setContactAddress(map.contactAddress)
    if (map.facebook) setFacebook(map.facebook)
    if (map.youtube) setYoutube(map.youtube)
    if (map.telegram) setTelegram(map.telegram)
    if (map.bkash) setBkash(map.bkash)
    if (map.nagad) setNagad(map.nagad)
    if (map.rocket) setRocket(map.rocket)
    if (map.heroBadge) setHeroBadge(map.heroBadge)
    if (map.heroTitle) setHeroTitle(map.heroTitle)
    if (map.heroSubtitle) setHeroSubtitle(map.heroSubtitle)
    if (map.statsSubtitle) setStatsSubtitle(map.statsSubtitle)
    if (map.footerDescription) setFooterDescription(map.footerDescription)
    if (map.premiumFeatures) {
      try { setPremiumFeaturesText(JSON.parse(map.premiumFeatures).join('\n')) } catch { setPremiumFeaturesText(map.premiumFeatures) }
    }
    if (map.mcqFeatures) {
      try { setMcqFeaturesText(JSON.parse(map.mcqFeatures).join('\n')) } catch { setMcqFeaturesText(map.mcqFeatures) }
    }
    if (map.searchSuggestions) {
      try { setSearchSuggestionsText(JSON.parse(map.searchSuggestions).join('\n')) } catch { setSearchSuggestionsText(map.searchSuggestions) }
    }
    if (map.logo) setLogoUrl(map.logo)
    if (map.favicon) setFaviconUrl(map.favicon)
    if (map.enableCsrfProtection) setEnableCsrfProtection(map.enableCsrfProtection === 'true')
    if (map.seo_title) setSeoTitle(map.seo_title)
    if (map.seo_description) setSeoDescription(map.seo_description)
    if (map.seo_keywords) setSeoKeywords(map.seo_keywords)
    if (map.seo_author) setSeoAuthor(map.seo_author)
    if (map.privacy_content) setPrivacyContent(map.privacy_content)
    if (map.terms_content) setTermsContent(map.terms_content)
    if (map.homepage_classes_badge) setHomepageClassesBadge(map.homepage_classes_badge)
    if (map.homepage_classes_title) setHomepageClassesTitle(map.homepage_classes_title)
    if (map.homepage_classes_subtitle) setHomepageClassesSubtitle(map.homepage_classes_subtitle)
    if (map.homepage_board_title) setHomepageBoardTitle(map.homepage_board_title)
    if (map.homepage_board_subtitle) setHomepageBoardSubtitle(map.homepage_board_subtitle)
    if (map.homepage_mcq_title) setHomepageMcqTitle(map.homepage_mcq_title)
    if (map.homepage_mcq_subtitle) setHomepageMcqSubtitle(map.homepage_mcq_subtitle)
    if (map.homepage_faq_title) setHomepageFaqTitle(map.homepage_faq_title)
    if (map.homepage_faq_subtitle) setHomepageFaqSubtitle(map.homepage_faq_subtitle)
    if (map.homepage_testimonials_title) setHomepageTestimonialsTitle(map.homepage_testimonials_title)
    if (map.homepage_testimonials_subtitle) setHomepageTestimonialsSubtitle(map.homepage_testimonials_subtitle)
    if (map.homepage_stats_title) setHomepageStatsTitle(map.homepage_stats_title)
    if (map.homepage_stats_subtitle) setHomepageStatsSubtitleState(map.homepage_stats_subtitle)
    if (map.homepage_featured_title) setHomepageFeaturedTitle(map.homepage_featured_title)
    if (map.homepage_featured_subtitle) setHomepageFeaturedSubtitle(map.homepage_featured_subtitle)
    if (map.homepage_premium_title) setHomepagePremiumTitle(map.homepage_premium_title)
    if (map.homepage_premium_subtitle) setHomepagePremiumSubtitle(map.homepage_premium_subtitle)
    if (map.homepage_teachers_title) setHomepageTeachersTitle(map.homepage_teachers_title)
    if (map.homepage_teachers_subtitle) setHomepageTeachersSubtitle(map.homepage_teachers_subtitle)
    if (map.homepage_exam_title) setHomepageExamTitle(map.homepage_exam_title)
    if (map.homepage_exam_subtitle) setHomepageExamSubtitle(map.homepage_exam_subtitle)
    if (map.homepage_exam1_name) setHomepageExam1Name(map.homepage_exam1_name)
    if (map.homepage_exam1_date) setHomepageExam1Date(map.homepage_exam1_date)
    if (map.homepage_exam1_date_label) setHomepageExam1DateLabel(map.homepage_exam1_date_label)
    if (map.homepage_exam2_name) setHomepageExam2Name(map.homepage_exam2_name)
    if (map.homepage_exam2_date) setHomepageExam2Date(map.homepage_exam2_date)
    if (map.homepage_exam2_date_label) setHomepageExam2DateLabel(map.homepage_exam2_date_label)
    const msgMap: Record<string, string> = {}
    for (const key of Object.keys(map)) {
      if (key.startsWith('msg_')) msgMap[key] = map[key]
    }
    setMessages(msgMap)
  }, [settings, isLoading])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings = [
        { key: 'siteName', value: siteName },
        { key: 'siteDescription', value: siteDescription },
        { key: 'contactEmail', value: contactEmail },
        { key: 'contactPhone', value: contactPhone },
        { key: 'contactAddress', value: contactAddress, group: 'contact', label: 'ঠিকানা' },
        { key: 'facebook', value: facebook },
        { key: 'youtube', value: youtube },
        { key: 'telegram', value: telegram },
        { key: 'bkash', value: bkash },
        { key: 'nagad', value: nagad },
        { key: 'rocket', value: rocket },
        { key: 'heroBadge', value: heroBadge },
        { key: 'heroTitle', value: heroTitle },
        { key: 'heroSubtitle', value: heroSubtitle },
        { key: 'statsSubtitle', value: statsSubtitle },
        { key: 'footerDescription', value: footerDescription },
        { key: 'premiumFeatures', value: JSON.stringify(premiumFeaturesText.split('\n').filter(Boolean)) },
        { key: 'mcqFeatures', value: JSON.stringify(mcqFeaturesText.split('\n').filter(Boolean)) },
        { key: 'searchSuggestions', value: JSON.stringify(searchSuggestionsText.split('\n').filter(Boolean)) },
        ...(logoUrl ? [{ key: 'logo', value: logoUrl }] : []),
        ...(faviconUrl ? [{ key: 'favicon', value: faviconUrl }] : []),
        { key: 'seo_title', value: seoTitle, group: 'seo', label: 'সাইট শিরোনাম (SEO Title)' },
        { key: 'seo_description', value: seoDescription, group: 'seo', label: 'সাইট বিবরণ (SEO Description)' },
        { key: 'seo_keywords', value: seoKeywords, group: 'seo', label: 'কীওয়ার্ড (SEO Keywords)' },
        { key: 'seo_author', value: seoAuthor, group: 'seo', label: 'লেখক (SEO Author)' },
        { key: 'privacy_content', value: privacyContent, group: 'legal', label: 'প্রাইভেসি পলিসি কন্টেন্ট' },
        { key: 'terms_content', value: termsContent, group: 'legal', label: 'শর্তাবলী কন্টেন্ট' },
        { key: 'enableCsrfProtection', value: String(enableCsrfProtection), group: 'security', label: 'CSRF সুরক্ষা সক্রিয়' },
        { key: 'homepage_classes_badge', value: homepageClassesBadge, group: 'homepage', label: 'হিরো ব্যাজ' },
        { key: 'homepage_classes_title', value: homepageClassesTitle, group: 'homepage', label: 'শ্রেণি সেকশন শিরোনাম' },
        { key: 'homepage_classes_subtitle', value: homepageClassesSubtitle, group: 'homepage', label: 'শ্রেণি সেকশন উপশিরোনাম' },
        { key: 'homepage_board_title', value: homepageBoardTitle, group: 'homepage', label: 'বোর্ড প্রশ্ন সেকশন শিরোনাম' },
        { key: 'homepage_board_subtitle', value: homepageBoardSubtitle, group: 'homepage', label: 'বোর্ড প্রশ্ন সেকশন উপশিরোনাম' },
        { key: 'homepage_mcq_title', value: homepageMcqTitle, group: 'homepage', label: 'MCQ সেকশন শিরোনাম' },
        { key: 'homepage_mcq_subtitle', value: homepageMcqSubtitle, group: 'homepage', label: 'MCQ সেকশন উপশিরোনাম' },
        { key: 'homepage_faq_title', value: homepageFaqTitle, group: 'homepage', label: 'FAQ সেকশন শিরোনাম' },
        { key: 'homepage_faq_subtitle', value: homepageFaqSubtitle, group: 'homepage', label: 'FAQ সেকশন উপশিরোনাম' },
        { key: 'homepage_testimonials_title', value: homepageTestimonialsTitle, group: 'homepage', label: 'টেস্টিমোনিয়াল সেকশন শিরোনাম' },
        { key: 'homepage_testimonials_subtitle', value: homepageTestimonialsSubtitle, group: 'homepage', label: 'টেস্টিমোনিয়াল সেকশন উপশিরোনাম' },
        { key: 'homepage_stats_title', value: homepageStatsTitle, group: 'homepage', label: 'পরিসংখ্যান সেকশন শিরোনাম' },
        { key: 'homepage_stats_subtitle', value: homepageStatsSubtitleState, group: 'homepage', label: 'পরিসংখ্যান সেকশন উপশিরোনাম' },
        { key: 'homepage_featured_title', value: homepageFeaturedTitle, group: 'homepage', label: 'ফিচার্ড সেকশন শিরোনাম' },
        { key: 'homepage_featured_subtitle', value: homepageFeaturedSubtitle, group: 'homepage', label: 'ফিচার্ড সেকশন উপশিরোনাম' },
        { key: 'homepage_premium_title', value: homepagePremiumTitle, group: 'homepage', label: 'প্রিমিয়াম ব্যানার শিরোনাম' },
        { key: 'homepage_premium_subtitle', value: homepagePremiumSubtitle, group: 'homepage', label: 'প্রিমিয়াম ব্যানার উপশিরোনাম' },
        { key: 'homepage_teachers_title', value: homepageTeachersTitle, group: 'homepage', label: 'শিক্ষক সেকশন শিরোনাম' },
        { key: 'homepage_teachers_subtitle', value: homepageTeachersSubtitle, group: 'homepage', label: 'শিক্ষক সেকশন উপশিরোনাম' },
        { key: 'homepage_exam_title', value: homepageExamTitle, group: 'homepage', label: 'পরীক্ষা কাউন্টডাউন শিরোনাম' },
        { key: 'homepage_exam_subtitle', value: homepageExamSubtitle, group: 'homepage', label: 'পরীক্ষা কাউন্টডাউন উপশিরোনাম' },
        { key: 'homepage_exam1_name', value: homepageExam1Name, group: 'homepage', label: 'পরীক্ষা ১ — নাম' },
        { key: 'homepage_exam1_date', value: homepageExam1Date, group: 'homepage', label: 'পরীক্ষা ১ — তারিখ' },
        { key: 'homepage_exam1_date_label', value: homepageExam1DateLabel, group: 'homepage', label: 'পরীক্ষা ১ — তারিখ লেবেল' },
        { key: 'homepage_exam2_name', value: homepageExam2Name, group: 'homepage', label: 'পরীক্ষা ২ — নাম' },
        { key: 'homepage_exam2_date', value: homepageExam2Date, group: 'homepage', label: 'পরীক্ষা ২ — তারিখ' },
        { key: 'homepage_exam2_date_label', value: homepageExam2DateLabel, group: 'homepage', label: 'পরীক্ষা ২ — তারিখ লেবেল' },
        ...Object.entries(messages).map(([key, value]) => ({
          key, value, group: 'messages' as const,
          label: MESSAGE_CONFIG.find(m => m.key === key)?.label || key,
        })),
      ]

      await settingsService.update(settings)

      toast({ title: 'সেটিংস সংরক্ষিত হয়েছে' })
      invalidate()
    } catch {
      // Errors are surfaced globally by ApiErrorHandler
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/database/export')
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        triggerDownload(url, `database-backup-${new Date().toISOString().slice(0, 10)}.json`)
        URL.revokeObjectURL(url)
        toast({ title: 'এক্সপোর্ট সফল হয়েছে' })
      } else {
        toast({ title: 'ত্রুটি', description: 'এক্সপোর্ট করতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'এক্সপোর্ট করতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportProgress(0)
    setImportResults(null)
    try {
      const text = await importFile.text()
      const data = JSON.parse(text)

      setImportProgress(10)

      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      setImportProgress(80)

      if (res.ok) {
        const result = await res.json()
        setImportResults(result.results || null)
        setImportProgress(100)
        toast({ title: 'ইম্পোর্ট সফল হয়েছে' })
      } else {
        const err = await res.json()
        toast({ title: 'ত্রুটি', description: err.error || 'ইম্পোর্ট করতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'ফাইল পড়তে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== 'ডিলিট করুন') return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/database/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE_ALL_DATA_CONFIRMED' }),
      })
      if (res.ok) {
        toast({ title: 'সকল ডাটা ডিলিট হয়েছে' })
        cancelDelete()
      } else {
        toast({ title: 'ত্রুটি', description: 'ডিলিট করতে সমস্যা হয়েছে', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'ত্রুটি', description: 'ডিলিট করতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteStep(0)
    setDeleteConfirmText('')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (isError) {
    return <QueryError error={error} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6 text-emerald-600" /> সেটিংস</h1>
          <p className="text-muted-foreground text-sm mt-1">সাইটের সেটিংস পরিচালনা করুন</p>
        </div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-9 max-w-4xl">
          <TabsTrigger value="general">সাধারণ</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="size-3.5" />
            উপস্থিতি
          </TabsTrigger>
          <TabsTrigger value="ui-content">হোমপেজ</TabsTrigger>
          <TabsTrigger value="messages">মেসেজ</TabsTrigger>
          <TabsTrigger value="contact">যোগাযোগ</TabsTrigger>
          <TabsTrigger value="payment">পেমেন্ট</TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5">
            <Scale className="size-3.5" />
            লিগ্যাল
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="size-3.5" />
            নিরাপত্তা
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5">
            <Database className="size-3.5" />
            ডাটাবেজ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab
            siteName={siteName} setSiteName={setSiteName}
            siteDescription={siteDescription} setSiteDescription={setSiteDescription}
            seoTitle={seoTitle} setSeoTitle={setSeoTitle}
            seoDescription={seoDescription} setSeoDescription={setSeoDescription}
            seoKeywords={seoKeywords} setSeoKeywords={setSeoKeywords}
            seoAuthor={seoAuthor} setSeoAuthor={setSeoAuthor}
          />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTab
            logoUrl={logoUrl} setLogoUrl={setLogoUrl}
            faviconUrl={faviconUrl} setFaviconUrl={setFaviconUrl}
          />
        </TabsContent>

        <TabsContent value="ui-content">
          <UIContentTab
            heroBadge={heroBadge} setHeroBadge={setHeroBadge}
            heroTitle={heroTitle} setHeroTitle={setHeroTitle}
            heroSubtitle={heroSubtitle} setHeroSubtitle={setHeroSubtitle}
            homepageClassesBadge={homepageClassesBadge} setHomepageClassesBadge={setHomepageClassesBadge}
            homepageClassesTitle={homepageClassesTitle} setHomepageClassesTitle={setHomepageClassesTitle}
            homepageClassesSubtitle={homepageClassesSubtitle} setHomepageClassesSubtitle={setHomepageClassesSubtitle}
            homepageBoardTitle={homepageBoardTitle} setHomepageBoardTitle={setHomepageBoardTitle}
            homepageBoardSubtitle={homepageBoardSubtitle} setHomepageBoardSubtitle={setHomepageBoardSubtitle}
            homepageMcqTitle={homepageMcqTitle} setHomepageMcqTitle={setHomepageMcqTitle}
            homepageMcqSubtitle={homepageMcqSubtitle} setHomepageMcqSubtitle={setHomepageMcqSubtitle}
            homepageFaqTitle={homepageFaqTitle} setHomepageFaqTitle={setHomepageFaqTitle}
            homepageFaqSubtitle={homepageFaqSubtitle} setHomepageFaqSubtitle={setHomepageFaqSubtitle}
            homepageTestimonialsTitle={homepageTestimonialsTitle} setHomepageTestimonialsTitle={setHomepageTestimonialsTitle}
            homepageTestimonialsSubtitle={homepageTestimonialsSubtitle} setHomepageTestimonialsSubtitle={setHomepageTestimonialsSubtitle}
            homepageStatsTitle={homepageStatsTitle} setHomepageStatsTitle={setHomepageStatsTitle}
            homepageStatsSubtitleState={homepageStatsSubtitleState} setHomepageStatsSubtitleState={setHomepageStatsSubtitleState}
            homepageFeaturedTitle={homepageFeaturedTitle} setHomepageFeaturedTitle={setHomepageFeaturedTitle}
            homepageFeaturedSubtitle={homepageFeaturedSubtitle} setHomepageFeaturedSubtitle={setHomepageFeaturedSubtitle}
            homepagePremiumTitle={homepagePremiumTitle} setHomepagePremiumTitle={setHomepagePremiumTitle}
            homepagePremiumSubtitle={homepagePremiumSubtitle} setHomepagePremiumSubtitle={setHomepagePremiumSubtitle}
            homepageTeachersTitle={homepageTeachersTitle} setHomepageTeachersTitle={setHomepageTeachersTitle}
            homepageTeachersSubtitle={homepageTeachersSubtitle} setHomepageTeachersSubtitle={setHomepageTeachersSubtitle}
            homepageExamTitle={homepageExamTitle} setHomepageExamTitle={setHomepageExamTitle}
            homepageExamSubtitle={homepageExamSubtitle} setHomepageExamSubtitle={setHomepageExamSubtitle}
            homepageExam1Name={homepageExam1Name} setHomepageExam1Name={setHomepageExam1Name}
            homepageExam1Date={homepageExam1Date} setHomepageExam1Date={setHomepageExam1Date}
            homepageExam1DateLabel={homepageExam1DateLabel} setHomepageExam1DateLabel={setHomepageExam1DateLabel}
            homepageExam2Name={homepageExam2Name} setHomepageExam2Name={setHomepageExam2Name}
            homepageExam2Date={homepageExam2Date} setHomepageExam2Date={setHomepageExam2Date}
            homepageExam2DateLabel={homepageExam2DateLabel} setHomepageExam2DateLabel={setHomepageExam2DateLabel}
            footerDescription={footerDescription} setFooterDescription={setFooterDescription}
            premiumFeaturesText={premiumFeaturesText} setPremiumFeaturesText={setPremiumFeaturesText}
            mcqFeaturesText={mcqFeaturesText} setMcqFeaturesText={setMcqFeaturesText}
            searchSuggestionsText={searchSuggestionsText} setSearchSuggestionsText={setSearchSuggestionsText}
          />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab messages={messages} setMessages={setMessages} />
        </TabsContent>

        <TabsContent value="contact">
          <ContactTab
            contactEmail={contactEmail} setContactEmail={setContactEmail}
            contactPhone={contactPhone} setContactPhone={setContactPhone}
            contactAddress={contactAddress} setContactAddress={setContactAddress}
            facebook={facebook} setFacebook={setFacebook}
            youtube={youtube} setYoutube={setYoutube}
            telegram={telegram} setTelegram={setTelegram}
          />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentTab
            bkash={bkash} setBkash={setBkash}
            nagad={nagad} setNagad={setNagad}
            rocket={rocket} setRocket={setRocket}
          />
        </TabsContent>

        <TabsContent value="legal">
          <LegalTab
            privacyContent={privacyContent} setPrivacyContent={setPrivacyContent}
            termsContent={termsContent} setTermsContent={setTermsContent}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab
            enableCsrfProtection={enableCsrfProtection}
            setEnableCsrfProtection={setEnableCsrfProtection}
            isProduction={process.env.NODE_ENV === 'production'}
          />
        </TabsContent>

        <TabsContent value="database">
          <DatabaseTab
            exporting={exporting} handleExport={handleExport}
            importFile={importFile} setImportFile={setImportFile}
            importing={importing} importProgress={importProgress}
            importResults={importResults} setImportResults={setImportResults}
            handleImport={handleImport}
            deleteStep={deleteStep} setDeleteStep={setDeleteStep}
            deleteConfirmText={deleteConfirmText} setDeleteConfirmText={setDeleteConfirmText}
            deleting={deleting} handleDeleteAll={handleDeleteAll} cancelDelete={cancelDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation overlay dialog */}
      <Dialog open={deleteStep >= 1} onOpenChange={(open) => { if (!open) cancelDelete() }}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="size-5" /> সকল ডাটা ডিলিট করুন
          </DialogTitle>
          <DialogDescription className="sr-only">ডাটাবেজ রিসেট কনফার্মেশন</DialogDescription>
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    deleteStep > step ? 'bg-emerald-500 text-white' : deleteStep === step ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {deleteStep > step ? <CheckCircle2 className="size-4" /> : step}
                  </div>
                  {step < 3 && <div className={`h-0.5 flex-1 transition-colors ${deleteStep > step ? 'bg-emerald-500' : 'bg-muted'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className={`p-4 rounded-lg border-2 transition-colors ${deleteStep === 1 ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30' : deleteStep > 1 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-muted bg-muted/30'}`}>
              <span className="font-medium text-sm">ধাপ ১: আপনি কি নিশ্চিত?</span>
              <p className="text-sm text-muted-foreground mt-1">সকল ডাটা ডিলিট হয়ে যাবে। সুপার অ্যাডমিন .env থেকে পুনরায় তৈরি হবে।</p>
              {deleteStep === 1 && (
                <div className="flex gap-2 mt-3">
                  <Button variant="destructive" size="sm" onClick={() => setDeleteStep(2)}>হ্যাঁ, আমি নিশ্চিত</Button>
                  <Button variant="outline" size="sm" onClick={cancelDelete}>বাতিল</Button>
                </div>
              )}
            </div>
            {deleteStep >= 2 && (
              <div className={`p-4 rounded-lg border-2 transition-colors ${deleteStep === 2 ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30' : deleteStep > 2 ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-muted bg-muted/30'}`}>
                <span className="font-medium text-sm">ধাপ ২: এটি অপরিবর্তনীয়!</span>
                <p className="text-sm text-muted-foreground mt-1">ডাটা আর কখনো ফিরে পাওয়া যাবে না।</p>
                {deleteStep === 2 && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="destructive" size="sm" onClick={() => setDeleteStep(3)}>হ্যাঁ, সব মুছে ফেলুন</Button>
                    <Button variant="outline" size="sm" onClick={cancelDelete}>বাতিল</Button>
                  </div>
                )}
              </div>
            )}
            {deleteStep >= 3 && (
              <div className="p-4 rounded-lg border-2 border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/40">
                <span className="font-medium text-sm text-red-700 dark:text-red-300">ধাপ ৩: টাইপ করুন &quot;ডিলিট করুন&quot;</span>
                <p className="text-sm text-muted-foreground mt-1 mb-3">নিচে <strong className="text-red-600">&quot;ডিলিট করুন&quot;</strong> লিখুন:</p>
                <div className="space-y-3">
                  <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder='ডিলিট করুন' className="border-red-300 focus:border-red-500 dark:border-red-700" autoFocus />
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deleteConfirmText !== 'ডিলিট করুন' || deleting} className="gap-2">
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      {deleting ? 'ডিলিট হচ্ছে...' : 'সকল ডাটা ডিলিট করুন'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelDelete} disabled={deleting}>বাতিল</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
