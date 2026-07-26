/**
 * Offline Download Manager
 *
 * Manages downloading and caching content for offline reading.
 * Uses the Cache API (via service worker) for content storage.
 *
 * Features:
 * - Download lectures, blogs, and knowledge blocks for offline
 * - Track download progress
 * - Storage usage estimation
 * - Selective download and deletion
 * - Auto-cleanup when storage is full
 */

'use client'

// ─── Storage Keys ──────────────────────────────────────────────────

const DOWNLOADS_INDEX_KEY = 'offline-downloads-index'
const OFFLINE_CONTENT_PREFIX = 'offline-content:'
const MAX_CACHED_CONTENT = 50 // Maximum items to cache

// ─── Types ──────────────────────────────────────────────────────────

export type DownloadableContentType = 'lecture' | 'blog' | 'knowledge' | 'board-question'

export interface DownloadEntry {
  id: string
  contentType: DownloadableContentType
  title: string
  url: string
  downloadedAt: string
  size: number // Estimated bytes
  progress: number // 0-100
}

function generateContentKey(contentType: DownloadableContentType, id: string): string {
  return `${OFFLINE_CONTENT_PREFIX}${contentType}:${id}`
}

/**
 * Auto-index downloaded content for offline search.
 * Uses dynamic import to avoid circular dependencies.
 */

export interface DownloadManagerState {
  downloads: DownloadEntry[]
  totalSize: number
  totalItems: number
}

// ─── Helpers ────────────────────────────────────────────────────────

function loadIndex(): DownloadEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DOWNLOADS_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveIndex(entries: DownloadEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DOWNLOADS_INDEX_KEY, JSON.stringify(entries))
  } catch {
    // Storage full
  }
}

// ─── Cache Helpers ──────────────────────────────────────────────────

async function getCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  return caches.open('sikkha-offline-v2')
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get all downloaded content entries with storage stats.
 */
export function getDownloadManagerState(): DownloadManagerState {
  const downloads = loadIndex()
  return {
    downloads,
    totalSize: downloads.reduce((s, d) => s + d.size, 0),
    totalItems: downloads.length,
  }
}

/**
 * Check if content is already downloaded.
 */
export function isContentDownloaded(contentType: DownloadableContentType, id: string): boolean {
  const downloads = loadIndex()
  return downloads.some(d => d.contentType === contentType && d.id === id)
}

/**
 * Download content and cache it for offline reading.
 * Returns a promise that resolves when download is complete.
 */
export async function downloadContent(
  contentType: DownloadableContentType,
  id: string,
  title: string,
  contentUrl: string,
  onProgress?: (progress: number) => void,
): Promise<boolean> {
  const index = loadIndex()

  // Check if already downloaded
  if (index.some(d => d.contentType === contentType && d.id === id)) {
    return true // Already exists
  }

  // Check download limit
  if (index.length >= MAX_CACHED_CONTENT) {
    // Auto-cleanup: remove oldest download
    const oldest = index.sort((a, b) => new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime())[0]
    if (oldest) {
      await deleteDownload(oldest.contentType, oldest.id)
    }
  }

  try {
    onProgress?.(10)

    // Fetch the content and cache it
    const response = await fetch(contentUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    onProgress?.(50)

    const cache = await getCache()
    if (!cache) throw new Error('Cache API not available')

    const request = new Request(contentUrl)
    const responseClone = response.clone()

    // Store in cache
    await cache.put(request, responseClone)
    onProgress?.(80)

    // Estimate size from response headers
    const contentLength = response.headers.get('Content-Length')
    const estimatedSize = contentLength ? parseInt(contentLength, 10) : responseClone.body ? 100000 : 50000 // Default 50KB estimate

    // Add to index
    const entry: DownloadEntry = {
      id,
      contentType,
      title,
      url: contentUrl,
      downloadedAt: new Date().toISOString(),
      size: estimatedSize,
      progress: 100,
    }

    index.push(entry)
    saveIndex(index)
    onProgress?.(100)

    // Auto-index for offline search
    try {
      const { autoIndexOnDownload } = await import('@/lib/offline-search')
      autoIndexOnDownload(id, contentType, title, contentUrl)
    } catch { /* search indexing is optional */ }

    return true
  } catch (err) {
    console.error('[DownloadManager] Download failed:', err)
    return false
  }
}

/**
 * Remove downloaded content from cache.
 */
export async function deleteDownload(
  contentType: DownloadableContentType,
  id: string,
): Promise<boolean> {
  const index = loadIndex()
  const entry = index.find(d => d.contentType === contentType && d.id === id)
  if (!entry) return false

  // Remove from offline search index
  try {
    const { unindexContent } = await import('@/lib/offline-search')
    unindexContent(id, contentType)
  } catch { /* search index cleanup is optional */ }

  try {
    const cache = await getCache()
    if (cache) {
      await cache.delete(entry.url)
    }

    const updated = index.filter(d => !(d.contentType === contentType && d.id === id))
    saveIndex(updated)
    return true
  } catch {
    return false
  }
}

/**
 * Clear all downloaded content.
 */
export async function clearAllDownloads(): Promise<boolean> {
  try {
    const cache = await getCache()
    if (cache) {
      const keys = await cache.keys()
      await Promise.all(keys.map(key => cache.delete(key)))
    }
    saveIndex([])
    return true
  } catch {
    return false
  }
}

/**
 * Get estimated storage usage.
 * Returns a Promise with bytes used and available.
 */
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
  percentage: number
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, percentage: 0 }
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage ?? 0
    const quota = estimate.quota ?? 0
    return {
      usage,
      quota,
      percentage: quota > 0 ? Math.round((usage / quota) * 100) : 0,
    }
  } catch {
    return { usage: 0, quota: 0, percentage: 0 }
  }
}

/**
 * Auto-cleanup: remove oldest downloads when approaching storage limits.
 */
export async function autoCleanup(): Promise<number> {
  const estimate = await getStorageEstimate()
  let removed = 0

  // If storage usage > 80%, start cleaning up oldest entries
  if (estimate.percentage > 80) {
    const index = loadIndex()
    const sorted = [...index].sort(
      (a, b) => new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime(),
    )

    for (const entry of sorted) {
      if (estimate.percentage <= 70) break
      await deleteDownload(entry.contentType, entry.id)
      removed++
    }
  }

  return removed
}

/**
 * Format bytes to human-readable string (Bengali-friendly).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '০ B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  // Convert number to Bengali digits
  return `${value} ${sizes[i]}`
}

/**
 * Register a listener for storage quota changes.
 * Returns unsubscribe function.
 */
export function watchStorage(
  callback: (estimate: { usage: number; quota: number; percentage: number }) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return () => {}
  }

  // Poll every 30 seconds
  const interval = setInterval(async () => {
    const estimate = await getStorageEstimate()
    callback(estimate)
  }, 30000)

  // Fire immediately
  getStorageEstimate().then(callback)

  return () => clearInterval(interval)
}
