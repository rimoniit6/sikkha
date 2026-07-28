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
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Globe, Rss, FileText, RefreshCw } from 'lucide-react'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Globe }> = {
  RSS: { label: 'RSS Feed', icon: Rss },
  SITEMAP: { label: 'Sitemap', icon: Globe },
  WEBSITE: { label: 'Website', icon: Globe },
  MANUAL_URL: { label: 'Manual URL', icon: FileText },
}

interface SourceData {
  id: string; name: string; sourceType: string; url: string
  isActive: boolean; fetchInterval: number
  lastFetchedAt: string | null; createdAt: string
}

const emptyForm = { name: '', sourceType: 'RSS' as const, url: '', fetchInterval: 60, isActive: true }

export default function SourceListPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'automation-v2', 'sources'],
    queryFn: () => fetch('/api/admin/automation-v2/sources').then(r => r.json()).then(j => j.data ?? j),
    staleTime: 30_000,
  })

  const sources: SourceData[] = data ?? []

  const showError = (e: unknown) => toast({ title: 'ত্রুটি', description: e instanceof Error ? e.message : 'একটি ত্রুটি হয়েছে', variant: 'destructive' })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const csrf = await fetchCsrfToken()
      const method = editId ? 'PUT' : 'POST'
      const url = editId ? `/api/admin/automation-v2/sources/${editId}` : '/api/admin/automation-v2/sources'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to save') }
    },
    onSuccess: () => { toast({ title: editId ? '✅ আপডেট হয়েছে' : '✅ তৈরি হয়েছে' }); setDialogOpen(false); qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'sources'] }) },
    onError: showError,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const csrf = await fetchCsrfToken()
      const res = await fetch(`/api/admin/automation-v2/sources/${id}`, { method: 'DELETE', headers: csrf ? { 'x-csrf-token': csrf } : {} })
      if (!res.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => { toast({ title: '✅ মুছে ফেলা হয়েছে' }); setDeleteId(null); qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'sources'] }) },
    onError: showError,
  })

  const toggleActive = async (s: SourceData) => {
    try {
      const csrf = await fetchCsrfToken()
      const res = await fetch(`/api/admin/automation-v2/sources/${s.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'sources'] })
    } catch { toast({ title: 'ত্রুটি', description: 'স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে', variant: 'destructive' }) }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const csrf = await fetchCsrfToken()
      const res = await fetch('/api/admin/automation-v2/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ sourceId: id }),
      })
      const j = await res.json().then(j => j.data ?? j)
      if (!res.ok) throw new Error(j.error || 'Sync failed')
      toast({ title: '✅ সিঙ্ক সম্পন্ন', description: `${j.importedCount}টি নতুন কন্টেন্ট ইম্পোর্ট করা হয়েছে` })
      qc.invalidateQueries({ queryKey: ['admin', 'automation-v2', 'sources'] })
    } catch (e) { showError(e) }
    finally { setSyncingId(null) }
  }

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (s: SourceData) => { setEditId(s.id); setForm({ name: s.name, sourceType: s.sourceType as any, url: s.url, fetchInterval: s.fetchInterval, isActive: s.isActive }); setDialogOpen(true) }

  const timeAgo = (d: string | null) => {
    if (!d) return 'কখনোই নয়'
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'এইমাত্র'; if (m < 60) return `${m}মি আগে`
    const h = Math.floor(m / 60); if (h < 24) return `${h}ঘ আগে`
    return `${Math.floor(h / 24)}দি আগে`
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64" /></div>
  if (isError) return <QueryError error={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">কন্টেন্ট সোর্স</h1><p className="text-muted-foreground text-sm">মোট {sources.length}টি সোর্স</p></div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />নতুন সোর্স</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead><TableHead className="w-28">ধরন</TableHead><TableHead className="w-24">স্ট্যাটাস</TableHead>
                <TableHead className="w-28">শেষ সিঙ্ক</TableHead><TableHead className="w-24 text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">কোনো সোর্স নেই। একটি যোগ করুন।</TableCell></TableRow>
              ) : sources.map((s) => {
                const Icon = TYPE_CONFIG[s.sourceType]?.icon ?? Globe
                return (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex items-center gap-3"><div className="p-1.5 rounded-lg bg-muted"><Icon className="h-4 w-4" /></div><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground truncate max-w-[200px]">{s.url}</p></div></div></TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{TYPE_CONFIG[s.sourceType]?.label ?? s.sourceType}</span></TableCell>
                    <TableCell><button onClick={() => toggleActive(s)}><Badge className={cn('cursor-pointer text-xs', s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>{s.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge></button></TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{timeAgo(s.lastFetchedAt)}</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSync(s.id)} disabled={syncingId === s.id || !s.isActive} title="সিঙ্ক">
                          {syncingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="সম্পাদনা"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id)} title="মুছুন"><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? 'সোর্স সম্পাদনা' : 'নতুন সোর্স'}</DialogTitle><DialogDescription>কন্টেন্ট সোর্সের তথ্য দিন</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Blog Feed" /></div>
            <div className="space-y-2"><Label>ধরন</Label>
              <Select value={form.sourceType} onValueChange={(v: any) => setForm({ ...form, sourceType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>URL *</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/feed.xml" /></div>
            <div className="space-y-2"><Label>সিঙ্ক ব্যবধান (মিনিট)</Label><Input type="number" min={5} value={form.fetchInterval} onChange={(e) => setForm({ ...form, fetchInterval: parseInt(e.target.value) || 60 })} /></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div><Label className="text-sm font-medium">সক্রিয়</Label><p className="text-xs text-muted-foreground">নিষ্ক্রিয় থাকলে সিঙ্ক হবে না</p></div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.url.trim()}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editId ? 'আপডেট' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />সোর্স মুছুন</DialogTitle><DialogDescription>সম্পর্কিত ইম্পোর্টেড কন্টেন্ট মুছে যাবে।</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>বাতিল</Button><Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)}>মুছুন</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
