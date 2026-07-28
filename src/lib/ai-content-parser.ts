/**
 * AI Content Parser — converts AI-generated output into structured editor blocks.
 *
 * Supports:
 *   - Markdown → ContentBlock[] / BlogContentBlock[]
 *   - AI JSON (structured) → blocks
 *   - HTML → richtext blocks
 *
 * Pipeline: AI Response → Parser → Editor Blocks → Database → Frontend Rendering
 * NEVER exposes raw JSON to the user.
 */

import type { ContentBlock } from '@/components/ui/content-block-types'
import type { BlogContentBlock } from '@/features/blog/blocks/blog-block-types'
import { generateId } from '@/components/ui/content-block-types'
import { blogGenerateId } from '@/features/blog/blocks/blog-block-types'
import { sanitizeHtml } from './sanitize'

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedBlocksResult<T> {
  blocks: T[]
  error?: string
}

// ─── Markdown → HTML helper (lightweight, no extra dependency) ──────

function escapeMdText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert inline markdown formatting to HTML (bold, italic, code, links, images)
 */
function mdInlineToHtml(text: string): string {
  let result = text

  // Images: ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    return `<img src="${escapeMdText(src)}" alt="${escapeMdText(alt || '')}" />`
  })

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    return `<a href="${escapeMdText(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`
  })

  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>')

  // Strikethrough: ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<s>$1</s>')

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  // LaTeX inline: $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_m, math) => {
    return `$${math}$` // preserve for KaTeX rendering
  })

  return result
}

/**
 * Convert a plain text paragraph (with inline formatting) to HTML.
 */
function paragraphToHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return `<p>${mdInlineToHtml(trimmed)}</p>`
}

// ─── Markdown Section Parsing ───────────────────────────────────────

interface MdSection {
  type: 'heading' | 'paragraph' | 'code' | 'table' | 'divider' | 'blockquote' | 'list' | 'html'
  level?: number
  content: string
  language?: string
  headers?: string[]
  rows?: string[][]
  items?: string[]
  ordered?: boolean
}

/**
 * Split markdown content into sections by block-level elements.
 */
function splitIntoSections(markdown: string): MdSection[] {
  const lines = markdown.split('\n')
  const sections: MdSection[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      i++
      continue
    }

    // Divider: --- or *** or ___
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      sections.push({ type: 'divider', content: '' })
      i++
      continue
    }

    // Heading: # to ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      })
      i++
      continue
    }

    // Blockquote: >
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      sections.push({ type: 'blockquote', content: quoteLines.join('\n') })
      continue
    }

    // Code block: ```language or ~~~
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.slice(0, 3)
      const language = trimmed.slice(3).trim() || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      sections.push({
        type: 'code',
        content: codeLines.join('\n').trim(),
        language,
      })
      continue
    }

    // Table: | ... |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      if (tableLines.length >= 2) {
        // Parse table
        const headerRow = tableLines[0]
        const _separatorRow = tableLines[1]

        const headers = headerRow
          .split('|')
          .filter(c => c.trim())
          .map(c => c.trim())

        const rows: string[][] = []
        for (let ri = 2; ri < tableLines.length; ri++) {
          const cells = tableLines[ri]
            .split('|')
            .filter(c => c.trim())
            .map(c => c.trim())
          if (cells.length > 0) {
            // Pad or trim to match headers
            while (cells.length < headers.length) cells.push('')
            rows.push(cells.slice(0, headers.length))
          }
        }

        sections.push({
          type: 'table',
          content: '',
          headers,
          rows,
        })
      } else {
        sections.push({ type: 'paragraph', content: trimmed })
      }
      continue
    }

    // Unordered list: - or *
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (/^[-*+]\s/.test(l)) {
          items.push(l.replace(/^[-*+]\s+/, ''))
          i++
        } else if (/^\s{2,}[-*+]\s/.test(l)) {
          // Nested item
          items.push(l.replace(/^\s+/, ''))
          i++
        } else {
          break
        }
      }
      sections.push({ type: 'list', content: '', items, ordered: false })
      continue
    }

    // Ordered list: 1.
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (/^\d+\.\s/.test(l)) {
          items.push(l.replace(/^\d+\.\s+/, ''))
          i++
        } else {
          break
        }
      }
      sections.push({ type: 'list', content: '', items, ordered: true })
      continue
    }

    // HTML content block
    if (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.length > 10) {
      const htmlLines: string[] = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (l.startsWith('<') && (l.includes('</') || l.endsWith('/>'))) {
          htmlLines.push(l)
          i++
        } else {
          break
        }
      }
      sections.push({ type: 'html', content: htmlLines.join('\n') })
      continue
    }

    // Regular paragraph (collect consecutive lines)
    const paraLines: string[] = []
    while (i < lines.length) {
      const l = lines[i].trim()
      if (!l) break
      // Stop at block-level elements
      if (/^(#{1,6}\s|```|~~~|\||[-*+]\s|\d+\.\s|> |[-*_]{3,}$)/.test(l)) break
      if (l.startsWith('<') && l.endsWith('>') && l.length > 10) break
      paraLines.push(l)
      i++
    }
    if (paraLines.length > 0) {
      sections.push({ type: 'paragraph', content: paraLines.join(' ') })
    } else {
      i++
    }
  }

  return sections
}

