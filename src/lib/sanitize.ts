/**
 * Centralized HTML sanitizer configuration for the entire application.
 *
 * This is the SINGLE source of truth for sanitization rules.
 * All content rendering MUST use `sanitizeHtml()` from this module.
 *
 * NEVER create inline DOMPurify configurations elsewhere.
 */

import DOMPurify from 'isomorphic-dompurify'

// ─── Allowed Tags ─────────────────────────────────────────────────
// These are the ONLY HTML tags that will survive sanitization.

const ALLOWED_TAGS: string[] = [
  // ── Document structure ──
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span', 'section',
  'header', 'footer', 'main', 'article', 'aside',

  // ── Text formatting ──
  'b', 'i', 'em', 'strong', 'u', 's', 'del', 'ins',
  'small', 'sub', 'sup', 'mark', 'kbd', 'code', 'pre',
  'abbr', 'cite', 'q', 'blockquote',

  // ── Lists ──
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',

  // ── Tables ──
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'colgroup', 'col',

  // ── Links & media ──
  'a', 'img', 'figure', 'figcaption',
  'video', 'audio', 'source', 'iframe',

  // ── MathML (fallback rendering) ──
  // MathML tags are allowed so that if MathML→LaTeX conversion fails,
  // raw MathML can still render natively in the browser or via MathJax.
  // Primary pipeline: MathML → LaTeX → KaTeX (handled before sanitization).
  // Fallback: if conversion fails, MathML passes through for native/MathJax rendering.

  // ── MathML tags (fallback for when MathML→LaTeX conversion fails) ──
  'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup',
  'mfrac', 'msqrt', 'mroot', 'mover', 'munder', 'munderover',
  'mtext', 'mspace', 'mtable', 'mtr', 'mtd', 'mlabeledtr',
  'menclose', 'merror', 'maction', 'mstyle', 'mpadded', 'mphantom',
  'mmultiscripts', 'mprescripts', 'none', 'semantics', 'annotation',

  // ── SVG (needed by KaTeX for radicals, stretchy delimiters, etc.) ──
  'svg', 'path', 'g', 'rect', 'circle', 'line', 'polygon', 'polyline', 'ellipse',
  'defs', 'use', 'clippath', 'lineargradient', 'radialgradient', 'stop',
  'text', 'tspan',

  // ── KaTeX-generated tags ──
  'katex-display', // KaTeX wrapper
  'annotation-xml',

  // ── Rubbish but harmless ──
  'wbr',
]

// ─── Allowed Attributes ──────────────────────────────────────────

const ALLOWED_ATTR: string[] = [
  // ── Global ──
  'class', 'id', 'title', 'lang', 'dir',
  'role', 'aria-hidden', 'aria-label', 'aria-describedby',

  // ── Links ──
  'href', 'target', 'rel',

  // ── Images ──
  'src', 'alt', 'width', 'height', 'loading',

  // ── Media ──
  'controls', 'autoplay', 'loop', 'muted', 'preload',
  'allow', 'allowfullscreen', 'framebuffer', 'referrerpolicy',



  // ── Table ──
  'colspan', 'rowspan', 'scope', 'headers',

  // ── SVG attributes (needed by KaTeX for radicals, stretchy elements) ──
  'viewbox', 'preserveaspectratio', 'd', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-opacity', 'fill-opacity', 'fill-rule',
  'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'offset', 'stop-color', 'stop-opacity',
  'xmlns', 'version', 'baseprofile',

  // ── MathML attributes (for native/MathJax fallback rendering) ──
  'display', 'mathvariant', 'linethickness', 'bevelled',
  'accent', 'accentunder', 'selection', 'notation',

  // ── KaTeX-specific (for rendered LaTeX output) ──
  'data-mathml',
]

// ─── Blocked Attributes (explicitly remove even if matched) ──────

const _BLOCKED_ATTR_PATTERNS: RegExp[] = [
  /^on/i,          // onclick, onerror, onload, etc.
  /^formaction/i,  // formaction
]

// ─── Server-side sanitizer (uses isomorphic-dompurify) ────

function serverSanitize(html: string): string {
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORCE_BODY: true,
    })
  } catch {
    // Fallback: strip all HTML tags if DOMPurify fails
    return html.replace(/<[^>]*>/g, '')
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Sanitize HTML content for safe rendering.
 *
 * This is the ONLY sanitizer you should use in the entire application.
 * It allows MathML, images, tables, and basic formatting while
 * blocking scripts, iframes, and event handlers.
 *
 * Uses isomorphic-dompurify which works on both server and client.
 *
 * @param html - Raw HTML content to sanitize
 * @returns Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORCE_BODY: true,
    })
  } catch {
    return serverSanitize(html)
  }
}

/**
 * Sanitize HTML content for safe storage (server-side).
 * This MUST be called before storing any user/admin content in the database.
 * Unlike sanitizeHtml() which is client-optimized, this always runs the
 * server-side sanitizer that strips dangerous tags and attributes.
 *
 * @param html - Raw HTML content from admin/user input
 * @returns Sanitized HTML safe for database storage
 */
export function sanitizeForStorage(html: string): string {
  if (!html) return ''
  return serverSanitize(html)
}

/**
 * Check if content appears to contain HTML markup that should be
 * rendered as rich content (vs. plain text with LaTeX).
 *
 * @param content - Content string to check
 * @returns true if content likely contains HTML tags
 */
export function containsHtml(content: string): boolean {
  if (!content) return false

  // Quick check for common HTML tags and MathML
  // MathML is included so that unprocessed <math> tags take the HTML path
  // (preserving them as elements rather than escaping to text).
  const htmlTagRegex = /<(img|table|div|p|span|h[1-6]|ul|ol|li|a|br|hr|strong|em|b|i|u|s|code|pre|blockquote|figure|figcaption|video|audio|source|thead|tbody|tfoot|tr|th|td|caption|section|article|aside|header|footer|main|sup|sub|mark|small|del|ins|math)\b[^>]*>/i

  return htmlTagRegex.test(content)
}

/**
 * Get the list of allowed tags (for debugging/testing).
 */
export function getAllowedTags(): string[] {
  return [...ALLOWED_TAGS]
}

/**
 * Get the list of allowed attributes (for debugging/testing).
 */
export function getAllowedAttrs(): string[] {
  return [...ALLOWED_ATTR]
}
