'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SectionErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  /** Human-readable section name for the error fallback */
  sectionName?: string
}

interface SectionErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * Lightweight error boundary that wraps individual dashboard sections.
 * Prevents a single crashing section from taking down the entire UserDashboardPage.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary${this.props.sectionName ? `: ${this.props.sectionName}` : ''}] Caught error:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="mb-6 sm:mb-8" role="alert" aria-live="assertive">
          <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20 p-6 text-center">
            <div className="inline-flex items-center justify-center size-10 rounded-xl bg-muted mb-3">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">
              {this.props.sectionName
                ? `${this.props.sectionName} লোড করতে সমস্যা হয়েছে`
                : 'এই অংশটি লোড করতে সমস্যা হয়েছে'}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              অনুগ্রহ করে আবার চেষ্টা করুন
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs text-left bg-muted p-2 rounded-lg mb-3 max-w-md mx-auto overflow-auto text-destructive">
                {this.state.error.message}
              </pre>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" />
              আবার চেষ্টা করুন
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
