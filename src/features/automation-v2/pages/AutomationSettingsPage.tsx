'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QueryError } from '@/components/admin/QueryError'
import { useToast } from '@/hooks/use-toast'
import { fetchCsrfToken } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Settings, Loader2, Save, Sparkles, Globe, Rss, FileText,
  Pencil, RotateCcw, Eye,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SettingsData {
  default_provider: string
  default_prompt: string
  posts_per_run: string
  auto_publish: string
  language: string
  timezone: string
}

interface SourceItem {
  id: string
  name: string
  sourceType: string
  url: string
  config: string | null
  updatedAt: string
  isActive: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  RSS: 'RSS Feed',
  SITEMAP: 'Sitemap',
  WEBSITE: 'Website',
  MANUAL_URL: 'Manual URL',
}

const SOURCE_TYPE_ICONS: Record<string, typeof Globe> = {
  RSS: Rss,
  SITEMAP: Globe,
  WEBSITE: Globe,
  MANUAL_URL: FileText,
}

const DEFAULT_SETTINGS: SettingsData = {
  default_provider: 'GEMINI',
  default_prompt: '',
  posts_per_run: '5',
  auto_publish: 'false',
  language: 'bn',
  timezone: 'Asia/Dhaka',
}

const VARIABLE_HINTS = [
  { key: '{{organization}}', desc: 'সংস্থার নাম' },
  { key: '{{title}}', desc: 'কন্টেন্টের শিরোনাম' },
  { key: '{{content}}', desc: 'কন্টেন্টের মূল অংশ' },
  { key: '{{url}}', desc: 'সোর্স URL' },
  { key: '{{publish_date}}', desc: 'প্রকাশের তারিখ' },
  { key: '{{deadline}}', desc: 'আবেদনের শেষ তারিখ' },
  { key: '{{source_name}}', desc: 'সোর্সের নাম' },
  { key: '{{today}}', desc: 'আজকের তারিখ' },
  { key: '{{language}}', desc: 'ভাষা' },
]

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AutomationSettingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  // Prompt editor state
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null)
  const [promptText, setPromptText] = useState('')

  // ── Queries ──────────────────────────────────────────────────────

  const { data: settingsData, isLoading: settingsLoading, isError: settingsError, error: settingsErr, refetch: refetchSettings } = useQuery({
    queryKey: ['admin', 'automation-v2', 'settings'],
    queryFn: () => fetch('/api/admin/automation-v2/settings').then((r) => {
      if (!r.ok) throw new Error('Failed to load settings')
      return r.json().then((j) => j.data ?? j)
    }),
    staleTime: 30_000,
  })

  const { data: sourcesData, isLoading: sourcesLoading, isError: sourcesError, error: sourcesErr, refetch: refetchSources } = useQuery({
    queryKey: ['admin', 'automation-v2', 'sources'],
    queryFn: () => fetch('/api/admin/automation-v2/sources').then((r) => r.json()).then((j) => j.data ?? []),
    staleTime: 30_000,
  })

  const sources: SourceItem[] = Array.isArray(sourcesData) ? sourcesData : []
  const loading = settingsLoading || sourcesLoading

  // ── Global Settings Form ─────────────────────────────────────────

  const [form, setForm] = useState<SettingsData | null>(null)

  useEffect(() => {
    if (settingsData && !form) setForm(settingsData as SettingsData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData])

  const formData = form ?? settingsData ?? DEFAULT_SETTINGS

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const csrfToken = await fetchCsrfToken()
      const res = await fetch('/api/admin/automation-v2/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast({ title: '✅ সেটিংস সংরক্ষিত হয়েছে' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'settings'] })
    } catch {
      toast({ title: 'ত্রুটি', description: 'সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Source Prompt Editor ─────────────────────────────────────────

  const openPromptEditor = (source: SourceItem) => {
    setEditingSource(source)
    // Parse the existing config JSON to extract systemPrompt
    let existingPrompt = ''
    if (source.config) {
      try {
        const parsed = JSON.parse(source.config)
        existingPrompt = parsed.systemPrompt || ''
      } catch { /* ignore */ }
    }
    setPromptText(existingPrompt)
    setPromptDialogOpen(true)
  }

  const resetPrompt = () => {
    setPromptText('')
  }

  const savePromptMutation = useMutation({
    mutationFn: async () => {
      if (!editingSource) return
      const csrf = await fetchCsrfToken()
      // Build the config JSON. If promptText is empty, set config to null (remove custom prompt)
      const configPayload = promptText.trim()
        ? JSON.stringify({
            systemPrompt: promptText.trim(),
            version: editingSource.config
              ? (JSON.parse(editingSource.config).version || 0) + 1
              : 1,
            updatedAt: new Date().toISOString(),
          })
        : null

      const res = await fetch(`/api/admin/automation-v2/sources/${editingSource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ promptConfig: configPayload }),
      })
      if (!res.ok) throw new Error('Failed to save prompt')
    },
    onSuccess: () => {
      toast({ title: '✅ প্রম্পট সংরক্ষিত হয়েছে' })
      setPromptDialogOpen(false)
      setEditingSource(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'sources'] })
    },
    onError: (e) => {
      toast({ title: 'ত্রুটি', description: e instanceof Error ? e.message : 'প্রম্পট সংরক্ষণ করতে সমস্যা', variant: 'destructive' })
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────

  const getPromptStatus = (source: SourceItem): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
    if (source.config) {
      try {
        const parsed = JSON.parse(source.config)
        if (parsed.systemPrompt) return { label: 'কাস্টম', variant: 'default' }
      } catch { /* ignore */ }
    }
    return { label: 'ডিফল্ট', variant: 'secondary' }
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'এইমাত্র'
    if (m < 60) return `${m}মি আগে`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}ঘ আগে`
    return `${Math.floor(h / 24)}দি আগে`
  }

  // ── Loading / Error ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    )
  }

  if (settingsError) return <QueryError error={settingsErr} onRetry={refetchSettings} />
  if (sourcesError) return <QueryError error={sourcesErr} onRetry={refetchSources} />

  /* ═══════════════════════════════════════════════════════════════ */
  /*  RENDER                                                         */
  /* ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            অটোমেশন সেটিংস
          </h1>
          <p className="text-muted-foreground text-sm mt-1">AI কন্টেন্ট অটোমেশনের গ্লোবাল সেটিংস ও প্রম্পট ম্যানেজমেন্ট</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  SECTION 1: GLOBAL PREFERENCES                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            পছন্দসমূহ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Default Provider */}
          <div className="space-y-2">
            <Label>ডিফল্ট প্রোভাইডার</Label>
            <Select value={formData.default_provider} onValueChange={(v) => setForm({ ...formData, default_provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GEMINI">Gemini</SelectItem>
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="OPENROUTER">OpenRouter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Prompt */}
          <div className="space-y-2">
            <Label>গ্লোবাল ডিফল্ট প্রম্পট</Label>
            <p className="text-xs text-muted-foreground">কোনো সোর্সের নিজস্ব প্রম্পট না থাকলে এই প্রম্পট ব্যবহার করা হবে</p>
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder="প্রতিটি জেনারেশনের সাথে যোগ করার জন্য অতিরিক্ত নির্দেশনা..."
              value={formData.default_prompt}
              onChange={(e) => setForm({ ...formData, default_prompt: e.target.value })}
            />
          </div>

          {/* Posts Per Run */}
          <div className="space-y-2">
            <Label>প্রতি রানে পোস্ট সংখ্যা</Label>
            <Input
              type="number" min={1} max={20}
              value={formData.posts_per_run}
              onChange={(e) => setForm({ ...formData, posts_per_run: e.target.value })}
            />
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>ভাষা</Label>
            <Select value={formData.language} onValueChange={(v) => setForm({ ...formData, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bn">বাংলা</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>টাইমজোন</Label>
            <Select value={formData.timezone} onValueChange={(v) => setForm({ ...formData, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Dhaka">Asia/Dhaka (UTC+6)</SelectItem>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto Publish */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="text-sm font-medium">অটো পাবলিশ</Label>
              <p className="text-xs text-muted-foreground">জেনারেট করার পর সরাসরি প্রকাশ করুন</p>
            </div>
            <Switch
              checked={formData.auto_publish === 'true'}
              onCheckedChange={(v) => setForm({ ...formData, auto_publish: v ? 'true' : 'false' })}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  SECTION 2: PER-SOURCE PROMPT MANAGEMENT                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            প্রম্পট ম্যানেজমেন্ট
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            প্রতিটি সোর্সের জন্য আলাদা AI প্রম্পট সেট করুন। ডিফল্ট প্রম্পট ওভাররাইড করতে কাস্টম প্রম্পট যোগ করুন।
          </p>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>কোনো সোর্স নেই। প্রথমে একটি সোর্স তৈরি করুন।</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const Icon = SOURCE_TYPE_ICONS[source.sourceType] || Globe
                const status = getPromptStatus(source)
                let version = 0
                if (source.config) {
                  try {
                    const parsed = JSON.parse(source.config)
                    version = parsed.version || 0
                  } catch { /* ignore */ }
                }

                return (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/40 transition-colors"
                  >
                    {/* Left: source info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {SOURCE_TYPE_LABELS[source.sourceType] || source.sourceType}
                          {version > 0 && <span className="ml-2">v{version}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openPromptEditor(source)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        প্রম্পট
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  PROMPT EDITOR DIALOG                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Dialog open={promptDialogOpen} onOpenChange={(open) => {
        if (!open) { setPromptDialogOpen(false); setEditingSource(null) }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {editingSource?.name || 'সোর্স'} — প্রম্পট এডিটর
            </DialogTitle>
            <DialogDescription>
              আপনার সোর্সের জন্য কাস্টম AI প্রম্পট লিখুন। খালি রাখলে গ্লোবাল ডিফল্ট প্রম্পট ব্যবহার হবে।
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            {/* Editor */}
            <div className="md:col-span-2 space-y-2">
              <Label>সিস্টেম প্রম্পট</Label>
              <textarea
                className="w-full min-h-[350px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono resize-y leading-relaxed"
                placeholder="AI কে নির্দেশনা দিন... (খালি রাখলে গ্লোবাল ডিফল্ট ব্যবহার হবে)"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
            </div>

            {/* Variable hints */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">ভেরিয়েবল সমূহ</Label>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                {VARIABLE_HINTS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="block w-full text-left px-2 py-1 rounded text-xs hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => setPromptText((prev) => prev + v.key)}
                  >
                    <code className="text-emerald-600 font-medium">{v.key}</code>
                    <span className="text-muted-foreground ml-1">{v.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                ভেরিয়েবলের উপর ক্লিক করলে প্রম্পটে যুক্ত হবে। জেনারেশনের সময় স্বয়ংক্রিয়ভাবে প্রতিস্থাপিত হবে।
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetPrompt}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              রিসেট (ডিফল্ট)
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => { setPromptDialogOpen(false); setEditingSource(null) }}>
              বাতিল
            </Button>
            <Button
              onClick={() => savePromptMutation.mutate()}
              disabled={savePromptMutation.isPending}
              className="gap-2"
            >
              {savePromptMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />
              }
              {savePromptMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'প্রম্পট সংরক্ষণ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
