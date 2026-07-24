import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'
import StepIndicator from './StepIndicator'

interface StepItem {
  num: number
  label: string
  icon: React.ElementType
}

interface EditorShellProps {
  title: string
  editId?: string | null
  currentStep: number
  steps: StepItem[]
  onBack: () => void
  onCancel: () => void
  goNext: () => void
  goPrev: () => void
  canGoNext: () => boolean
  children: React.ReactNode
}

// Matches Lecture EditorView outer shell exactly:
// https://github.com/.../lectures/EditorView.tsx lines 128-501
export default function EditorShell({
  title,
  editId,
  currentStep,
  steps,
  onBack,
  onCancel,
  goNext,
  goPrev,
  canGoNext,
  children,
}: EditorShellProps) {
  return (
    <div className="space-y-6">
      {/* Header — identical to Lecture EditorView lines 130-150 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack} aria-label="ফিরে যান">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">ধাপ {currentStep}/৩</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editId && (
            <Badge variant="outline" className="text-xs">ID: {editId.slice(-8)}</Badge>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={onCancel}>
            <X className="h-4 w-4" /> বাতিল
          </Button>
        </div>
      </div>

      {/* Step Indicator Card — identical to Lecture EditorView lines 152-156 */}
      <Card>
        <CardContent className="p-6">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </CardContent>
      </Card>

      {/* Step content — parent renders children conditionally */}
      {children}

      {/* Navigation footer — identical to Lecture EditorView lines 464-501 */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          className="gap-2"
          onClick={goPrev}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4" /> আগের ধাপ
        </Button>

        <div className="flex items-center gap-2">
          {steps.map((step) => (
            <div
              key={step.num}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                step.num === currentStep
                  ? 'bg-emerald-500 w-6'
                  : step.num < currentStep
                  ? 'bg-emerald-400'
                  : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {currentStep < steps.length ? (
          <Button
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            onClick={goNext}
            disabled={!canGoNext()}
          >
            পরবর্তী ধাপ <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-[120px]" />
        )}
      </div>
    </div>
  )
}
