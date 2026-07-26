import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Colors (only tokens NOT already in @theme inline in globals.css) ──
      // Edu platform colors are defined via @theme inline in globals.css
      // and available as bg-edu-primary, text-edu-primary, etc.
      colors: {
        // Keep standard shadcn colors for backward compatibility
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },

      // ── Border Radius ───────────────────────────────────────
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },

      // ── Font Family ─────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        bengali: ['var(--font-geist-sans)', 'Noto Sans Bengali', 'sans-serif'],
      },

      // ── Font Size ───────────────────────────────────────────
      fontSize: {
        // Mobile-first: xs starts at 12px for captions
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-relaxed)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-relaxed)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
      },

      // ── Spacing ─────────────────────────────────────────────
      spacing: {
        '0': 'var(--space-0)',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        // Safe area spacing helpers
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
      },

      // ── Box Shadow ──────────────────────────────────────────
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        // Mobile-optimized shadows (softer, more natural)
        'mobile-sm': '0 1px 3px oklch(0 0 0 / 0.06), 0 1px 2px oklch(0 0 0 / 0.04)',
        'mobile-md': '0 4px 8px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04)',
        'mobile-lg': '0 8px 16px oklch(0 0 0 / 0.08), 0 4px 8px oklch(0 0 0 / 0.04)',
        // Premium gold glow
        'premium': '0 4px 14px oklch(0.65 0.22 45 / 0.3)',
        'premium-lg': '0 8px 32px oklch(0.65 0.22 45 / 0.35)',
        // Glass shadow
        'glass': '0 4px 16px oklch(0 0 0 / 0.08)',
        // Bottom sheet shadow
        'bottom-sheet': '0 -8px 32px oklch(0 0 0 / 0.1)',
      },

      // ── Z-Index ────────────────────────────────────────────
      zIndex: {
        'header': '50',
        'fab': '45',
        'bottom-nav': '40',
        'drawer': '60',
        'modal': '70',
        'dialog': '80',
        'popover': '90',
        'tooltip': '100',
        'toast': '110',
        'max': '9999',
      },

      // ── Max Width (Container System) ────────────────────────
      maxWidth: {
        'page': 'var(--container-max)',
        'content': '42rem',
        'lecture': '48rem',
        'blog': '40rem',
        'dashboard': '56rem',
        'narrow': '32rem',
      },

      // ── Min Height ──────────────────────────────────────────
      minHeight: {
        'touch': '44px',
        'touch-lg': '48px',
        'screen-no-header': 'calc(100dvh - 3.5rem)',
      },

      // ── Min Width ───────────────────────────────────────────
      minWidth: {
        'touch': '44px',
      },

      // ── Background Colors (Surfaces) ────────────────────────
      backgroundColor: {
        surface: {
          DEFAULT: 'var(--surface)',
          secondary: 'var(--surface-secondary)',
          muted: 'var(--surface-muted)',
          elevated: 'var(--surface-elevated)',
          glass: 'var(--surface-glass)',
        },
      },

      // ── Transition & Animation ──────────────────────────────
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'default': 'var(--ease-default)',
        'in': 'var(--ease-in)',
        'out': 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        'spring': 'var(--ease-spring)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-left': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-down': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-out-down': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.02)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out) both',
        'fade-in-up': 'fade-in-up var(--duration-normal) var(--ease-out) both',
        'fade-in-down': 'fade-in-down var(--duration-normal) var(--ease-out) both',
        'fade-in-left': 'fade-in-left var(--duration-normal) var(--ease-out) both',
        'fade-in-right': 'fade-in-right var(--duration-normal) var(--ease-out) both',
        'scale-in': 'scale-in var(--duration-normal) var(--ease-spring) both',
        'slide-in-up': 'slide-in-up var(--duration-slow) var(--ease-spring) both',
        'slide-in-down': 'slide-in-down var(--duration-normal) var(--ease-out) both',
        'slide-out-down': 'slide-out-down var(--duration-normal) var(--ease-in) both',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'bounce-in': 'bounce-in 0.5s var(--ease-spring) both',
        // Fast variants for micro-interactions
        'fade-in-fast': 'fade-in 100ms var(--ease-out) both',
        'scale-in-fast': 'scale-in 100ms var(--ease-spring) both',
      },

      // ── Screens (Mobile-First) ───────────────────────────────
      screens: {
        'xs': '400px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        // Touch device detection via pointer queries
        'touch': { raw: '(pointer: coarse)' },
        'fine': { raw: '(pointer: fine)' },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
