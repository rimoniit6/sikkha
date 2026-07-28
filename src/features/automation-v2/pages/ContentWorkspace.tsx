'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { QueryError } from '@/components/admin/QueryError'
import { useToast } from '@/hooks/use-toast'
import { fetchCsrfToken } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useRouterStore } from '@/store/router'
import { FileText, Loader2, Sparkles, Globe, Bot, CheckCircle2, Clock, Eye, Plus, Send } from 'lucide-react'

type Tab = 'overview' | 'generate' | 'drafts' | 'published'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'ওভারভিউ' },
  { key: 'generate', label: 'জেনারেট' },
  { key: 'drafts', label: 'ড্রাফট' },
  { key: 'published', label: 'প্রকাশিত' },
]

export default function ContentWorkspace() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const navigate = useRouterStore((s) => s.navigate)
  const { toast } = useToast()
  const qc = useQueryClient()

  // Data
  const { data: sourcesData } = useQuery({ queryKey: ['admin', 'automation-v2', 'sources'], queryFn: () => fetch('/api/admin/automation-v2/sources').then(r => r.json()).then(j => j.data ?? []), staleTime: 30_000 })
  const { data: providersData } = useQuery({ queryKey: ['admin', 'automation-v2', 'providers'], queryFn: () => fetch('/api/admin/automation-v2/providers').then(r => r.json()).then(j => j.data ?? []), staleTime: 30_000 })
  const activeProviders = Array.isArray(providersData) ? providersData.filter((p: any) => p.isActive) : []
  const sources = Array.isArray(sourcesData) ? sourcesData : []

  // Drafts + Published
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ['admin', 'blog', 'drafts'],
    queryFn: () => fetch('/api/admin/blog?status=DRAFT&limit=50').then(r => r.json()).then(j => j.data ?? []),
    staleTime: 15_000,
    enabled: activeTab === 'drafts' || activeTab === 'overview',
  })
  const { data: published, isLoading: publishedLoading } = useQuery({
    queryKey: ['admin', 'blog', 'published'],
    queryFn: () => fetch('/api/admin/blog?status=PUBLISHED&limit=50').then(r => r.json()).then(j => j.data ?? []),
    staleTime: 15_000,
    enabled: activeTab === 'published' || activeTab === 'overview',
  })

  const draftList = Array.isArray(drafts) ? drafts : []
  const publishedList = Array.isArray(published) ? published : []

  // Generate form
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [manualPrompt, setManualPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!selectedSource && !manualPrompt.trim()) {
      toast({ title: 'ত্রুটি', description: 'একটি সোর্স নির্বাচন করুন অথবা প্রম্পট লিখুন', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const csrf = await fetchCsrfToken()
      const res = await fetch('/api/admin/automation-v2/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ sourceId: selectedSource === '__none__' ? undefined : selectedSource || undefined, providerId: selectedProvider === '__none__' ? undefined : selectedProvider || undefined, manualPrompt: manualPrompt.trim() || undefined }),
      })
      const j = await res.json().then(j => j.data ?? j)
      if (!res.ok) throw new Error(j.error || 'Generation failed')
      toast({ title: '✅ জেনারেট সম্পন্ন', description: `"${j.title}" ড্রাফট হিসেবে সংরক্ষিত` })
      setManualPrompt('')
      qc.invalidateQueries({ queryKey: ['admin', 'blog', 'drafts'] })
    } catch (e) {
      toast({ title: 'ত্রুটি', description: e instanceof Error ? e.message : 'জেনারেট করতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally { setGenerating(false) }
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'এইমাত্র'; if (m < 60) return `${m}মি আগে`
    const h = Math.floor(m / 60); if (h < 24) return `${h}ঘ আগে`
    return `${Math.floor(h / 24)}দি আগে`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">কন্টেন্ট ওয়ার্কস্পেস</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />ড্রাফট</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{draftList.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />প্রকাশিত</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{publishedList.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />সোর্স</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{sources.length}</p></CardContent>
          </Card>
        </div>
      )}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">AI কন্টেন্ট জেনারেট</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>সোর্স (ঐচ্ছিক)</Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger><SelectValue placeholder="সোর্স নির্বাচন করুন..." /></SelectTrigger>
                  <SelectContent>                      <SelectItem value="__none__">কোনোটিই নয় (শুধু প্রম্পট)</SelectItem>
                    {Array.isArray(sources) && sources.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI প্রোভাইডার (ঐচ্ছিক)</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger><SelectValue placeholder="ডিফল্ট ব্যবহার করুন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ডিফল্ট</SelectItem>
                    {activeProviders.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.providerType})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>অতিরিক্ত নির্দেশনা (ঐচ্ছিক)</Label>
                <Textarea
                  placeholder="AI কে অতিরিক্ত নির্দেশনা দিন (যেমন: ভাষা সহজ রাখুন, নির্দিষ্ট কীওয়ার্ড ব্যবহার করুন)..."
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  rows={3}
                  className="resize-y"
                />
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'জেনারেট হচ্ছে...' : 'AI কন্টেন্ট জেনারেট'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drafts Tab */}
      {activeTab === 'drafts' && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>শিরোনাম</TableHead><TableHead className="w-32">তৈরি</TableHead><TableHead className="w-24 text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftList.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">কোনো ড্রাফট নেই। জেনারেট ট্যাব থেকে নতুন কন্টেন্ট তৈরি করুন।</TableCell></TableRow>
                ) : draftList.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate('admin-blog-editor' as const, { postId: p.id })}>
                          <Eye className="h-4 w-4 mr-1" />সম্পাদনা
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Published Tab */}
      {activeTab === 'published' && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>শিরোনাম</TableHead><TableHead className="w-32">প্রকাশিত</TableHead><TableHead className="w-20">ভিউ</TableHead><TableHead className="w-24 text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishedList.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">কোনো প্রকাশিত পোস্ট নেই।</TableCell></TableRow>
                ) : publishedList.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.publishedAt ? timeAgo(p.publishedAt) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.viewCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate('admin-blog-editor' as const, { postId: p.id })}>
                        <Eye className="h-4 w-4 mr-1" />দেখুন
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
