const store = new Map<string, number>()
const CONTENT_VERSION_PREFIX = 'content:version:'

export type CacheableContent = 'mcq' | 'cq' | 'lecture' | 'suggestion' | 'exam' | 'bundle' | 'package' | 'notice' | 'faq' | 'banner' | 'board-question' | 'board' | 'class' | 'subject' | 'chapter' | 'settings' | 'notification' | 'blog' | 'featured' | 'automation'

const VALID_CONTENT_TYPES = new Set<string>([
  'mcq', 'cq', 'lecture', 'suggestion', 'exam',
  'bundle', 'package', 'notice', 'faq', 'banner',
  'board-question', 'board', 'class', 'subject', 'chapter', 'settings', 'notification', 'blog', 'featured', 'automation',
])

export async function invalidateContentCache(contentType: CacheableContent): Promise<void> {
  if (!VALID_CONTENT_TYPES.has(contentType)) return
  const key = `${CONTENT_VERSION_PREFIX}${contentType}`
  store.set(key, (store.get(key) ?? 0) + 1)
}

export async function getContentVersion(contentType: CacheableContent): Promise<number> {
  const key = `${CONTENT_VERSION_PREFIX}${contentType}`
  return store.get(key) ?? 0
}

export async function contentVersionHeader(contentType: CacheableContent): Promise<Record<string, string>> {
  const version = await getContentVersion(contentType)
  return { 'X-Content-Version': String(version) }
}

export async function invalidateMultipleCache(types: CacheableContent[]): Promise<void> {
  for (const type of types) {
    await invalidateContentCache(type)
  }
}
