/**
 * Design Tokens — JS-accessible design system values.
 *
 * These tokens mirror the CSS custom properties defined in globals.css
 * and tailwind.config.ts, but are available at runtime in JS/TS code.
 *
 * Use these tokens when you need dynamic values in components,
 * calculations, or imperative code (e.g., animation distances,
 * scroll offsets, programmatic spacing).
 *
 * For styling, prefer Tailwind utility classes (globals.css + tailwind.config.ts).
 * These JS tokens are for programmatic use only.
 */

// ─── Spacing Scale ──────────────────────────────────────────────
export const spacing = {
  0: 0,
  1: 4,     // 0.25rem
  2: 8,     // 0.5rem
  3: 12,    // 0.75rem
  4: 16,    // 1rem
  5: 20,    // 1.25rem
  6: 24,    // 1.5rem
  8: 32,    // 2rem
  10: 40,   // 2.5rem
  12: 48,   // 3rem
  16: 64,   // 4rem
  20: 80,   // 5rem
  24: 96,   // 6rem
} as const

export type SpacingKey = keyof typeof spacing

// ─── Border Radius ──────────────────────────────────────────────
export const borderRadius = {
  sm: 6,       // 0.375rem
  md: 8,       // 0.5rem
  lg: 12,      // 0.75rem
  xl: 16,      // 1rem
  '2xl': 20,   // 1.25rem
  '3xl': 28,   // 1.75rem
  full: 9999,  // rounded-full
} as const

export type BorderRadiusKey = keyof typeof borderRadius

// ─── Typography Scale ───────────────────────────────────────────
export const typography = {
  xs: { fontSize: 12, lineHeight: 1.5 },
  sm: { fontSize: 14, lineHeight: 1.5 },
  base: { fontSize: 16, lineHeight: 1.625 },
  lg: { fontSize: 18, lineHeight: 1.625 },
  xl: { fontSize: 20, lineHeight: 1.375 },
  '2xl': { fontSize: 24, lineHeight: 1.25 },
  '3xl': { fontSize: 30, lineHeight: 1.25 },
  '4xl': { fontSize: 36, lineHeight: 1.25 },
} as const

export type TypographyKey = keyof typeof typography

// ─── Z-Index Scale ──────────────────────────────────────────────
export const zIndex = {
  header: 50,
  fab: 45,
  bottomNav: 40,
  drawer: 60,
  modal: 70,
  dialog: 80,
  popover: 90,
  tooltip: 100,
  toast: 110,
  max: 9999,
} as const

export type ZIndexKey = keyof typeof zIndex

// ─── Animation Durations ────────────────────────────────────────
export const duration = {
  fast: 100,
  normal: 200,
  slow: 300,
  slower: 500,
} as const

export type DurationKey = keyof typeof duration

// ─── Animation Easing Functions ─────────────────────────────────
export const easing = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

export type EasingKey = keyof typeof easing

// ─── Touch Target Sizes ─────────────────────────────────────────
export const touchTarget = {
  default: 44,  // 44px minimum for touch
  lg: 48,       // 48px for critical actions
} as const

// ─── Breakpoints (Mobile-First) ─────────────────────────────────
export const breakpoints = {
  xs: 400,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type BreakpointKey = keyof typeof breakpoints

// ─── Surface Variants ───────────────────────────────────────────
export const surface = {
  default: 'var(--surface)',
  secondary: 'var(--surface-secondary)',
  muted: 'var(--surface-muted)',
  elevated: 'var(--surface-elevated)',
  glass: 'var(--surface-glass)',
} as const

export type SurfaceKey = keyof typeof surface

// ─── Container Widths ───────────────────────────────────────────
export const containerWidth = {
  page: 'var(--container-max)',     // 72rem / 1152px
  content: '42rem',                  // 672px
  lecture: '48rem',                  // 768px
  blog: '40rem',                     // 640px
  dashboard: '56rem',                // 896px
  narrow: '32rem',                   // 512px
} as const

export type ContainerWidthKey = keyof typeof containerWidth

/**
 * Helper: Get a mobile-friendly padding value in rem.
 * This matches the CSS clamp() for --container-padding.
 */
export function getContainerPadding(width: number): number {
  if (width < 640) return 16       // 1rem — mobile
  if (width < 1024) return 24      // 1.5rem — tablet
  return 32                         // 2rem — desktop
}
