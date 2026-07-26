'use client'

import { type FC } from 'react'
import { Settings2, Type, Maximize2, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { ReadingSettings, FontSize, LineHeight, ReadingWidth, ReadingTheme } from '@/hooks/use-reading-settings'

interface ReadingSettingsPanelProps {
  settings: ReadingSettings
  onUpdate: (partial: Partial<ReadingSettings>) => void
}

const FONT_SIZES: { key: FontSize; label: string }[] = [
  { key: 'sm', label: 'ছোট' },
  { key: 'base', label: 'মাঝারি' },
  { key: 'lg', label: 'বড়' },
  { key: 'xl', label: 'অতিরিক্ত' },
]

const LINE_HEIGHTS: { key: LineHeight; label: string }[] = [
  { key: 'normal', label: 'সাধারণ' },
  { key: 'relaxed', label: 'আরামদায়ক' },
  { key: 'loose', label: 'বেশি' },
]

const WIDTHS: { key: ReadingWidth; label: string }[] = [
  { key: 'comfort', label: 'আরামদায়ক' },
  { key: 'wide', label: 'প্রশস্ত' },
]

const THEMES: { key: ReadingTheme; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'সাদা', icon: Sun },
  { key: 'sepia', label: 'সেপিয়া', icon: Sun },
  { key: 'dark', label: 'গাঢ়', icon: Moon },
]

export default function ReadingSettingsPanel({ settings, onUpdate }: ReadingSettingsPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="পড়ার সেটিংস">
          <Settings2 className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:w-80">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4" />
            পড়ার সেটিংস
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Font Size */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2.5">
              <Type className="size-3.5" />
              ফন্ট সাইজ
            </label>
            <div className="flex gap-1">
              {FONT_SIZES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onUpdate({ fontSize: item.key })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.fontSize === item.key
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Line Height */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2.5">
              <Maximize2 className="size-3.5" />
              লাইন স্পেসিং
            </label>
            <div className="flex gap-1">
              {LINE_HEIGHTS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onUpdate({ lineHeight: item.key })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.lineHeight === item.key
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Width */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2.5">
              <Maximize2 className="size-3.5" />
              পড়ার প্রস্থ
            </label>
            <div className="flex gap-1">
              {WIDTHS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onUpdate({ readingWidth: item.key })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.readingWidth === item.key
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2.5">
              <Sun className="size-3.5" />
              থিম
            </label>
            <div className="flex gap-1">
              {THEMES.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    onClick={() => onUpdate({ readingTheme: item.key })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      settings.readingTheme === item.key
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
