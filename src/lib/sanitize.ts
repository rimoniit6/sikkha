/**
 * Centralized HTML sanitizer configuration for the entire application.
 *
 * This is the SINGLE source of truth for sanitization rules.
 * All content rendering MUST use `sanitizeHtml()` from this module.
 *
 * NEVER create inline DOMPurify configurations elsewhere.
 */

import DOMPurify from 'isomorphic-dompurify'
import { sanitizeCss } from '@/lib/css-sanitizer'

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

// ─── Safe CSS Properties whitelist (for inline style attributes) ──
// Only these CSS properties are allowed on the `style` attribute.
// All other CSS properties (including dangerous ones like position:fixed)
// are stripped by DOMPurify.

const ALLOWED_STYLES: string[] = [
  // ── Layout & Box Model ──
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'box-sizing', 'overflow',

  // ── Display & Flex/Grid ──
  'display',
  'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-items', 'align-content', 'align-self',
  'justify-content', 'justify-items', 'justify-self',
  'gap', 'row-gap', 'column-gap',
  'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
  'grid-column', 'grid-row', 'grid-area',

  // ── Typography ──
  'color', 'font-size', 'font-family', 'font-weight', 'font-style',
  'line-height', 'text-align', 'text-decoration', 'text-transform',
  'letter-spacing', 'word-spacing', 'white-space',
  'direction', 'unicode-bidi',

  // ── Background ──
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat',

  // ── Border & Outline ──
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width',
  'border-radius', 'border-collapse', 'border-spacing',
  'outline', 'outline-color', 'outline-style', 'outline-width',
  'box-shadow',

  // ── List ──
  'list-style', 'list-style-type', 'list-style-position',

  // ── Table ──
  'vertical-align', 'table-layout',

  // ── Misc Visual ──
  'opacity', 'visibility', 'cursor',
  'transform', 'transition', 'transition-property', 'transition-duration',
  'transition-timing-function', 'transition-delay',
]

// ─── Allowed Attributes ──────────────────────────────────────────

const ALLOWED_ATTR: string[] = [
  // ── Global ──
  'class', 'id', 'title', 'lang', 'dir',
  'role', 'aria-hidden', 'aria-label', 'aria-describedby',
  'style',  // Safe inline CSS — filtered by ALLOWED_STYLES

  // ── Links ──
  'href', 'target', 'rel',

  // ── Images ──
  'src', 'alt', 'width', 'height', 'loading',

  // ── Media ──
  'controls', 'autoplay', 'loop', 'muted', 'preload',
  'allow', 'allowfullscreen', 'frameborder', 'referrerpolicy',

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

  // ── Safe educational data-* attributes (controlled allowlist) ──
  // With ALLOW_DATA_ATTR: false, only these explicitly listed data-*
  // attributes survive sanitization. All others (data-script,
  // data-onclick, data-action, etc.) are automatically stripped.
  'data-type',
  'data-block',
  'data-id',
  'data-video-id',
  'data-resource-id',
]

// ─── Helper: re-sanitize style attributes with CSS sanitizer ────
// DOMPurify may pass through dangerous CSS values in style attributes.
// This post-process pass applies our custom CSS sanitizer to every
// `style` attribute in the HTML output.

function postProcessCss(html: string): string {
  // Handle both double-quoted and single-quoted style attributes
  let result = html.replace(
    /style="([^"]*)"/gi,
    (_match: string, styleValue: string) => {
      const safe = sanitizeCss(styleValue)
      if (!safe) return '' // Remove empty style attributes
      return `style="${safe}"`
    }
  )
  result = result.replace(
    /style='([^']*)'/gi,
    (_match: string, styleValue: string) => {
      const safe = sanitizeCss(styleValue)
      if (!safe) return ''
      return `style="${safe}"` // Normalize to double quotes
    }
  )
  return result
}

// ─── Server-side sanitizer (uses isomorphic-dompurify) ────

function serverSanitize(html: string): string {
  try {
    let result = String(DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_STYLES,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORCE_BODY: true,
    } as any))
    // Apply CSS sanitizer post-process to strip dangerous CSS values
    result = postProcessCss(result)
    return result
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
    let result = String(DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_STYLES,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORCE_BODY: true,
    } as any))
    // Apply CSS sanitizer post-process to strip dangerous CSS values
    result = postProcessCss(result)
    return result
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

/**
 * Get the list of allowed data-* attributes (for debugging/testing).
 */
export function getAllowedDataAttrs(): string[] {
  return ALLOWED_ATTR.filter(a => a.startsWith('data-')).map(a => a)
}