/**
 * Convert a markdown unordered/ordered list to HTML.
 */
function listToHtml(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const listItems = items
    .map(item => `<li>${mdInlineToHtml(item)}</li>`)
    .join('\n')
  return `<${tag}>${listItems}</${tag}>`
}

/**
 * Convert a markdown blockquote to HTML.
 */
function blockquoteToHtml(content: string): string {
  return `<blockquote>${mdInlineToHtml(content)}</blockquote>`
}

// ─── Shared Block Builder ───────────────────────────────────────────

type BlockBuilder<T> = (sections: MdSection[], genId: () => string) => T[]

/**
/**
 * Shared markdown-to-blocks builder.
 * Both BlogContentBlock and ContentBlock have identical shapes,
 * so we parameterize the ID generator.
 */
function buildBlocksFromSections<T extends { id: string; type: string }>(
  sections: MdSection[],
  genId: () => string,
  wrapInlineContent: (content: string, genId: () => string) => T,
): T[] {
  const blocks: T[] = []
  let inlineParts: string[] = []

  function flushInline() {
    if (inlineParts.length === 0) return
    blocks.push(wrapInlineContent(inlineParts.join('\n'), genId))
    inlineParts = []
  }

  for (const section of sections) {
    switch (section.type) {
      case 'heading':
        flushInline()
        blocks.push({
          id: genId(),
          type: 'heading',
          level: Math.min(3, Math.max(1, section.level ?? 2)) as 1 | 2 | 3,
          content: section.content,
        } as unknown as T)
        break

      case 'paragraph':
        inlineParts.push(paragraphToHtml(section.content))
        break

      case 'code':
        flushInline()
        blocks.push({
          id: genId(),
          type: 'code',
          language: section.language || 'text',
          content: section.content,
        } as unknown as T)
        break

      case 'table':
        flushInline()
        blocks.push({
          id: genId(),
          type: 'data',
          headers: section.headers || [],
          rows: section.rows || [],
          caption: '',
        } as unknown as T)
        break

      case 'divider':
        flushInline()
        blocks.push({ id: genId(), type: 'divider' } as unknown as T)
        break

      case 'blockquote':
        inlineParts.push(blockquoteToHtml(section.content))
        break

      case 'list':
        inlineParts.push(listToHtml(section.items || [], section.ordered || false))
        break

      case 'html':
        // HTML content (e.g. from AI's <img> tags) goes into richtext blocks
        if (section.content.startsWith('<img')) {
          flushInline()
          const srcMatch = section.content.match(/src="([^"]+)"/)
          const altMatch = section.content.match(/alt="([^"]+)"/)
          blocks.push({
            id: genId(),
            type: 'image',
            url: srcMatch?.[1] || '',
            caption: altMatch?.[1] || '',
          } as unknown as T)
        } else {
          // Other HTML goes into the inline richtext accumulator
          inlineParts.push(section.content)
        }
        break
    }
  }

  flushInline()
  return blocks
}

/**
 * Parse Markdown text into BlogContentBlock[].
 */
export function parseMarkdownToBlogBlocks(markdown: string): ParsedBlocksResult<BlogContentBlock> {
  try {
    const sections = splitIntoSections(markdown)
    const blocks = buildBlocksFromSections<BlogContentBlock>(
      sections,
      blogGenerateId,
      (content, genId) => ({
        id: genId(),
        type: 'richtext' as const,
        content,
      }),
    )
    return { blocks }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    return { blocks: [], error: message }
  }
}

/**
 * Parse Markdown text into ContentBlock[] (Lecture format).
 */
export function parseMarkdownToLectureBlocks(markdown: string): ParsedBlocksResult<ContentBlock> {
  try {
    const sections = splitIntoSections(markdown)
    const blocks = buildBlocksFromSections<ContentBlock>(
      sections,
      generateId,
      (content, genId) => ({
        id: genId(),
        type: 'richtext' as const,
        content,
      }),
    )
    return { blocks }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    return { blocks: [], error: message }
  }
}

// ─── AI JSON Response Parser ────────────────────────────────────────

interface AiJsonResponse {
  title?: string
  content?: string
  excerpt?: string
  metaDescription?: string
  tags?: string[]
}

/**
 * Parse AI JSON response string that contains structured content.
 * Supports both direct JSON blocks array and JSON with nested content field.
 */
