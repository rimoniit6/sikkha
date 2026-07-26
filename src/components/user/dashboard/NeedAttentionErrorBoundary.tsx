'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface NeedAttentionErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback. If omitted, renders a Bengali error state. */
  fallback?: ReactNode
}

interface NeedAttentionErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * Lightweight error boundary that wraps only the NeedAttention weakness section.
 * Preserves the rest of the dashboard if this section crashes.
 */
export class NeedAttentionErrorBoundary extends Component<
  NeedAttentionErrorBoundaryProps,
  NeedAttentionErrorBoundaryState
> {
  constructor(props: NeedAttentionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): NeedAttentionErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[NeedAttentionErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          className="mb-6 sm:mb-8"
          role="alert"
          aria-live="assertive"
          aria-labelledby="weakness-error-title"
        >
          <div className="flex items-center gap-2 mb-3">
            <h2
              id="weakness-error-title"
              className="text-base sm:text-lg font-bold flex items-center gap-2"
            >
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/40 dark:to-amber-900/40">
                <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
              </div>
              দুর্বলতা শনাক্তকরণ
            </h2>
          </div>
          <Card className="border-0 bg-gradient-to-br from-rose-50/50 to-amber-50/30 dark:from-rose-950/20 dark:to-amber-950/10">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 mb-4">
                <AlertTriangle className="size-7 text-destructive" />
              </div>
              <h3 className="font-semibold text-base mb-1" id="weakness-error-message">
                দুর্বলতা বিশ্লেষণ করতে সমস্যা হয়েছে
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                আপনার পারফরম্যান্স ডেটা লোড করতে সাময়িক সমস্যা হচ্ছে।
                অনুগ্রহ করে আবার চেষ্টা করুন।
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="text-xs text-left bg-muted p-3 rounded-lg mb-4 max-w-md mx-auto overflow-auto">
                  {this.state.error.message}
                </pre>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="gap-2"
                aria-label="পুনরায় চেষ্টা করুন"
              >
                <RefreshCw className="size-4" />
                আবার চেষ্টা করুন
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
