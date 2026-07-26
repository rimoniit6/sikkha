'use client'

import { useState, useCallback } from 'react'
import { Upload, CheckCircle2, AlertCircle, X, RefreshCw, Clock } from 'lucide-react'
import { cn, toBengaliNumerals } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useOfflineQueue, useNetworkStatus } from '@/hooks/use-pwa'

/**
 * SyncStatusIndicator — Shows pending offline operations and sync progress.
 *
 * Appears as a small badge when there are pending operations,
 * and expands to a full panel when clicked.
 */
export default function SyncStatusIndicator() {
  const [expanded, setExpanded] = useState(false)
  const { syncStatus, queue, processNow } = useOfflineQueue()
  const { isOnline } = useNetworkStatus()
  const [syncing, setSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await processNow()
    } finally {
      setSyncing(false)
    }
  }, [processNow])

  // Don't show if queue is empty and syncing is idle
  if (syncStatus.pending === 0 && !syncing) return null

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
      {/* Trigger Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-200',
          'text-white text-sm font-medium',
          syncStatus.pending > 0
            ? 'bg-amber-500 hover:bg-amber-600'
            : 'bg-emerald-500 hover:bg-emerald-600',
        )}
        aria-label={
          syncStatus.pending > 0
            ? `${toBengaliNumerals(syncStatus.pending)}টি অপারেশন অপেক্ষমাণ`
            : 'সব সিঙ্ক সম্পন্ন'
        }
      >
        {syncing ? (
          <RefreshCw className="size-4 animate-spin" />
        ) : syncStatus.pending > 0 ? (
          <Upload className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        <span>
          {syncing
            ? 'সিঙ্ক করছে...'
            : syncStatus.pending > 0
              ? `${toBengaliNumerals(syncStatus.pending)}টি অপেক্ষমাণ`
              : 'সম্পন্ন'}
        </span>
      </button>

      {/* Expanded Panel */}
      {expanded && (
        <Card className="w-72 sm:w-80 shadow-xl border-border/50 animate-fade-in-up">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3 inline mr-1" />
                অফলাইন সিঙ্ক
              </h3>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
                aria-label="বন্ধ করুন"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="font-bold text-lg">{toBengaliNumerals(syncStatus.pending)}</p>
                <p className="text-muted-foreground">অপেক্ষমাণ</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="font-bold text-lg">{toBengaliNumerals(syncStatus.failed)}</p>
                <p className="text-muted-foreground">ব্যর্থ</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <div className={cn('size-3 rounded-full mx-auto mb-1', isOnline ? 'bg-emerald-500' : 'bg-rose-500')} />
                <p className="text-muted-foreground">{isOnline ? 'অনলাইন' : 'অফলাইন'}</p>
              </div>
            </div>

            {/* Queue List */}
            {queue.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {queue.map((op) => (
                  <div key={op.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/20 text-xs">
                    <Badge variant="outline" className="text-[10px] h-5 px-1 shrink-0">
                      {op.type}
                    </Badge>
                    <span className="truncate text-muted-foreground flex-1">
                      {op.url.split('/').pop() || op.url}
                    </span>
                    {op.retryCount > 0 && (
                      <span className="text-rose-500 shrink-0" title={`${op.retryCount} বার চেষ্টা`}>
                        <AlertCircle className="size-3" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={handleSync}
                disabled={!isOnline || syncing || syncStatus.pending === 0}
              >
                {syncing ? (
                  <>
                    <RefreshCw className="size-3 mr-1 animate-spin" />
                    সিঙ্ক হচ্ছে...
                  </>
                ) : (
                  <>
                    <Upload className="size-3 mr-1" />
                    এখন সিঙ্ক করুন
                  </>
                )}
              </Button>
            </div>

            {/* Last Sync Time */}
            {syncStatus.lastSyncAt && (
              <p className="text-[10px] text-muted-foreground text-center">
                শেষ সিঙ্ক: {new Date(syncStatus.lastSyncAt).toLocaleString('bn-BD')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
