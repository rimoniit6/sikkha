// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
/**
 * Unit tests for useBulkContentSelection hook.
 *
 * Covers:
 * - Single item operations (toggleOne, isSelected, removeItem, getItem)
 * - Batch operations (selectAllVisible, deselectAllVisible, invertSelection)
 * - Cross-type ID collision prevention
 * - clearAll, clearType
 * - replaceSelection (edit flow)
 * - selectAllFiltered (cross-pagination)
 * - getVisibleState edge cases
 * - Selection summary (byType, totalItems, totalPrice)
 * - Empty / edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Container } from 'react-dom/client'
import { useBulkContentSelection } from '@/hooks/use-bulk-content-selection'
import type { SelectedContentItem } from '@/components/admin/bundles/types'

// ─── Custom renderHook helper ────────────────────────────────────────
// Avoids needing @testing-library/react. Works with jsdom + React 19.

interface RenderHookResult<T> {
  result: { current: T }
  rerender: () => void
  unmount: () => void
}

function renderHook<T>(hookFn: () => T): RenderHookResult<T> {
  const result: { current: T | null } = { current: null }
  const container = document.createElement('div')
  let root: ReturnType<typeof createRoot> | null = null

  function TestComponent() {
    result.current = hookFn()
    return null
  }

  act(() => {
    root = createRoot(container)
    ;(root as any).render(React.createElement(TestComponent))
  })

  return {
    get result() {
      return { current: result.current as T }
    },
    rerender: () => {
      act(() => {
        ;(root as any).render(React.createElement(TestComponent))
      })
    },
    unmount: () => {
      act(() => {
        ;(root as any).unmount()
      })
      container.remove()
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function makeItem(id: string, title?: string, price?: number) {
  return { id, title: title ?? `Item ${id}`, price: price ?? 100 }
}

function makeSelectedItem(
  contentType: string,
  contentId: string,
  overrides?: Partial<SelectedContentItem>,
): SelectedContentItem {
  return {
    contentType,
    contentId,
    title: overrides?.title ?? `${contentType} #${contentId}`,
    price: overrides?.price ?? 0,
    order: overrides?.order ?? 0,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('useBulkContentSelection', () => {
  let hook: RenderHookResult<ReturnType<typeof useBulkContentSelection>>

  beforeEach(() => {
    hook = renderHook(() => useBulkContentSelection())
  })

  afterEach(() => {
    hook.unmount()
  })

  // ── Initial state ──────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty selection', () => {
      const { result } = hook
      expect(result.current.selectionMap.size).toBe(0)
      expect(result.current.selectedItems).toEqual([])
      expect(result.current.summary.totalItems).toBe(0)
      expect(result.current.summary.totalPrice).toBe(0)
      expect(result.current.summary.byType).toEqual({})
    })

    it('isSelected returns false for any item', () => {
      expect(hook.result.current.isSelected('mcq', '1')).toBe(false)
    })

    it('getItem returns undefined for unselected items', () => {
      expect(hook.result.current.getItem('mcq', '1')).toBeUndefined()
    })
  })

  // ── Single item operations ─────────────────────────────────────

  describe('toggleOne', () => {
    it('adds an item', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1', 'Question 1', 50)) })

      expect(hook.result.current.isSelected('mcq', '1')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
      expect(hook.result.current.selectedItems[0].contentId).toBe('1')
      expect(hook.result.current.selectedItems[0].contentType).toBe('mcq')
      expect(hook.result.current.selectedItems[0].title).toBe('Question 1')
      expect(hook.result.current.selectedItems[0].price).toBe(50)
    })

    it('removes an already-selected item (toggle off)', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      expect(hook.result.current.isSelected('mcq', '1')).toBe(true)

      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      expect(hook.result.current.isSelected('mcq', '1')).toBe(false)
      expect(hook.result.current.selectedItems).toHaveLength(0)
    })

    it('accepts contentId instead of id', () => {
      act(() => { hook.result.current.toggleOne('mcq', { contentId: 'x1', title: 'Test' }) })
      expect(hook.result.current.isSelected('mcq', 'x1')).toBe(true)
    })

    it('prefers contentId over id when both present', () => {
      act(() => { hook.result.current.toggleOne('mcq', { id: 'old-id', contentId: 'real-id', title: 'Test' }) })
      expect(hook.result.current.isSelected('mcq', 'old-id')).toBe(false)
      expect(hook.result.current.isSelected('mcq', 'real-id')).toBe(true)
    })

    it('does nothing when id and contentId are both missing', () => {
      act(() => { hook.result.current.toggleOne('mcq', {}) })
      expect(hook.result.current.selectedItems).toHaveLength(0)
    })

    it('uses fallback title when title is not provided', () => {
      act(() => { hook.result.current.toggleOne('mcq', { id: 'abc12345' }) })
      const item = hook.result.current.selectedItems[0]
      expect(item.title).toContain('mcq')
      expect(item.title).toContain('abc12345')
    })
  })

  describe('removeItem', () => {
    it('removes a selected item', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.removeItem('mcq', '1') })

      expect(hook.result.current.isSelected('mcq', '1')).toBe(false)
      expect(hook.result.current.selectedItems).toHaveLength(0)
    })

    it('does nothing when item is not selected', () => {
      act(() => { hook.result.current.removeItem('cq', 'nonexistent') })
      expect(hook.result.current.selectedItems).toHaveLength(0)
    })

    it('only removes the specified content type + id', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('2')) })
      act(() => { hook.result.current.removeItem('mcq', '1') })

      expect(hook.result.current.isSelected('cq', '2')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })
  })

  describe('isSelected', () => {
    it('returns true for selected items', () => {
      act(() => { hook.result.current.toggleOne('lecture', makeItem('l1')) })
      expect(hook.result.current.isSelected('lecture', 'l1')).toBe(true)
    })

    it('returns false for non-selected items', () => {
      expect(hook.result.current.isSelected('lecture', 'nonexistent')).toBe(false)
    })

    it('distinguishes same id across different content types', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      expect(hook.result.current.isSelected('mcq', '1')).toBe(true)
      expect(hook.result.current.isSelected('cq', '1')).toBe(false)
    })
  })

  describe('getItem', () => {
    it('retrieves a selected item by type + id', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1', 'My MCQ', 75)) })
      const item = hook.result.current.getItem('mcq', '1')
      expect(item).toBeDefined()
      expect(item!.contentId).toBe('1')
      expect(item!.contentType).toBe('mcq')
      expect(item!.title).toBe('My MCQ')
      expect(item!.price).toBe(75)
    })
  })

  // ── Cross-type ID collision prevention ─────────────────────────

  describe('cross-type ID collisions', () => {
    it('allows same ID in different content types', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('42')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('42')) })
      act(() => { hook.result.current.toggleOne('lecture', makeItem('42')) })

      expect(hook.result.current.selectedItems).toHaveLength(3)
      expect(hook.result.current.summary.totalItems).toBe(3)
    })

    it('removes the correct item when same ID across types', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('42')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('42')) })
      act(() => { hook.result.current.removeItem('mcq', '42') })

      expect(hook.result.current.isSelected('mcq', '42')).toBe(false)
      expect(hook.result.current.isSelected('cq', '42')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })
  })

  // ── Batch operations ───────────────────────────────────────────

  describe('selectAllVisible', () => {
    it('selects all visible items', () => {
      const items = [makeItem('1'), makeItem('2'), makeItem('3')]
      act(() => { hook.result.current.selectAllVisible('mcq', items) })

      expect(hook.result.current.isSelected('mcq', '1')).toBe(true)
      expect(hook.result.current.isSelected('mcq', '2')).toBe(true)
      expect(hook.result.current.isSelected('mcq', '3')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(3)
    })

    it('does NOT deselect previously selected items', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('existing')) })
      act(() => { hook.result.current.selectAllVisible('mcq', [makeItem('new')]) })

      expect(hook.result.current.isSelected('mcq', 'existing')).toBe(true)
      expect(hook.result.current.isSelected('mcq', 'new')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(2)
    })

    it('does NOT add duplicates of already-selected items', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.selectAllVisible('mcq', [makeItem('1'), makeItem('2')]) })

      expect(hook.result.current.selectedItems).toHaveLength(2)
    })

    it('accepts items with contentId', () => {
      act(() => {
        hook.result.current.selectAllVisible('cq', [
          { contentId: 'c1' },
          { contentId: 'c2', title: 'CQ 2' },
        ])
      })
      expect(hook.result.current.isSelected('cq', 'c1')).toBe(true)
      expect(hook.result.current.isSelected('cq', 'c2')).toBe(true)
    })

    it('skips items with no id or contentId', () => {
      act(() => { hook.result.current.selectAllVisible('mcq', [{} as any, makeItem('1')]) })
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })
  })

  describe('deselectAllVisible', () => {
    it('deselects all visible items', () => {
      act(() => { hook.result.current.selectAllVisible('mcq', [makeItem('1'), makeItem('2')]) })
      act(() => { hook.result.current.deselectAllVisible('mcq', [makeItem('1'), makeItem('2')]) })

      expect(hook.result.current.selectedItems).toHaveLength(0)
    })

    it('does NOT deselect hidden (non-visible) items', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('hidden')) })
      act(() => { hook.result.current.selectAllVisible('mcq', [makeItem('visible')]) })
      act(() => { hook.result.current.deselectAllVisible('mcq', [makeItem('visible')]) })

      expect(hook.result.current.isSelected('mcq', 'hidden')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })

    it('accepts items with contentId', () => {
      act(() => { hook.result.current.toggleOne('cq', makeItem('1')) })
      act(() => { hook.result.current.deselectAllVisible('cq', [{ contentId: '1' }]) })
      expect(hook.result.current.isSelected('cq', '1')).toBe(false)
    })
  })

  describe('invertSelection', () => {
    it('selects unselected items and deselects selected ones', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) }) // selected
      act(() => {
        hook.result.current.invertSelection('mcq', [
          makeItem('1'),  // was selected → deselected
          makeItem('2'),  // was not selected → selected
          makeItem('3'),  // was not selected → selected
        ])
      })

      expect(hook.result.current.isSelected('mcq', '1')).toBe(false)
      expect(hook.result.current.isSelected('mcq', '2')).toBe(true)
      expect(hook.result.current.isSelected('mcq', '3')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(2)
    })

    it('does not affect items not in the visible list', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('hidden')) })
      act(() => { hook.result.current.invertSelection('mcq', [makeItem('visible')]) })

      expect(hook.result.current.isSelected('mcq', 'hidden')).toBe(true)
    })
  })

  // ── Clear operations ───────────────────────────────────────────

  describe('clearAll', () => {
    it('removes all selections across all types', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('lecture', makeItem('l1')) })

      act(() => { hook.result.current.clearAll() })

      expect(hook.result.current.selectedItems).toHaveLength(0)
      expect(hook.result.current.summary.totalItems).toBe(0)
    })
  })

  describe('clearType', () => {
    it('removes all selections of a specific content type', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('2')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('1')) })

      act(() => { hook.result.current.clearType('mcq') })

      expect(hook.result.current.isSelected('mcq', '1')).toBe(false)
      expect(hook.result.current.isSelected('mcq', '2')).toBe(false)
      expect(hook.result.current.isSelected('cq', '1')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })

    it('does nothing if type has no selections', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.clearType('exam') })
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })
  })

  // ── replaceSelection ───────────────────────────────────────────

  describe('replaceSelection (edit flow)', () => {
    it('replaces all selections with the given items', () => {
      const items: SelectedContentItem[] = [
        makeSelectedItem('mcq', '1', { title: 'MCQ 1', price: 100, order: 0 }),
        makeSelectedItem('mcq', '2', { title: 'MCQ 2', price: 50, order: 1 }),
      ]

      act(() => { hook.result.current.replaceSelection(items) })

      expect(hook.result.current.selectedItems).toHaveLength(2)
      expect(hook.result.current.isSelected('mcq', '1')).toBe(true)
      expect(hook.result.current.isSelected('mcq', '2')).toBe(true)
    })

    it('clears previous selections first', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('old')) })
      act(() => { hook.result.current.replaceSelection([makeSelectedItem('cq', 'new')]) })

      expect(hook.result.current.isSelected('mcq', 'old')).toBe(false)
      expect(hook.result.current.isSelected('cq', 'new')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(1)
    })

    it('preserves the input array order', () => {
      // replaceSelection assigns order: map.size at insertion time,
      // so items appear in the same order as the input array
      const items: SelectedContentItem[] = [
        makeSelectedItem('cq', '3', { order: 2 }),
        makeSelectedItem('mcq', '1', { order: 0 }),
        makeSelectedItem('mcq', '2', { order: 1 }),
      ]
      act(() => { hook.result.current.replaceSelection(items) })

      const ordered = hook.result.current.selectedItems
      expect(ordered).toHaveLength(3)
      expect(ordered[0].contentId).toBe('3')
      expect(ordered[1].contentId).toBe('1')
      expect(ordered[2].contentId).toBe('2')
    })
  })

  // ── selectAllFiltered (cross-pagination) ───────────────────────

  describe('selectAllFiltered', () => {
    it('selects items returned by fetchAllIds callback', async () => {
      const fetchAllIds = vi.fn().mockResolvedValue(['a', 'b', 'c'])
      const getItemMeta = vi.fn().mockImplementation((id: string) => ({
        title: `Item ${id}`,
        price: 10,
      }))

      let added = 0
      await act(async () => {
        added = await hook.result.current.selectAllFiltered('mcq', fetchAllIds, getItemMeta)
      })

      expect(added).toBe(3)
      expect(hook.result.current.isSelected('mcq', 'a')).toBe(true)
      expect(hook.result.current.isSelected('mcq', 'b')).toBe(true)
      expect(hook.result.current.isSelected('mcq', 'c')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(3)
    })

    it('does NOT add already-selected items', async () => {
      const fetchAllIds = vi.fn().mockResolvedValue(['a', 'b'])
      const getItemMeta = vi.fn().mockReturnValue({ title: 'test', price: 10 })

      // Both operations in one act block so React flushes state together
      await act(async () => {
        hook.result.current.toggleOne('mcq', makeItem('a'))
        await hook.result.current.selectAllFiltered('mcq', fetchAllIds, getItemMeta)
      })

      // 'a' was already selected, only 'b' should be newly added
      expect(hook.result.current.isSelected('mcq', 'a')).toBe(true)
      expect(hook.result.current.isSelected('mcq', 'b')).toBe(true)
      expect(hook.result.current.selectedItems).toHaveLength(2)
    })

    it('returns 0 when fetchAllIds returns empty', async () => {
      const fetchAllIds = vi.fn().mockResolvedValue([])
      const getItemMeta = vi.fn()

      let added = 0
      await act(async () => {
        added = await hook.result.current.selectAllFiltered('mcq', fetchAllIds, getItemMeta)
      })

      expect(added).toBe(0)
      expect(fetchAllIds).toHaveBeenCalledOnce()
      expect(getItemMeta).not.toHaveBeenCalled()
    })
  })

  // ── getVisibleState ────────────────────────────────────────────

  describe('getVisibleState', () => {
    it('returns noneSelected=true when no items visible', () => {
      const state = hook.result.current.getVisibleState('mcq', [])
      expect(state).toEqual({
        allSelected: false,
        someSelected: false,
        noneSelected: true,
        selectedCount: 0,
        totalCount: 0,
      })
    })

    it('returns allSelected=true when all visible items are selected', () => {
      act(() => { hook.result.current.selectAllVisible('mcq', [makeItem('1'), makeItem('2')]) })

      const state = hook.result.current.getVisibleState('mcq', [makeItem('1'), makeItem('2')])
      expect(state.allSelected).toBe(true)
      expect(state.someSelected).toBe(false)
      expect(state.noneSelected).toBe(false)
      expect(state.selectedCount).toBe(2)
      expect(state.totalCount).toBe(2)
    })

    it('returns noneSelected=true when no visible items are selected', () => {
      const state = hook.result.current.getVisibleState('mcq', [makeItem('1'), makeItem('2')])
      expect(state.allSelected).toBe(false)
      expect(state.someSelected).toBe(false)
      expect(state.noneSelected).toBe(true)
      expect(state.selectedCount).toBe(0)
      expect(state.totalCount).toBe(2)
    })

    it('returns someSelected=true when some (not all) visible items are selected', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })

      const state = hook.result.current.getVisibleState('mcq', [makeItem('1'), makeItem('2')])
      expect(state.allSelected).toBe(false)
      expect(state.someSelected).toBe(true)
      expect(state.noneSelected).toBe(false)
      expect(state.selectedCount).toBe(1)
      expect(state.totalCount).toBe(2)
    })

    it('ignores hidden items (items not in visible list)', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('hidden')) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('visible')) })

      const state = hook.result.current.getVisibleState('mcq', [makeItem('visible')])
      expect(state.allSelected).toBe(true)
      expect(state.selectedCount).toBe(1)
      expect(state.totalCount).toBe(1)
    })
  })

  // ── Selection summary ──────────────────────────────────────────

  describe('summary', () => {
    it('reports by-type counts', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('2')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('lecture', makeItem('l1')) })

      const { summary } = hook.result.current
      expect(summary.byType).toEqual({ mcq: 2, cq: 1, lecture: 1 })
      expect(summary.totalItems).toBe(4)
    })

    it('calculates totalPrice correctly', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1', 'MCQ 1', 100)) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('2', 'MCQ 2', 50)) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('1', 'CQ 1', 200)) })

      expect(hook.result.current.summary.totalPrice).toBe(350)
    })

    it('handles items with no price', () => {
      act(() => { hook.result.current.toggleOne('mcq', { id: '1' }) }) // no price

      expect(hook.result.current.summary.totalPrice).toBe(0)
    })

    it('updates after item removal', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1', '', 100)) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('2', '', 50)) })
      expect(hook.result.current.summary.totalItems).toBe(2)

      act(() => { hook.result.current.removeItem('mcq', '1') })
      expect(hook.result.current.summary.totalItems).toBe(1)
      expect(hook.result.current.summary.totalPrice).toBe(50)
    })

    it('returns empty byType when no selections', () => {
      expect(hook.result.current.summary.byType).toEqual({})
      expect(hook.result.current.summary.totalItems).toBe(0)
      expect(hook.result.current.summary.totalPrice).toBe(0)
    })
  })

  // ── Composite key edge cases ───────────────────────────────────

  describe('composite keys', () => {
    it('handles special characters in IDs', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('id-with-dashes')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('id_with_underscores')) })
      act(() => { hook.result.current.toggleOne('lecture', makeItem('id.with.dots')) })

      expect(hook.result.current.isSelected('mcq', 'id-with-dashes')).toBe(true)
      expect(hook.result.current.isSelected('cq', 'id_with_underscores')).toBe(true)
      expect(hook.result.current.isSelected('lecture', 'id.with.dots')).toBe(true)
    })
  })

  // ── selectedItems ordering ─────────────────────────────────────

  describe('selectedItems ordering', () => {
    it('maintains insertion order', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('c')) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('a')) })
      act(() => { hook.result.current.toggleOne('mcq', makeItem('b')) })

      const ids = hook.result.current.selectedItems.map((i) => i.contentId)
      expect(ids).toEqual(['c', 'a', 'b'])
    })

    it('batch selectAllVisible assigns sequential order', () => {
      act(() => {
        hook.result.current.selectAllVisible('mcq', [
          makeItem('z'),
          makeItem('y'),
          makeItem('x'),
        ])
      })

      const ids = hook.result.current.selectedItems.map((i) => i.contentId)
      expect(ids).toEqual(['z', 'y', 'x'])
    })
  })

  // ── compositeKeys ──────────────────────────────────────────────

  describe('compositeKeys', () => {
    it('returns a Set of composite keys', () => {
      act(() => { hook.result.current.toggleOne('mcq', makeItem('1')) })
      act(() => { hook.result.current.toggleOne('cq', makeItem('1')) })

      const keys = hook.result.current.compositeKeys
      expect(keys.has('mcq:1')).toBe(true)
      expect(keys.has('cq:1')).toBe(true)
      expect(keys.size).toBe(2)
    })
  })
})
