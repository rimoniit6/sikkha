'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QueryError } from '@/components/admin/QueryError'
import { useToast } from '@/hooks/use-toast'
import { fetchCsrfToken } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Bot, Sparkles, Globe, Wifi, WifiOff, RefreshCw, KeyRound } from 'lucide-react'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  GEMINI: { label: 'Gemini', icon: Sparkles, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  OPENAI: { label: 'OpenAI', icon: Bot, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  OPENROUTER: { label: 'OpenRouter', icon: Globe, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
}

interface ProviderData {
  id: string; name: string; providerType: string; apiKey: string | null
  baseUrl: string | null; defaultModel: string | null; isActive: boolean
  createdAt: string
}

const emptyForm = { name: '', providerType: 'GEMINI', apiKey: '', baseUrl: '', defaultModel: '', isActive: true }

export default function ProviderListPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'automation-v2', 'providers'],
    queryFn: () => fetch('/api/admin/automation-v2/providers').then(r => r.json()).then(j => j.data ?? j),
    staleTime: 30_000,
  })

  const providers: ProviderData[] = data ?? []

  const showError = (e: unknown) => toast({ title: 'ত্রুটি', description: e instanceof Error ? e.message : 'একটি ত্রুটি হয়েছে', variant: 'destructive' })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const csrf = await fetchCsrfToken()
      const method = editId ? 'PUT' : 'POST'
      const url = editId ? `/api/admin/automation-v2/providers/${editId}` : '/api/admin/automation-v2/providers'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to save') }
    },
    onSuccess: () => { toast({ title: editId ? '✅ আপডেট হয়েছে' : '✅ তৈরি হয়েছে' }); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'providers'] }) },
    onError: showError,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const csrf = await fetchCsrfToken()
      const res = await fetch(`/api/admin/automation-v2/providers/${id}`, { method: 'DELETE', headers: csrf ? { 'x-csrf-token': csrf } : {} })
      if (!res.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => { toast({ title: '✅ মুছে ফেলা হয়েছে' }); setDeleteId(null); qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'providers'] }) },
    onError: showError,
  })

  const toggleActive = async (p: ProviderData) => {
    try {
      const csrf = await fetchCsrfToken()
      await fetch(`/api/admin/automation-v2/providers/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: JSON.stringify({ isActive: !p.isActive }) })
      qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'providers'] })
    } catch { toast({ title: 'ত্রুটি', description: 'স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' }) }
  }

  const testConnection = async (id: string) => {
    setTestingId(id)
    try {
      const csrf = await fetchCsrfToken()
      const res = await fetch(`/api/admin/automation-v2/providers/${id}/test`, { method: 'POST', headers: csrf ? { 'x-csrf-token': csrf } : {} })
      const j = await res.json().then(j => j.data ?? j)
      toast({ title: j.ok ? '✅ সংযোগ সফল' : '❌ সংযোগ ব্যর্থ', description: j.message || '', variant: j.ok ? 'default' : 'destructive' })
    } catch { toast({ title: 'ত্রুটি', description: 'সংযোগ পরীক্ষা ব্যর্থ', variant: 'destructive' }) }
    finally { setTestingId(null) }
  }

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (p: ProviderData) => { setEditId(p.id); setForm({ name: p.name, providerType: p.providerType, apiKey: '', baseUrl: p.baseUrl || '', defaultModel: p.defaultModel || '', isActive: p.isActive }); setDialogOpen(true) }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64" /></div>
  if (isError) return <QueryError error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">AI প্রোভাইডার</h1><p className="text-muted-foreground text-sm">মোট {providers.length}টি প্রোভাইডার</p></div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />নতুন</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead><TableHead className="w-28">ধরন</TableHead><TableHead className="w-28">মডেল</TableHead>
                <TableHead className="w-32">API কী</TableHead><TableHead className="w-24">স্ট্যাটাস</TableHead><TableHead className="w-28 text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">কোনো প্রোভাইডার নেই। একটি যোগ করুন।</TableCell></TableRow>
              ) : providers.map((p) => {
                const Icon = TYPE_CONFIG[p.providerType]?.icon ?? Bot
                return (
                  <TableRow key={p.id}>
                    <TableCell><div className="flex items-center gap-3"><div className="p-1.5 rounded-lg bg-muted"><Icon className="h-4 w-4" /></div><span className="font-medium">{p.name}</span></div></TableCell>
                    <TableCell><Badge className={cn('text-xs', TYPE_CONFIG[p.providerType]?.color ?? 'bg-muted')}>{TYPE_CONFIG[p.providerType]?.label ?? p.providerType}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.defaultModel || '—'}</TableCell>
                    <TableCell><code className="text-xs text-muted-foreground font-mono">{p.apiKey ? `***${p.apiKey.slice(-4)}` : '—'}</code></TableCell>
                    <TableCell><button onClick={() => toggleActive(p)}><Badge className={cn('cursor-pointer text-xs', p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>{p.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></button></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testConnection(p.id)} disabled={testingId === p.id} title="সংযোগ পরীক্ষা">
                          {testingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="সম্পাদনা"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)} title="মুছুন"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'প্রোভাইডার সম্পাদনা' : 'নতুন প্রোভাইডার'}</DialogTitle><DialogDescription>AI প্রোভাইডারের তথ্য দিন</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Provider" /></div>
            <div className="space-y-2"><Label>ধরন</Label>
              <Select value={form.providerType} onValueChange={(v) => setForm({ ...form, providerType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>API কী *</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editId ? 'নতুন কী দিতে চাইলে দিন' : 'sk-...'} /></div>
            <div className="space-y-2"><Label>Base URL (ঐচ্ছিক)</Label><Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" /></div>
            <div className="space-y-2"><Label>ডিফল্ট মডেল (ঐচ্ছিক)</Label><Input value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} placeholder="gpt-4o / gemini-2.0-flash" /></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div><Label className="text-sm font-medium">সক্রিয়</Label><p className="text-xs text-muted-foreground">নিষ্ক্রিয় থাকলে ব্যবহার হবে না</p></div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || (!editId && !form.apiKey.trim())}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editId ? 'আপডেট' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />প্রোভাইডার মুছুন</DialogTitle><DialogDescription>এটি পুনরুদ্ধার করা যাবে না।</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>বাতিল</Button><Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)}>মুছুন</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
