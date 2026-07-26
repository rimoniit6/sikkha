'use client'

import { useMemo } from 'react'
import { FilterSection } from './FilterSection'
import { useCascadingFilters } from '../hooks/useCascadingFilters'
import { useBoardFilterStore } from '@/store/board-filters'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'

export function TopFilters() {
  const metadata = useHierarchyMetadata()
  const cascading = useCascadingFilters()
  const classLevels = useBoardFilterStore((s) => s.classLevels)
  const boards = useBoardFilterStore((s) => s.boards)
  const years = useBoardFilterStore((s) => s.years)
  const subjects = useBoardFilterStore((s) => s.subjects)
  const chapters = useBoardFilterStore((s) => s.chapters)
  const questionTypes = useBoardFilterStore((s) => s.questionTypes)
  const setFilter = useBoardFilterStore((s) => s.setFilter)

  const yearOptions = useMemo(() => {
    return metadata.questionYearOptions || []
  }, [metadata.questionYearOptions])

  const typeOptions = [
    { value: 'mcq', label: 'MCQ' },
    { value: 'cq', label: 'CQ' },
  ]

  return (
    <div className="hidden md:block rounded-xl border border-border/40 bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSection label="Class" options={metadata.classOptions} selectedValues={classLevels} onChange={cascading.handleClassChange} placeholder="Select class" />
        <FilterSection label="Board" options={metadata.boardOptions} selectedValues={boards} onChange={(v) => setFilter('boards', v)} placeholder="Select board" />
        <FilterSection label="Year" options={yearOptions} selectedValues={years} onChange={(v) => setFilter('years', v)} placeholder="Select year" />
        <FilterSection label="Subject" options={cascading.subjectOptions} selectedValues={subjects} onChange={cascading.handleSubjectChange} placeholder="Select subject" disabled={cascading.noClassSelected} />
        <FilterSection label="Chapter" options={cascading.chapterOptions} selectedValues={chapters} onChange={(v) => setFilter('chapters', v)} placeholder="Select chapter" disabled={cascading.noSubjectSelected} />
        <FilterSection label="Type" options={typeOptions} selectedValues={questionTypes} onChange={(v) => setFilter('questionTypes', v)} placeholder="All types" />
      </div>
    </div>
  )
}
