'use client'

import { useCallback } from 'react'
import { Database, Trash2, Download, HardDrive, RefreshCw, BookOpen } from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useDownloadManager, useStorageEstimate } from '@/hooks/use-pwa'

/**
 * CacheManagement — Shows cached offline content, storage usage,
 * and allows selective deletion.
 *
 * Designed to be used in a dialog or settings page.
 */
export default function CacheManagement() {
  const { state, remove, clearAll } = useDownloadManager()
  const storage = useStorageEstimate()
  const { downloads, totalSize, totalItems } = state

  const handleClearAll = useCallback(async () => {
    await clearAll()
  }, [clearAll])

  const handleRemove = useCallback(async (contentType: string, id: string) => {
    await remove(contentType as any, id)
  }, [remove])

  const getStorageColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-rose-500'
    if (percentage >= 50) return 'text-amber-500'
    return 'text-emerald-500'
  }

  const getStorageBg = (percentage: number): string => {
    if (percentage >= 80) return 'bg-rose-500'
    if (percentage >= 50) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getContentIcon = (contentType: string): string => {
    switch (contentType) {
      case 'lecture': return '📖'
      case 'blog': return '📝'
      case 'knowledge': return '🧠'
      case 'board-question': return '📋'
      default: return '📄'
    }
  }

  const getContentLabel = (contentType: string): string => {
    switch (contentType) {
      case 'lecture': return 'লেকচার'
      case 'blog': return 'ব্লগ'
      case 'knowledge': return 'নলেজ ব্লক'
      case 'board-question': return 'বোর্ড প্রশ্ন'
      default: return contentType
    }
  }

  return (
    <div className="space-y-4">
      {/* Storage Summary */}
      <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-emerald-50/30 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <HardDrive className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">স্টোরেজ ব্যবস্থাপনা</h3>
              <p className="text-xs text-muted-foreground">
                {toBengaliNumerals(totalItems)}টি আইটেম · {storage.formattedUsage} / {storage.formattedQuota}
              </p>
            </div>
          </div>

          {/* Storage Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">ব্যবহৃত</span>
              <span className={cn('font-medium', getStorageColor(storage.percentage))}>
                {toBengaliNumerals(storage.percentage)}%
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', getStorageBg(storage.percentage))}
                style={{ width: `${Math.min(storage.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClearAll}
              disabled={totalItems === 0}
            >
              <Trash2 className="size-3 mr-1" />
              সব মুছুন
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="size-3 mr-1" />
              রিফ্রেশ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Downloaded Content List */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">ডাউনলোড করা কন্টেন্ট</h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {toBengaliNumerals(totalItems)}টি
            </Badge>
          </div>

          {totalItems === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Download className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">কোনো কন্টেন্ট ডাউনলোড করা হয়নি</p>
              <p className="text-xs mt-1">লেকচার পড়ার সময় অফলাইনের জন্য ডাউনলোড করুন</p>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {downloads.map((entry) => (
                  <div
                    key={`${entry.contentType}-${entry.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors group"
                  >
                    <span className="text-lg">{getContentIcon(entry.contentType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{entry.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {getContentLabel(entry.contentType)}
                        </Badge>
                        <span>{new Date(entry.downloadedAt).toLocaleDateString('bn-BD')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(entry.contentType, entry.id)}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                      aria-label={`${entry.title} মুছুন`}
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            ডাউনলোড করা কন্টেন্ট অফলাইনে পড়া যাবে। যখন স্টোরেজ ৮০% ছাড়িয়ে যাবে, 
            পুরনো কন্টেন্ট স্বয়ংক্রিয়ভাবে মুছে ফেলা হবে।
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * CacheManagementSkeleton — Loading state for the cache management screen.
 */
export function CacheManagementSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
