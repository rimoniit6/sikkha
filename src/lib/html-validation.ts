/**
 * HTML Block Validation
 *
 * Validates HTML block content before it reaches the database.
 * Separated from content-block-types.ts to avoid circular dependencies
 * when importing in API routes that also need server-only modules.
 *
 * @module html-validation
 */

// ─── Constants ─────────────────────────────────────────────────

/**
 * Maximum allowed size for an HTML block's content (500 KB).
 * This prevents abuse via extremely large payloads.
 */
export const MAX_HTML_BLOCK_SIZE = 500 * 1024 // 500 KB in bytes

// ─── Validation ────────────────────────────────────────────────

/**
 * Validate whether a single HTML block's content is safe to save.
 *
 * @param content - The HTML content string from an HTML block
 * @returns Error message if invalid, or null if valid
 */
export function validateHtmlContent(content: string): string | null {
  if (!content) return null
  if (content.length > MAX_HTML_BLOCK_SIZE) {
    const currentKb = (content.length / 1024).toFixed(1)
    return `HTML block content exceeds maximum size of ${(MAX_HTML_BLOCK_SIZE / 1024).toFixed(0)} KB (current: ${currentKb} KB)`
  }
  return null
}

/**
 * Validate all HTML blocks in a content block array.
 * Accepts both ContentBlock[] and BlogContentBlock[] via generic shape.
 *
 * @param blocks - Array of blocks with { type, content? } shape
 * @returns First validation error found, or null if all pass
 */
export function validateAllHtmlBlocks(blocks: { type: string; content?: string }[]): string | null {
  for (const block of blocks) {
    if (block.type === 'html' && block.content !== undefined) {
      const err = validateHtmlContent(block.content)
      if (err) return err
    }
  }
  return null
}
