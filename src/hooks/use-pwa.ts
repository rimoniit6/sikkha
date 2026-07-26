'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSyncStatus,
  subscribeToSync,
  processQueue,
  clearQueue,
  getPendingCount,
  queueOperation,
  dequeueOperation,
  type PendingOperation,
  type SyncStatus,
} from '@/lib/offline-sync'
import {
  getDownloadManagerState,
  downloadContent,
  deleteDownload,
  clearAllDownloads,
  getStorageEstimate,
  isContentDownloaded,
  watchStorage,
  type DownloadEntry,
  type DownloadableContentType,
  type DownloadManagerState,
} from '@/lib/offline-download'
import { api } from '@/lib/api-client'

// ══════════════════════════════════════════════════════════════════════
// useRegisterSW
// ══════════════════════════════════════════════════════════════════════

interface SWRegistrationState {
  registered: boolean
  hasUpdate: boolean
  registration: ServiceWorkerRegistration | null
}

/**
 * Register the service worker and track updates.
 * Reuses the existing /sw.js registration from layout.tsx.
 */
export function useRegisterSW(): SWRegistrationState {
  const [state, setState] = useState<SWRegistrationState>({
    registered: false,
    hasUpdate: false,
    registration: null,
  })

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setState({ registered: true, hasUpdate: !!reg.waiting, registration: reg })

        reg.addEventListener('updatefound', () => {
          setState(prev => ({ ...prev, hasUpdate: true }))
        })
      })

      // Listen for controller change (update activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setState(prev => ({ ...prev, hasUpdate: false }))
      })
    }
  }, [])

  return state
}

/**
 * Skip waiting and activate the waiting service worker.
 */
export function useActivateSWUpdate(): () => void {
  return useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }
  }, [])
}

// ══════════════════════════════════════════════════════════════════════
// useNetworkStatus
// ══════════════════════════════════════════════════════════════════════

interface NetworkStatusState {
  isOnline: boolean
  wasOffline: boolean
}

/**
 * Track online/offline status with hydration-safe initial state.
 * Triggers queue processing when coming back online.
 */
export function useNetworkStatus(): NetworkStatusState & { triggerSync: () => void } {
  const [state, setState] = useState<NetworkStatusState>({
    isOnline: true,
    wasOffline: false,
  })
  const wasOfflineRef = useRef(false)

  const triggerSync = useCallback(async () => {
    const pending = getPendingCount()
    if (pending === 0) return

    await processQueue(async (op) => {
      return fetch(op.url, {
        method: op.type,
        headers: { 'Content-Type': 'application/json', ...op.headers },
        body: op.body ? JSON.stringify(op.body) : undefined,
        credentials: 'include',
      })
    })
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setState({ isOnline: true, wasOffline: wasOfflineRef.current })
      wasOfflineRef.current = false
      // Process queue when coming back online
      triggerSync()
    }
    const handleOffline = () => {
      wasOfflineRef.current = true
      setState({ isOnline: false, wasOffline: false })
    }

    // Hydrate initial state
    setState({ isOnline: navigator.onLine, wasOffline: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync])

  return { ...state, triggerSync }
}

// ══════════════════════════════════════════════════════════════════════
// useOfflineQueue
// ══════════════════════════════════════════════════════════════════════

interface OfflineQueueState {
  syncStatus: SyncStatus
  queue: PendingOperation[]
}

/**
 * Track the offline mutation queue and sync status.
 */
export function useOfflineQueue(): OfflineQueueState & {
  enqueue: typeof queueOperation
  dequeue: typeof dequeueOperation
  clear: typeof clearQueue
  processNow: () => Promise<void>
} {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus())
  const [queue, setQueue] = useState<PendingOperation[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToSync((status) => {
      setSyncStatus(status)
      // Reload queue from storage
      try {
        const raw = localStorage.getItem('offline-sync-queue')
        setQueue(raw ? JSON.parse(raw) : [])
      } catch {
        setQueue([])
      }
    })

    return unsubscribe
  }, [])

  const processNow = useCallback(async () => {
    await processQueue(async (op) => {
      return fetch(op.url, {
        method: op.type,
        headers: { 'Content-Type': 'application/json', ...op.headers },
        body: op.body ? JSON.stringify(op.body) : undefined,
        credentials: 'include',
      })
    })
    setSyncStatus(getSyncStatus())
  }, [])

  return { syncStatus, queue, enqueue: queueOperation, dequeue: dequeueOperation, clear: clearQueue, processNow }
}

// ══════════════════════════════════════════════════════════════════════
// useDownloadManager
// ══════════════════════════════════════════════════════════════════════

interface DownloadManagerHook {
  state: DownloadManagerState
  download: (contentType: DownloadableContentType, id: string, title: string, url: string) => Promise<boolean>
  remove: (contentType: DownloadableContentType, id: string) => Promise<boolean>
  clearAll: () => Promise<boolean>
  isDownloaded: (contentType: DownloadableContentType, id: string) => boolean
  downloading: Set<string>
}

/**
 * Manage offline content downloads.
 */
export function useDownloadManager(): DownloadManagerHook {
  const [state, setState] = useState<DownloadManagerState>(getDownloadManagerState())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => {
    setState(getDownloadManagerState())
  }, [])

  const download = useCallback(async (
    contentType: DownloadableContentType,
    id: string,
    title: string,
    url: string,
  ): Promise<boolean> => {
    const dlKey = `${contentType}:${id}`
    if (downloading.has(dlKey)) return false

    setDownloading(prev => new Set(prev).add(dlKey))
    try {
      const success = await downloadContent(contentType, id, title, url)
      if (success) refresh()
      return success
    } finally {
      setDownloading(prev => {
        const next = new Set(prev)
        next.delete(dlKey)
        return next
      })
    }
  }, [downloading, refresh])

  const remove = useCallback(async (
    contentType: DownloadableContentType,
    id: string,
  ): Promise<boolean> => {
    const success = await deleteDownload(contentType, id)
    if (success) refresh()
    return success
  }, [refresh])

  const clearAll = useCallback(async (): Promise<boolean> => {
    const success = await clearAllDownloads()
    if (success) refresh()
    return success
  }, [refresh])

  return {
    state,
    download,
    remove,
    clearAll,
    isDownloaded: isContentDownloaded,
    downloading,
  }
}

// ══════════════════════════════════════════════════════════════════════
// useStorageEstimate
// ══════════════════════════════════════════════════════════════════════

interface StorageEstimateState {
  usage: number
  quota: number
  percentage: number
  formattedUsage: string
  formattedQuota: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '০ B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  return `${value} ${sizes[i]}`
}

/**
 * Track browser storage usage.
 */
export function useStorageEstimate(): StorageEstimateState {
  const [state, setState] = useState<StorageEstimateState>({
    usage: 0,
    quota: 0,
    percentage: 0,
    formattedUsage: '০ B',
    formattedQuota: '০ B',
  })

  useEffect(() => {
    const update = async () => {
      const estimate = await getStorageEstimate()
      setState({
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: estimate.percentage,
        formattedUsage: formatBytes(estimate.usage),
        formattedQuota: formatBytes(estimate.quota),
      })
    }

    update()
    const unsubscribe = watchStorage((estimate) => {
      setState({
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: estimate.percentage,
        formattedUsage: formatBytes(estimate.usage),
        formattedQuota: formatBytes(estimate.quota),
      })
    })

    return unsubscribe
  }, [])

  return state
}
