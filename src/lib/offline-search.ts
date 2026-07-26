/**
 * Offline Search Index
 *
 * Creates and manages a searchable index of downloaded content
 * for offline searching. Uses localStorage for persistence.
 *
 * Features:
 * - Index downloaded content by title + content type
 * - Keyword search across all indexed items
 * - Weighted results (title match > description match)
 * - Auto-index on download, auto-remove on delete
 */

'use client'

// ─── Types ──────────────────────────────────────────────────────────

export interface OfflineSearchItem {
  id: string
  contentType: string
  title: string
  url: string
  keywords: string[] // Extracted keywords from title
}

export interface OfflineSearchResult {
  item: OfflineSearchItem
  score: number // 0-100 match score
}

// ─── Storage ────────────────────────────────────────────────────────

const OFFLINE_SEARCH_INDEX_KEY = 'offline-search-index'

function loadIndex(): OfflineSearchItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OFFLINE_SEARCH_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveIndex(index: OfflineSearchItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OFFLINE_SEARCH_INDEX_KEY, JSON.stringify(index))
  } catch {
    // Storage full
  }
}

// ─── Keyword Extraction ─────────────────────────────────────────────

/**
 * Extract meaningful keywords from a title (Bengali + English).
 * Filters out common stop words.
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'এবং', 'অথবা', 'ও', 'এর', 'করে', 'করা', 'হয়', 'এই', 'ওই', 'সে',
    'তা', 'থেকে', 'দিয়ে', 'কাছে', 'জন্য', 'বলে', 'আছে', 'কিন্তু',
    'a', 'an', 'the', 'of', 'in', 'to', 'for', 'with', 'on', 'at',
  ])

  return title
    .toLowerCase()
    .split(/[\s,،\-.!:?]+/)
    .filter(word => word.length >= 2 && !stopWords.has(word))
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Add an item to the offline search index.
 */
export function indexContent(
  id: string,
  contentType: string,
  title: string,
  url: string,
): void {
  const index = loadIndex()

  // Remove existing entry with same id+contentType
  const filtered = index.filter(
    item => !(item.id === id && item.contentType === contentType),
  )

  filtered.push({
    id,
    contentType,
    title,
    url,
    keywords: extractKeywords(title),
  })

  saveIndex(filtered)
}

/**
 * Remove an item from the offline search index.
 */
export function unindexContent(id: string, contentType: string): void {
  const index = loadIndex()
  const filtered = index.filter(
    item => !(item.id === id && item.contentType === contentType),
  )
  saveIndex(filtered)
}

/**
 * Search the offline index for matching content.
 * Returns results sorted by relevance score.
 */
export function searchOffline(query: string): OfflineSearchResult[] {
  if (!query || query.length < 2) return []

  const index = loadIndex()
  const normalizedQuery = query.toLowerCase()
  const queryWords = normalizedQuery.split(/[\s,]+/).filter(w => w.length >= 2)

  if (queryWords.length === 0) return []

  const results: OfflineSearchResult[] = []

  for (const item of index) {
    let score = 0
    const titleLower = item.title.toLowerCase()
    const keywordMatches = item.keywords.filter(kw =>
      queryWords.some(qw => kw.includes(qw) || qw.includes(kw)),
    ).length

    // Title match: high weight
    if (titleLower.includes(normalizedQuery)) {
      score += 60
    } else if (queryWords.some(qw => titleLower.includes(qw))) {
      score += 40
    }

    // Keyword match: medium weight
    score += keywordMatches * 15

    // Partial word match: low weight
    const partialMatches = queryWords.filter(qw =>
      item.keywords.some(kw => kw.startsWith(qw) || qw.startsWith(kw)),
    ).length
    score += partialMatches * 5

    if (score > 0) {
      results.push({ item, score: Math.min(100, score) })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Get all indexed items (for debugging/full list).
 */
export function getAllIndexedItems(): OfflineSearchItem[] {
  return loadIndex()
}

/**
 * Get the count of indexed items.
 */
export function getIndexedCount(): number {
  return loadIndex().length
}

/**
 * Clear the entire search index.
 */
export function clearSearchIndex(): void {
  saveIndex([])
}

/**
 * Auto-index downloaded content after a successful download.
 * Should be called from the download manager's downloadContent function.
 */
export function autoIndexOnDownload(
  id: string,
  contentType: string,
  title: string,
  url: string,
): void {
  indexContent(id, contentType, title, url)
}
