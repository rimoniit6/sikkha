/**
 * Offline Sync Engine
 *
 * Manages background synchronization, retry queues, and pending operations
 * for the PWA offline experience. Reuses existing API client patterns.
 *
 * Features:
 * - Offline mutation queue (store failed API calls)
 * - Background sync when coming back online
 * - Retry with exponential backoff
 * - Sync status tracking
 * - Conflict resolution for idempotent operations
 */

'use client'

// ─── Storage Keys ──────────────────────────────────────────────────

const QUEUE_STORAGE_KEY = 'offline-sync-queue'
const MAX_RETRY_ATTEMPTS = 5
const INITIAL_RETRY_DELAY_MS = 2000

// ─── Types ──────────────────────────────────────────────────────────

export interface PendingOperation {
  id: string
  type: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  headers?: Record<string, string>
  createdAt: string
  retryCount: number
  lastAttemptAt?: string
  idempotencyKey?: string
}

export interface SyncStatus {
  pending: number
  syncing: boolean
  lastSyncAt: string | null
  failed: number
  errors: string[]
}

export interface SyncResult {
  success: boolean
  operationId: string
  error?: string
}

// ─── Queue Persistence ──────────────────────────────────────────────

function loadQueue(): PendingOperation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: PendingOperation[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full — silently degrade
  }
}

function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Callbacks ──────────────────────────────────────────────────────

type SyncCallback = (status: SyncStatus) => void
const listeners = new Set<SyncCallback>()

function notifyListeners(): void {
  const status = getSyncStatus()
  listeners.forEach(cb => cb(status))
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get current sync status (pending count, last sync, errors).
 */
export function getSyncStatus(): SyncStatus {
  const queue = loadQueue()
  return {
    pending: queue.length,
    syncing: false,
    lastSyncAt: typeof window === 'undefined' ? null : localStorage.getItem('offline-last-sync-at'),
    failed: queue.filter(o => o.retryCount > 0).length,
    errors: [],
  }
}

/**
 * Subscribe to sync status changes.
 * Returns unsubscribe function.
 */
export function subscribeToSync(callback: SyncCallback): () => void {
  listeners.add(callback)
  // Immediately call with current status
  callback(getSyncStatus())
  return () => listeners.delete(callback)
}

/**
 * Queue a mutation for later execution when offline.
 * Uses idempotencyKeys to prevent duplicate execution.
 */
export function queueOperation(
  type: PendingOperation['type'],
  url: string,
  body?: unknown,
  idempotencyKey?: string,
): PendingOperation {
  const operation: PendingOperation = {
    id: generateId(),
    type,
    url,
    body,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    idempotencyKey,
  }

  const queue = loadQueue()

  // Deduplicate: reject if same idempotencyKey already in queue
  if (idempotencyKey) {
    const existing = queue.find(o => o.idempotencyKey === idempotencyKey)
    if (existing) return existing
  }

  queue.push(operation)
  saveQueue(queue)
  notifyListeners()
  return operation
}

/**
 * Remove a completed operation from the queue.
 */
export function dequeueOperation(operationId: string): void {
  const queue = loadQueue()
  const updated = queue.filter(o => o.id !== operationId)
  if (updated.length !== queue.length) {
    saveQueue(updated)
    notifyListeners()
  }
}

/**
 * Remove all operations matching a URL pattern (e.g., on successful direct submit).
 */
export function dequeueByUrl(urlPattern: string): void {
  const queue = loadQueue()
  const updated = queue.filter(o => !o.url.includes(urlPattern))
  if (updated.length !== queue.length) {
    saveQueue(updated)
    notifyListeners()
  }
}

/**
 * Process all queued operations sequentially with retry.
 * Called when the app comes back online.
 */
export async function processQueue(
  fetchFn: (op: PendingOperation) => Promise<Response>,
  onProgress?: (processed: number, total: number) => void,
): Promise<SyncResult[]> {
  const initialQueue = loadQueue()
  if (initialQueue.length === 0) return []

  const results: SyncResult[] = []
  const total = initialQueue.length
  const toDequeue: string[] = []

  for (let i = 0; i < initialQueue.length; i++) {
    const op = initialQueue[i]
    onProgress?.(i, total)

    // Attempt with retry loop
    let lastError: string | undefined
    let success = false

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        // Exponential backoff before retry
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      try {
        const response = await fetchFn(op)
        if (response.ok || response.status === 409) {
          // 409 Conflict means already processed (idempotent)
          success = true
          toDequeue.push(op.id)
          break
        }
        lastError = `HTTP ${response.status}`
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Network error'
      }

      // Update retry count in storage
      op.retryCount = attempt + 1
      op.lastAttemptAt = new Date().toISOString()
    }

    results.push({
      success,
      operationId: op.id,
      error: success ? undefined : (lastError || `Max retries (${MAX_RETRY_ATTEMPTS}) exceeded`),
    })
  }

  // Dequeue all successful operations after processing
  for (const id of toDequeue) {
    dequeueOperation(id)
  }

  // Save last sync time
  if (typeof window !== 'undefined') {
    localStorage.setItem('offline-last-sync-at', new Date().toISOString())
  }
  notifyListeners()

  return results
}

/**
 * Clear all pending operations.
 */
export function clearQueue(): void {
  saveQueue([])
  notifyListeners()
}

/**
 * Get the count of pending operations.
 */
export function getPendingCount(): number {
  return loadQueue().length
}

/**
 * Check if the queue has any operations that have exceeded max retries.
 */
export function hasFailedOperations(): boolean {
  const queue = loadQueue()
  return queue.some(o => o.retryCount >= MAX_RETRY_ATTEMPTS)
}
