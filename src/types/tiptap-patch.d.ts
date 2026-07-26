/**
 * Tiptap v3.29.0 Type Patches
 *
 * The bundled .d.ts files in @tiptap/react@3.29.0 are missing several exports
 * that exist at runtime:
 *
 * 1. NodeViewWrapper and ReactNodeViewRenderer exist in the source but are NOT
 *    re-exported in the bundled dist/index.d.ts.
 * 2. ChainedCommands (from @tiptap/core) lacks methods that the extension
 *    packages (Bold, Italic, Link, etc.) add via module augmentation — the
 *    augmentation does not work across mismatched package resolutions.
 *
 * These patches provide the missing type information so the project compiles.
 * Remove when upstream types are fixed.
 */

import React from 'react'

// ─── @tiptap/react missing component exports ─────────────────────

declare module '@tiptap/react' {
  /**
   * A React component that wraps a NodeView for rendering inside the editor.
   * Re-exported from @tiptap/react but missing from bundled .d.ts in v3.29.0.
   */
  export const NodeViewWrapper: React.ComponentType<{
    as?: keyof JSX.IntrinsicElements
    className?: string
    style?: React.CSSProperties
    [key: string]: unknown
  }>

  /**
   * A function that creates a NodeView renderer from a React component.
   * Re-exported from @tiptap/react but missing from bundled .d.ts in v3.29.0.
   */
  export const ReactNodeViewRenderer: (
    component: React.ComponentType<any>,
    options?: { 
      as?: string 
      className?: string 
      [key: string]: unknown 
    },
  ) => unknown
}

// ─── @tiptap/core extension commands ─────────────────────────────

declare module '@tiptap/core' {
  interface ChainedCommands {
    // Mark / inline formatting
    toggleBold: () => this
    toggleItalic: () => this
    toggleUnderline: () => this
    toggleStrike: () => this
    toggleCode: () => this

    // Block formatting
    toggleHeading: (attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 }) => this
    toggleBlockquote: () => this
    setHorizontalRule: () => this

    // Links
    setLink: (attrs: { href: string; target?: string; rel?: string }) => this
    unsetLink: () => this
  }
}
