'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { QueryError } from '@/components/admin/QueryError'
import { useToast } from '@/hooks/use-toast'
import { Globe, Zap, FileText, CheckCircle2, Clock, Activity, Cpu, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchCsrfToken } from '@/lib/api-client'
import { useRouterStore } from '@/store/router'

function fetchData(url: string) {
  return fetch(url).then(r => r.json()).then(j => j.data ?? j)
}

export default function AutomationDashboardPage() {
  const { toast } = useToast()
  const navigate = useRouterStore((s) => s.navigate)

  const { data: sourcesData } = useQuery({ queryKey: ['admin', 'automation-v2', 'sources-count'], queryFn: () => fetchData('/api/admin/automation-v2/sources?limit=1'), staleTime: 60_000 })
  const { data: providersData } = useQuery({ queryKey: ['admin', 'automation-v2', 'providers-count'], queryFn: () => fetchData('/api/admin/automation-v2/providers?limit=1'), staleTime: 60_000 })
  const { data: settingsData } = useQuery({ queryKey: ['admin', 'automation-v2', 'settings'], queryFn: () => fetchData('/api/admin/automation-v2/settings'), staleTime: 60_000 })

  const totalSources = sourcesData?.pagination?.total ?? sourcesData?.length ?? 0
  const totalProviders = providersData?.pagination?.total ?? providersData?.length ?? 0
  const autoEnabled = settingsData?.auto_publish === 'true'
  const defaultProvider = settingsData?.default_provider ?? '—'

  const statCards = [
    { title: 'কন্টেন্ট সোর্স', value: totalSources, icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'AI প্রোভাইডার', value: totalProviders, icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50' },
    { title: 'অটো পাবলিশ', value: autoEnabled ? 'সক্রিয়' : 'নিষ্ক্রিয়', icon: CheckCircle2, color: autoEnabled ? 'text-emerald-600' : 'text-gray-400', bg: autoEnabled ? 'bg-emerald-50' : 'bg-gray-50' },
    { title: 'ডিফল্ট প্রোভাইডার', value: defaultProvider, icon: Cpu, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">অটোমেশন ড্যাশবোর্ড</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.title}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.title}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={cn('p-2.5 rounded-xl', s.bg)}><Icon className={cn('h-5 w-5', s.color)} /></div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">দ্রুত অ্যাকশন</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'সোর্স', icon: Globe, route: 'admin-automation-v2-sources' as const },
              { label: 'প্রোভাইডার', icon: Zap, route: 'admin-automation-v2-providers' as const },
              { label: 'জেনারেট', icon: FileText, route: 'admin-automation-v2-content' as const },
              { label: 'সেটিংস', icon: Cpu, route: 'admin-automation-v2-settings' as const },
            ].map(({ label, icon: Icon, route }) => (
              <Button key={label} variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-emerald-50 hover:border-emerald-300" onClick={() => navigate(route)}>
                <Icon className="h-5 w-5 text-emerald-600" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">সিস্টেম সারসংক্ষেপ</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'মোট সোর্স', value: totalSources, icon: Globe },
              { label: 'AI প্রোভাইডার', value: totalProviders, icon: Zap },
              { label: 'ডিফল্ট প্রোভাইডার', value: defaultProvider, icon: Cpu },
              { label: 'অটো পাবলিশ', value: autoEnabled ? 'হ্যাঁ' : 'না', icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-emerald-50"><Icon className="h-4 w-4 text-emerald-600" /></div>
                <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-semibold">{value}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
