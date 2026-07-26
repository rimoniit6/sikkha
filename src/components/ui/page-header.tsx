import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — Consistent page title area for any page.
 *
 * A composable component (not a wrapper) that renders just the header area
 * with title, description, optional action, and optional back area.
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="অধ্যায় ১"
 *   description="পদার্থবিজ্ঞান"
 *   action={<Button>Edit</Button>}
 * />
 * ```
 */

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title (rendered as h1) */
  title?: string
  /** Optional subtitle/description */
  description?: string
  /** Optional action element (button, menu, etc.) placed on the right */
  action?: React.ReactNode
  /** Optional back navigation area */
  backArea?: React.ReactNode
  /** Removes bottom border */
  noBorder?: boolean
  /** Reduces spacing (for nested sections) */
  compact?: boolean
}

function PageHeader({
  className,
  title,
  description,
  action,
  backArea,
  noBorder = false,
  compact = false,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        compact ? 'py-3' : 'py-4 sm:py-6',
        !noBorder && 'border-b border-border/50 mb-4 sm:mb-6',
        className
      )}
      {...props}
    >
      {backArea && <div className="mb-1">{backArea}</div>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="heading-3 text-foreground">
              {title}
            </h1>
          )}
          {description && (
            <p className="body-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
          {children}
        </div>
        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * PageSection — A visually grouped content section with optional title.
 */
interface PageSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section title */
  title?: string
}

function PageSection({ className, title, children, ...props }: PageSectionProps) {
  return (
    <section className={cn('mb-6 sm:mb-8', className)} {...props}>
      {title && (
        <h2 className="heading-4 text-foreground mb-3 sm:mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

export { PageHeader, PageSection }
export type { PageHeaderProps, PageSectionProps }
