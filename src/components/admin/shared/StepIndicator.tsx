import { Check } from 'lucide-react'
import React from 'react'

interface StepItem {
  num: number
  label: string
  icon: React.ElementType
}

export default function StepIndicator({ currentStep, steps }: { currentStep: number; steps: StepItem[] }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative overflow-x-auto">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-emerald-500 z-0 transition-all duration-500"
          style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
        />

        {steps.map((step) => {
          const isActive = step.num === currentStep
          const isCompleted = step.num < currentStep
          const Icon = step.icon

          return (
            <div key={step.num} className="flex flex-col items-center z-10 relative">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-background border-emerald-500 text-emerald-600 ring-4 ring-emerald-500/20'
                    : 'bg-background border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium text-center whitespace-nowrap ${
                  isActive ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
