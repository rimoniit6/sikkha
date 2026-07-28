import { URL } from 'url'

const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])/, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/,
]

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((range) => range.test(hostname))
}

export interface ScrapedContent {
  title: string
  content: string
  textContent: string
  url: string
  contentType: string
}

/**
 * Simple content scraper with SSRF protection.
 * Fetches a URL, extracts title and main content, returns clean text.
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  // SSRF protection: reject private/internal IPs
  try {
    const parsed = new URL(url)
    if (isPrivateHost(parsed.hostname)) {
      throw new Error(`Access to private IP/host is not allowed: ${parsed.hostname}`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('not allowed')) throw e
    // Invalid URL will be caught by fetch
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SikkhaBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  const contentType = response.headers.get('content-type') || 'text/html'

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1] : html

  // Clean HTML - remove scripts, styles, nav, footer, etc.
  const cleaned = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Generate plain text
  const textContent = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim()

  return {
    title,
    content: cleaned,
    textContent,
    url,
    contentType,
  }
}

/**
 * Parse RSS feed XML and return items.
 */
export function parseRssFeed(xml: string): Array<{ title: string; link: string; description: string; publishedDate?: string }> {
  const items: Array<{ title: string; link: string; description: string; publishedDate?: string }> = []

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = extractTag(itemXml, 'title') || ''
    const link = extractTag(itemXml, 'link') || ''
    const description = extractTag(itemXml, 'description') || ''
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date')

    items.push({ title, link, description, publishedDate: pubDate })
  }

  return items
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}
