/**
 * Safe DOM manipulation utilities.
 *
 * These utilities guard against the "Cannot read properties of null (reading 'removeChild')"
 * error that occurs when a DOM node has already been removed from the tree (e.g., by
 * React StrictMode double-unmount, Framer Motion exit animation cleanup, or async
 * continuation after unmount).
 */

/**
 * Safely removes a child node from its parent.
 *
 * Guards against:
 * - parentNode being null (node already detached)
 * - document.body being null (SSR / hydration edge case)
 * - node being null / undefined
 * - node not actually being a child of parent
 *
 * Returns true if removal succeeded, false if skipped.
 *
 * @example
 * // Before (unsafe — throws if parentNode is null):
 * document.body.removeChild(element)
 * // or
 * element.parentNode.removeChild(element)
 *
 * // After (safe — no-op if null):
 * safeRemoveChild(document.body, element)
 * // or
 * safeRemoveChild(element.parentNode, element)
 */
export function safeRemoveChild(parent: Node | null | undefined, child: Node | null | undefined): boolean {
  if (!parent || !child) return false
  if (!parent.contains(child)) return false
  try {
    parent.removeChild(child)
    return true
  } catch {
    return false
  }
}

/**
 * Safely appends a child to a parent.
 * Guards against null parent.
 */
export function safeAppendChild(parent: Node | null | undefined, child: Node | null | undefined): boolean {
  if (!parent || !child) return false
  try {
    parent.appendChild(child)
    return true
  } catch {
    return false
  }
}

/**
 * Creates a temporary DOM element, triggers a download, then safely cleans up.
 *
 * This is a safe replacement for the common pattern:
 * ```
 * const a = document.createElement('a')
 * a.href = url
 * a.download = filename
 * document.body.appendChild(a)
 * a.click()
 * document.body.removeChild(a)
 * ```
 */
export function triggerDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') return

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'

  if (safeAppendChild(document.body, a) && a.parentNode) {
    try {
      a.click()
    } catch {
      // ignore click errors
    }
    safeRemoveChild(document.body, a)
  }
}

/**
 * Creates a temporary textarea and copies text to clipboard (fallback).
 *
 * Replacement for the `document.execCommand('copy')` fallback pattern.
 */
export function copyToClipboardFallback(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  if (safeAppendChild(document.body, textarea) && textarea.parentNode) {
    try {
      textarea.select()
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      safeRemoveChild(document.body, textarea)
    }
  }
  return false
}
