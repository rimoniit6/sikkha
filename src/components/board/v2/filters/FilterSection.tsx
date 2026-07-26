'use client'

import { MultiSelect } from '@/components/ui/multi-select'
import type { FilterOption } from '@/types/board-questions'

interface FilterSectionProps {
  label: string
  options: FilterOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function FilterSection({ label, options, selectedValues, onChange, placeholder, disabled }: FilterSectionProps) {
  // Hide filter section when there are no options to choose from (e.g. no years with questions)
  if (options.length === 0 && !disabled) return null

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <MultiSelect
        options={options}
        selectedValues={selectedValues}
        onChange={onChange}
        placeholder={placeholder || label}
        disabled={disabled}
      />
    </div>
  )
}
