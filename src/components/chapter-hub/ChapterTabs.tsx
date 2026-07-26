'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { ChapterData } from '@/hooks/use-chapter-data'

interface TabDef {
  value: string
  label: string
  countKey?: string
}

const TABS: TabDef[] = [
  { value: 'all', label: 'All' },
  { value: 'lecture', label: 'Lectures', countKey: 'lecture' },
  { value: 'mcq', label: 'MCQ', countKey: 'mcq' },
  { value: 'cq', label: 'CQ', countKey: 'cq' },
  { value: 'knowledge', label: 'Knowledge', countKey: 'short-questions' },
  { value: 'suggestion', label: 'Suggestions', countKey: 'suggestion' },
  { value: 'exam', label: 'Exams', countKey: 'exam' },
]

interface ChapterTabsProps {
  chapter: ChapterData
  activeTab: string
  onTabChange: (tab: string) => void
}

export function ChapterTabs({ chapter, activeTab, onTabChange }: ChapterTabsProps) {
  // Filter out tabs with zero count, but always show 'all' tab
  const visibleTabs = TABS.filter((tab) => {
    if (!tab.countKey) return true // 'all' tab always visible
    const count = chapter.contentCounts[tab.countKey]
    return count && count > 0
  })

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full justify-start overflow-x-auto scrollbar-none gap-1 bg-transparent p-0 h-auto">
        {visibleTabs.map((tab) => {
          const count = tab.countKey ? chapter.contentCounts[tab.countKey] : undefined
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="shrink-0 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-1.5"
            >
              {tab.label}
              {count !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
