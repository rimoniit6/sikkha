// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChapterTabs } from '../ChapterTabs'
import type { ChapterData } from '@/hooks/use-chapter-data'

// ─── Mock Radix UI Tabs ──────────────────────────────────────────────────
// Radix UI Tabs uses browser DOM APIs; mock with simple div-based components
// so we can test the filtering logic without a full browser environment.

vi.mock('@/components/ui/tabs', () => {
  // Track onValueChange handler so TabsTrigger clicks can propagate
  let currentOnValueChange: ((value: string) => void) | undefined

  return {
    Tabs: ({ children, onValueChange, ...props }: any) => {
      currentOnValueChange = onValueChange
      return (
        <div data-testid="tabs-root" data-value={props.value}>
          {children}
        </div>
      )
    },
    TabsList: ({ children, ...props }: any) => (
      <div data-testid="tabs-list" className={props.className}>
        {children}
      </div>
    ),
    TabsTrigger: ({ children, value, ...props }: any) => (
      <button
        data-testid={`tab-${value}`}
        data-value={value}
        className={props.className}
        onClick={() => currentOnValueChange?.(value)}
      >
        {children}
      </button>
    ),
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" className={props.className}>
      {children}
    </span>
  ),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────

function buildChapterData(overrides: Partial<ChapterData> = {}): ChapterData {
  return {
    id: 'test-chapter-id',
    name: 'Test Chapter',
    slug: 'test-chapter',
    number: 1,
    subjectName: 'Test Subject',
    subjectSlug: 'test-subject',
    className: 'Nine-Ten',
    classSlug: 'nine-ten',
    subjectId: 'test-subject-id',
    lectureCount: 0,
    mcqCount: 0,
    cqCount: 0,
    boardQuestionCount: 0,
    progress: 0,
    contentCounts: {},
    freeContentCounts: {},
    ...overrides,
  }
}

function getVisibleTabValues(container: HTMLElement): string[] {
  const triggers = container.querySelectorAll('[data-testid^="tab-"]')
  return Array.from(triggers).map((el) => el.getAttribute('data-value') || '')
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('ChapterTabs', () => {
  it('renders all 7 tabs when all content counts are > 0', () => {
    const chapter = buildChapterData({
      contentCounts: {
        lecture: 3,
        mcq: 15,
        cq: 7,
        'short-questions': 5,
        suggestion: 2,
        exam: 1,
      },
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const visible = getVisibleTabValues(container)
    expect(visible).toContain('all')
    expect(visible).toContain('lecture')
    expect(visible).toContain('mcq')
    expect(visible).toContain('cq')
    expect(visible).toContain('knowledge')
    expect(visible).toContain('suggestion')
    expect(visible).toContain('exam')
    expect(visible).toHaveLength(7)
  })

  it('hides tabs with count === 0 while keeping "all" tab', () => {
    const chapter = buildChapterData({
      contentCounts: {
        lecture: 0,
        mcq: 15,
        cq: 0,
        'short-questions': 5,
        suggestion: 0,
        exam: 0,
      },
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const visible = getVisibleTabValues(container)
    expect(visible).toContain('all')
    expect(visible).toContain('mcq')
    expect(visible).toContain('knowledge')
    expect(visible).not.toContain('lecture')
    expect(visible).not.toContain('cq')
    expect(visible).not.toContain('suggestion')
    expect(visible).not.toContain('exam')
    expect(visible).toHaveLength(3) // all + mcq + knowledge
  })

  it('shows only "all" tab when all content counts are 0', () => {
    const chapter = buildChapterData({
      contentCounts: {
        lecture: 0,
        mcq: 0,
        cq: 0,
        'short-questions': 0,
        suggestion: 0,
        exam: 0,
      },
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const visible = getVisibleTabValues(container)
    expect(visible).toEqual(['all'])
  })

  it('shows only "all" tab when contentCounts is empty object', () => {
    const chapter = buildChapterData({ contentCounts: {} })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const visible = getVisibleTabValues(container)
    expect(visible).toEqual(['all'])
  })

  it('renders count badges only for visible content tabs', () => {
    const chapter = buildChapterData({
      contentCounts: {
        lecture: 3,
        mcq: 15,
        cq: 0,
      },
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const badges = container.querySelectorAll('[data-testid="badge"]')
    // 'all' tab has no badge; lecture has 3; mcq has 15; cq is hidden
    expect(badges).toHaveLength(2)

    const badgeTexts = Array.from(badges).map((b) => b.textContent)
    expect(badgeTexts).toContain('3')
    expect(badgeTexts).toContain('15')
  })

  it('passes activeTab to Tabs root element', () => {
    const chapter = buildChapterData({
      contentCounts: { lecture: 5 },
    })
    render(
      <ChapterTabs chapter={chapter} activeTab="lecture" onTabChange={() => {}} />,
    )

    const root = screen.getByTestId('tabs-root')
    expect(root.getAttribute('data-value')).toBe('lecture')
  })

  it('calls onTabChange when a visible content tab is clicked', () => {
    const onTabChange = vi.fn()
    const chapter = buildChapterData({
      contentCounts: { lecture: 5, mcq: 10 },
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={onTabChange} />,
    )

    // Click the MCQ tab — mock TabsTrigger fires onValueChange → onTabChange
    const mcqTab = container.querySelector<HTMLElement>('[data-testid="tab-mcq"]')
    expect(mcqTab).not.toBeNull()
    mcqTab!.click()

    expect(onTabChange).toHaveBeenCalledTimes(1)
    expect(onTabChange).toHaveBeenCalledWith('mcq')
  })

  it('does not render a tab trigger for a countKey missing in contentCounts', () => {
    const chapter = buildChapterData({
      contentCounts: { lecture: 3 }, // mcq, cq, etc. keys are absent
    })
    const { container } = render(
      <ChapterTabs chapter={chapter} activeTab="all" onTabChange={() => {}} />,
    )

    const visible = getVisibleTabValues(container)
    expect(visible).toEqual(['all', 'lecture'])
  })
})
