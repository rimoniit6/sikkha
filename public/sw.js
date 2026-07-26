const CACHE_VERSION = 'sikkha-v3'
const STATIC_CACHE = 'sikkha-static-v3'
const DYNAMIC_CACHE = 'sikkha-dynamic-v3'
const OFFLINE_CACHE = 'sikkha-offline-v2'
const CONTENT_CACHE = 'sikkha-content-v1'

const STATIC_ASSETS = ['/', '/offline', '/manifest.json']

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE && k !== OFFLINE_CACHE && k !== CONTENT_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (!event.data) return

  switch (event.data.type) {
    case 'LOGOUT':
      // Clear user-specific caches on logout
      caches.delete(DYNAMIC_CACHE)
      caches.delete(OFFLINE_CACHE)
      break
    case 'SKIP_WAITING':
      // Activate waiting service worker for update
      self.skipWaiting()
      break
    case 'CLEAR_CONTENT_CACHE':
      // Clear all content caches (called from cache management)
      caches.delete(OFFLINE_CACHE)
      caches.delete(CONTENT_CACHE)
      break
    case 'CLEAR_ALL_CACHES':
      // Full cache reset (nuclear option)
      caches.keys().then((keys) => {
        Promise.all(keys.map((k) => caches.delete(k)))
      })
      break
    case 'DOWNLOAD_PROGRESS':
      // Forward download progress to clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage(event.data))
      })
      break
  }
})

// Fetch: smart caching strategy with offline-first for downloaded content
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip non-HTTP protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // API requests: check offline content cache FIRST, then network-first fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiHandlerWithOfflineCheck(request))
    return
  }

  // Content navigation pages: check offline cache first
  if (url.pathname.startsWith('/lecture/') || url.pathname.startsWith('/blog/') || url.pathname.startsWith('/knowledge/')) {
    event.respondWith(contentFirstWithNetwork(request))
    return
  }

  // Static assets (images, fonts, JS, CSS): cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot|js|css)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request))
    return
  }

  // Other requests: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request))
})

// ─── Strategy Implementations ──────────────────────────────────────

/**
 * Content-first: checks the offline content cache first,
 * then falls back to network with caching.
 * Used for user-downloaded offline content.
 */
async function contentFirstWithNetwork(request) {
  // Check offline content cache first
  const offlineCache = await caches.open(OFFLINE_CACHE)
  const cached = await offlineCache.match(request)
  if (cached) return cached

  // Also check content cache
  const contentCache = await caches.open(CONTENT_CACHE)
  const contentCached = await contentCache.match(request)
  if (contentCached) return contentCached

  // Fall back to network
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CONTENT_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Last resort: return the offline page
    const offlineFallback = await caches.match('/')
    if (offlineFallback) return offlineFallback
    return new Response('Offline', { status: 503 })
  }
}

/**
 * Cache-first strategy for static assets.
 */
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

/**
 * Network-first strategy for API calls with offline content cache check first.
 * Respects Cache-Control headers and checks OFFLINE_CACHE before DYNAMIC_CACHE.
 */
async function apiHandlerWithOfflineCheck(request) {
  // Check offline content cache first (user-downloaded content)
  const offlineCache = await caches.open(OFFLINE_CACHE)
  const offlineCached = await offlineCache.match(request)
  if (offlineCached) return offlineCached

  try {
    const response = await fetch(request)
    const cacheControl = response.headers.get('Cache-Control') || ''
    if (response.ok && !cacheControl.includes('no-store')) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Check dynamic cache as second fallback
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: 'আপনি অফলাইনে আছেন', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Legacy apiHandler (kept for backward compatibility, not used directly anymore).
 * Network-first strategy for API calls with cache fallback.
 */
async function apiHandler(request) {
  try {
    const response = await fetch(request)
    const cacheControl = response.headers.get('Cache-Control') || ''
    if (response.ok && !cacheControl.includes('no-store')) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: 'আপনি অফলাইনে আছেন', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Network-first with offline fallback for navigation.
 */
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const offlineResponse = await caches.match('/')
    if (offlineResponse) return offlineResponse
    return new Response(
      `<!DOCTYPE html>
      <html lang="bn">
      <head><meta charset="utf-8"><title>অফলাইন</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;text-align:center;padding:1rem}
      .icon{font-size:4rem;margin-bottom:1rem}
      h1{font-size:1.5rem;margin:0.5rem 0}
      p{color:#64748b;margin:0.5rem 0 1.5rem}
      button{padding:0.75rem 1.5rem;border-radius:0.75rem;background:#059669;color:white;border:none;font-size:1rem;cursor:pointer}
      button:active{opacity:0.9}</style></head>
      <body><div class="icon">📡</div><h1>ইন্টারনেট সংযোগ নেই</h1>
      <p>আপনি অফলাইনে আছেন। সংযোগ পুনরুদ্ধার করে আবার চেষ্টা করুন।</p>
      <button onclick="location.reload()">আবার চেষ্টা করুন</button></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

/**
 * Stale-while-revalidate for other resources.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}
