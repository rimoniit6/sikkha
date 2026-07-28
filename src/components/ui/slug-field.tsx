'use client'

import { useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RotateCcw, Copy, Edit3, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slugPreviewPath } from '@/lib/slug'
import { copyToClipboardFallback } from '@/lib/dom-utils'

interface SlugFieldProps {
  /** Current slug value */
  value: string
  /** Called when slug changes (user edits or reset) */
  onChange: (value: string) => void
  /** Source text for generating slug (typically the title/name) */
  sourceText?: string
  /** Whether the slug has been manually edited (shows reset button) */
  isManuallyEdited?: boolean
  /** Called to reset slug to auto-generated value */
  onReset?: () => void
  /** Prefix for preview URL (default: 'blog') */
  previewPrefix?: string
  /** Optional error message */
  error?: string
  /** Site base URL for full preview (optional) */
  siteUrl?: string
  /** Show the label "Slug" */
  showLabel?: boolean
  /** Additional class names */
  className?: string
  /** Disable editing */
  disabled?: boolean
}

/**
 * SlugField — Reusable slug input component.
 *
 * Features:
 * - Read-only display by default (shows as text with edit button)
 * - Click "Edit" to make editable
 * - Auto-sync with title via onReset
 * - Copy to clipboard
 * - Preview URL display
 * - Error state with message
 * - Reset button when manually edited
 */
export default function SlugField({
  value,
  onChange,
  sourceText,
  isManuallyEdited,
  onReset,
  previewPrefix = 'blog',
  error,
  siteUrl,
  showLabel = true,
  className,
  disabled,
}: SlugFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const previewPath = slugPreviewPath(value, previewPrefix)
  const fullPreviewUrl = siteUrl
    ? `${siteUrl.replace(/\/+$/, '')}${previewPath}`
    : previewPath

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPreviewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      copyToClipboardFallback(fullPreviewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [fullPreviewUrl])

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <Label className={cn(error && 'text-destructive')}>
            Slug
            {isManuallyEdited && (
              <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                (সংশোধিত)
              </span>
            )}
          </Label>
          {!isEditing && (
            <span className="text-[10px] text-muted-foreground">
              /{previewPrefix}/{value || '...'}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {isEditing ? (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditing(false)
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className={cn('flex-1 font-mono text-sm', error && 'border-destructive')}
            placeholder="url-slug"
            disabled={disabled}
            autoFocus
          />
        ) : (
          <div
            className={cn(
              'flex-1 flex items-center h-9 px-3 rounded-md border bg-muted/30',
              'font-mono text-sm text-foreground',
              error && 'border-destructive',
            )}
            onClick={() => !disabled && setIsEditing(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!disabled) setIsEditing(true)
              }
            }}
          >
            <span className="flex-1 truncate">
              {value || (
                <span className="text-muted-foreground italic">
                  {sourceText ? 'অটো-জেনারেট হবে' : 'স্লাগ লিখুন'}
                </span>
              )}
            </span>
            {!disabled && (
              <Edit3 className="h-3 w-3 text-muted-foreground shrink-0 ml-2 opacity-60" />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Reset button — only when manually edited */}
          {isManuallyEdited && onReset && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onReset}
                    disabled={disabled}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">শিরোনাম থেকে পুনরায় জেনারেট করুন</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Copy button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  disabled={disabled || !value}
                >
                  {copied ? (
                    <span className="text-[10px] font-medium text-green-600">✓</span>
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{copied ? 'কপি করা হয়েছে!' : 'URL কপি করুন'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Preview link — opens in new tab */}
          {value && !disabled && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={previewPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">প্রিভিউ দেখুন</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  )
}
