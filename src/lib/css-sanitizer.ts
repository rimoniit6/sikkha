/**
 * CSS Sanitizer — Inline Style Value Filter
 *
 * DOMPurify's ALLOWED_STYLES option may not reliably filter individual
 * CSS properties in all versions. This custom CSS sanitizer provides
 * deterministic filtering of inline style attribute values.
 *
 * Pipeline:
 *   1. Parse CSS declaration string into individual declarations
 *   2. Filter each declaration against:
 *      a. ALLOWED_STYLES property whitelist
 *      b. Dangerous value patterns (javascript:, expression(), etc.)
 *   3. Re-join surviving declarations
 *
 * This runs AFTER DOMPurify's HTML/sanitize pass, as a second layer
 * specifically for CSS value sanitization.
 *
 * @module css-sanitizer
 */

// ─── Allowed CSS Properties (must match src/lib/sanitize.ts) ─────

const ALLOWED_STYLES: string[] = [
  // Layout & Box Model
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'box-sizing', 'overflow',

  // Display & Flex/Grid
  'display',
  'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-items', 'align-content', 'align-self',
  'justify-content', 'justify-items', 'justify-self',
  'gap', 'row-gap', 'column-gap',
  'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
  'grid-column', 'grid-row', 'grid-area',

  // Typography
  'color', 'font-size', 'font-family', 'font-weight', 'font-style',
  'line-height', 'text-align', 'text-decoration', 'text-transform',
  'letter-spacing', 'word-spacing', 'white-space',
  'direction', 'unicode-bidi',

  // Background
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat',

  // Border & Outline
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width',
  'border-radius', 'border-collapse', 'border-spacing',
  'outline', 'outline-color', 'outline-style', 'outline-width',
  'box-shadow',

  // List
  'list-style', 'list-style-type', 'list-style-position',

  // Table
  'vertical-align', 'table-layout',

  // Misc Visual
  'opacity', 'visibility', 'cursor',
  'transform', 'transition', 'transition-property', 'transition-duration',
  'transition-timing-function', 'transition-delay',
]

// Normalized set for O(1) lookup
const ALLOWED_STYLES_SET = new Set(ALLOWED_STYLES.map(s => s.toLowerCase()))

// ─── Dangerous Value Patterns ──────────────────────────────────

/**
 * Regex patterns for CSS values that must be blocked entirely.
 * If any of these patterns match a declaration's value, the entire
 * declaration is removed.
 */
const BLOCKED_CSS_VALUE_PATTERNS: RegExp[] = [
  // JavaScript execution via CSS
  /expression\s*\(/i,
  /javascript\s*:/i,
  /url\s*\(\s*(['"]?)\s*javascript\s*:/i,

  // IE-specific behaviors
  /behavior\s*:/i,
  /-ms-behavior\s*:/i,

  // External resource imports
  /@import\s+/i,
  /url\s*\(\s*(['"]?)\s*data\s*:/i,

  // CSS custom property injection (potential XSS via polyfill)
  /--[a-z]/i,

  // Dangerous positioning for UI overlay
  /position\s*:\s*fixed/i,
  /position\s*:\s*absolute/i,
]

/**
 * Check if a CSS value is dangerous and should be blocked.
 */
function isDangerousValue(value: string): boolean {
  return BLOCKED_CSS_VALUE_PATTERNS.some(pattern => pattern.test(value))
}

/**
 * Check if a CSS property name is in the allowed whitelist.
 */
function isAllowedProperty(property: string): boolean {
  return ALLOWED_STYLES_SET.has(property.trim().toLowerCase())
}

/**
 * Parse a CSS declaration (e.g. "color: red") into property and value.
 */
function parseDeclaration(decl: string): { property: string; value: string } | null {
  const colonIndex = decl.indexOf(':')
  if (colonIndex === -1) return null
  const property = decl.substring(0, colonIndex).trim()
  const value = decl.substring(colonIndex + 1).trim()
  if (!property || !value) return null
  return { property, value }
}

/**
 * Sanitize a CSS style attribute value string.
 *
 * @param styleValue - The raw value of a `style` attribute
 * @returns Sanitized style attribute value with only safe properties
 *
 * @example
 * sanitizeCss('color:red;position:fixed;background:url(javascript:alert(1))')
 * // Returns: 'color:red'  (position:fixed and dangerous url() removed)
 */
export function sanitizeCss(styleValue: string): string {
  if (!styleValue || !styleValue.trim()) return ''

  const declarations = styleValue.split(';')
  const safeDeclarations: string[] = []

  for (const decl of declarations) {
    const trimmed = decl.trim()
    if (!trimmed) continue

    const parsed = parseDeclaration(trimmed)
    if (!parsed) continue

    // Check 1: Is the property allowed?
    if (!isAllowedProperty(parsed.property)) continue

    // Check 2: Is the value safe?
    if (isDangerousValue(parsed.value)) continue

    safeDeclarations.push(`${parsed.property}: ${parsed.value}`)
  }

  return safeDeclarations.join('; ')
}

/**
 * Check whether a style attribute value contains any dangerous CSS.
 * Useful for validation error messages.
 *
 * @param styleValue - The raw style attribute value
 * @returns Array of dangerous patterns found, or empty array if safe
 */
export function detectDangerousCss(styleValue: string): string[] {
  if (!styleValue) return []

  const found: string[] = []
  const declarations = styleValue.split(';')

  for (const decl of declarations) {
    const trimmed = decl.trim()
    if (!trimmed) continue

    const parsed = parseDeclaration(trimmed)
    if (!parsed) continue

    if (isDangerousValue(parsed.value)) {
      found.push(`${parsed.property}: ${parsed.value}`)
    }

    if (!isAllowedProperty(parsed.property)) {
      found.push(`${parsed.property}: [blocked property]`)
    }
  }

  return found
}

/**
 * Get the list of allowed CSS properties (for debugging/testing).
 */
export function getAllowedCssProperties(): string[] {
  return [...ALLOWED_STYLES]
}