export function parseAiJsonToContent(jsonString: string): {
  parsed: AiJsonResponse
  blocks: BlogContentBlock[]
  error?: string
} {
  try {
    const parsed = JSON.parse(jsonString) as AiJsonResponse & { blocks?: BlogContentBlock[] }

    // Case 1: Response already has blocks array
    if (parsed.blocks && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
      return {
        parsed: {
          title: parsed.title || '',
          content: parsed.content || '',
          excerpt: parsed.excerpt || '',
          metaDescription: parsed.metaDescription || '',
          tags: parsed.tags || [],
        },
        blocks: parsed.blocks,
      }
    }

    // Case 2: Parse content field (Markdown or HTML)
    const content = parsed.content || jsonString
    const parseResult = parseMarkdownToBlogBlocks(content)

    return {
      parsed: {
        title: parsed.title || '',
        content: parsed.content || '',
        excerpt: parsed.excerpt || '',
        metaDescription: parsed.metaDescription || '',
        tags: parsed.tags || [],
      },
      blocks: parseResult.blocks,
      error: parseResult.error,
    }
  } catch {
    // Case 3: Not JSON — treat as raw markdown
    const parseResult = parseMarkdownToBlogBlocks(jsonString)
    return {
      parsed: { title: '', content: jsonString },
      blocks: parseResult.blocks,
      error: parseResult.error,
    }
  }
}

/**
 * Convert any AI output (Markdown, JSON, HTML) into BlogContentBlock[].
 * This is the main entry point for Blog content.
 */
export function convertAiToBlogBlocks(
  input: string,
  fallbackTitle?: string,
): { title: string; blocks: BlogContentBlock[]; error?: string } {
  if (!input?.trim()) {
    return { title: fallbackTitle || '', blocks: [], error: 'Empty input' }
  }

  const trimmed = input.trim()

  // Case 1: Try parsing as JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let jsonStr = trimmed
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1].trim()

    const result = parseAiJsonToContent(jsonStr)
    if (result.blocks.length > 0) {
      return {
        title: result.parsed.title || fallbackTitle || '',
        blocks: result.blocks,
        error: result.error,
      }
    }
  }

  // Case 2: Already an array of blocks (JSON array)
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && parsed[0].id) {
        return { title: fallbackTitle || '', blocks: parsed as BlogContentBlock[] }
      }
    } catch {
      // Not a valid blocks array, fall through
    }
  }

  // Case 3: Parse as Markdown
  const parseResult = parseMarkdownToBlogBlocks(trimmed)
  if (parseResult.blocks.length > 0) {
    return { title: fallbackTitle || '', blocks: parseResult.blocks, error: parseResult.error }
  }

  // Case 4: Last resort — wrap as a single richtext block
  return {
    title: fallbackTitle || '',
    blocks: [
      {
        id: blogGenerateId(),
        type: 'richtext',
        content: sanitizeHtml(trimmed),
      },
    ],
  }
}

/**
 * Convert any AI output (Markdown, JSON, HTML) into ContentBlock[].
 * This is the main entry point for Lecture content.
 */
export function convertAiToLectureBlocks(
  input: string,
): { blocks: ContentBlock[]; error?: string } {
  if (!input?.trim()) {
    return { blocks: [], error: 'Empty input' }
  }

  const trimmed = input.trim()

  // Case 1: Try parsing as JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let jsonStr = trimmed
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) jsonStr = jsonMatch[1].trim()

    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.content) {
        const parseResult = parseMarkdownToLectureBlocks(parsed.content)
        if (parseResult.blocks.length > 0) return parseResult
      }
    } catch {
      // Fall through
    }
  }

  // Case 2: Already an array of blocks (JSON array)
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && parsed[0].id) {
        return { blocks: parsed as ContentBlock[] }
      }
    } catch {
      // Not a valid blocks array, fall through
    }
  }

  // Case 3: Parse as Markdown
  const parseResult = parseMarkdownToLectureBlocks(trimmed)
  if (parseResult.blocks.length > 0) return parseResult

  // Case 4: Wrap as a single richtext block
  return {
    blocks: [
      {
        id: generateId(),
        type: 'richtext',
        content: sanitizeHtml(trimmed),
      },
    ],
  }
}

/**
 * Serialize blocks to JSON string for database storage.
 */
export function serializeBlocksForStorage(blocks: BlogContentBlock[] | ContentBlock[]): string {
  return JSON.stringify(blocks)
}

/**
 * Validate that blocks are properly formatted before saving.
 */
export function validateBlocks(
  blocks: BlogContentBlock[] | ContentBlock[],
): { valid: boolean; error?: string } {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { valid: false, error: 'Blocks must be a non-empty array' }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block.id) {
      return { valid: false, error: `Block at index ${i} is missing 'id'` }
    }
    if (!block.type) {
      return { valid: false, error: `Block at index ${i} is missing 'type'` }
    }
  }

  return { valid: true }
}

/**
 * Block converter: BlogContentBlock[] ↔ ContentBlock[]
 * Both types share the same shape, so this is a simple identity cast.
 */
export function blogBlocksToContentBlocks(blocks: BlogContentBlock[]): ContentBlock[] {
  return blocks as unknown as ContentBlock[]
}

export function contentBlocksToBlogBlocks(blocks: ContentBlock[]): BlogContentBlock[] {
  return blocks as unknown as BlogContentBlock[]
}
