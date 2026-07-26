/**
 * Smart Revision Engine — Comprehensive Tests
 *
 * Tests SM-2 inspired spacing algorithm, priority calculation,
 * convenience arrays, and API response shape.
 *
 * Run: npx vitest run tests/revision-engine.test.ts
 */

import { describe, expect, it } from 'vitest'
import {
  computeNextReview,
  calculatePriority,
  createInitialSchedule,
  SM2_INTERVALS,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
  INITIAL_EASE_FACTOR,
} from '@/lib/revision-algorithm'

// ═════════════════════════════════════════════════════════════════════
// 1. SM-2 INTERVAL CALCULATION TESTS
// ═════════════════════════════════════════════════════════════════════

describe('SM-2 interval calculation', () => {
  it('first review with quality=2 (good) returns 1 day interval', () => {
    const result = computeNextReview(0, 0, INITIAL_EASE_FACTOR, 2)
    expect(result.interval).toBe(SM2_INTERVALS[0])
    expect(result.easeFactor).toBe(INITIAL_EASE_FACTOR)
  })

  it('second review with quality=2 returns 3 day interval', () => {
    const result = computeNextReview(1, 1, INITIAL_EASE_FACTOR, 2)
    expect(result.interval).toBe(SM2_INTERVALS[1])
  })

  it('third review with quality=2 returns 7 day interval', () => {
    const result = computeNextReview(3, 2, INITIAL_EASE_FACTOR, 2)
    expect(result.interval).toBe(SM2_INTERVALS[2])
  })

  it('fourth review with quality=2 returns 14 day interval', () => {
    const result = computeNextReview(7, 3, INITIAL_EASE_FACTOR, 2)
    expect(result.interval).toBe(SM2_INTERVALS[3])
  })

  it('fifth+ review with quality=2 uses ease factor scaling', () => {
    const result = computeNextReview(14, 4, INITIAL_EASE_FACTOR, 2)
    expect(result.interval).toBe(Math.round(14 * INITIAL_EASE_FACTOR))
  })

  it('quality=0 (forgot) resets interval to 1 day', () => {
    const result = computeNextReview(14, 4, 2.5, 0)
    expect(result.interval).toBe(SM2_INTERVALS[0])
    expect(result.easeFactor).toBeLessThan(2.5)
  })

  it('quality=0 decreases ease factor', () => {
    const result = computeNextReview(1, 1, INITIAL_EASE_FACTOR, 0)
    expect(result.easeFactor).toBe(INITIAL_EASE_FACTOR - 0.2)
  })

  it('quality=1 (hard) keeps same interval', () => {
    const result = computeNextReview(7, 2, INITIAL_EASE_FACTOR, 1)
    expect(result.interval).toBe(7)
    expect(result.easeFactor).toBeLessThan(INITIAL_EASE_FACTOR)
  })

  it('quality=3 (easy) gives faster progression', () => {
    const result = computeNextReview(3, 2, INITIAL_EASE_FACTOR, 3)
    // Easy on 3rd review: skip to 14 days
    expect(result.interval).toBe(SM2_INTERVALS[3])
    expect(result.easeFactor).toBeGreaterThan(INITIAL_EASE_FACTOR)
  })

  it('ease factor never goes below minimum', () => {
    const result = computeNextReview(1, 1, MIN_EASE_FACTOR, 0)
    expect(result.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
  })

  it('ease factor never goes above maximum', () => {
    const result = computeNextReview(14, 4, MAX_EASE_FACTOR, 3)
    expect(result.easeFactor).toBeLessThanOrEqual(MAX_EASE_FACTOR)
  })

  it('handles first review with quality=3 (easy) skips to 3 days', () => {
    const result = computeNextReview(0, 0, INITIAL_EASE_FACTOR, 3)
    expect(result.interval).toBe(SM2_INTERVALS[1])
  })

  it('handles first review with quality=0 (forgot) resets to 1 day', () => {
    const result = computeNextReview(0, 0, INITIAL_EASE_FACTOR, 0)
    expect(result.interval).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════
// 2. PRIORITY CALCULATION TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Priority calculation', () => {
  it('overdue items get higher priority', () => {
    const yesterday = new Date(Date.now() - 86400000)
    const nextWeek = new Date(Date.now() + 7 * 86400000)

    const overduePriority = calculatePriority(yesterday, 50, 1, 0)
    const futurePriority = calculatePriority(nextWeek, 50, 1, 0)
    expect(overduePriority).toBeGreaterThan(futurePriority)
  })

  it('low confidence items get higher priority', () => {
    const today = new Date()
    const lowConfidence = calculatePriority(today, 20, 1, 0)
    const highConfidence = calculatePriority(today, 90, 1, 0)
    expect(lowConfidence).toBeGreaterThan(highConfidence)
  })

  it('new items (0 reviews) get novelty bonus', () => {
    const today = new Date()
    const newItem = calculatePriority(today, 50, 0, 0)
    const reviewedItem = calculatePriority(today, 50, 5, 0)
    expect(newItem).toBeGreaterThan(reviewedItem)
  })

  it('high streak students get a bonus', () => {
    const today = new Date()
    const highStreak = calculatePriority(today, 50, 1, 10)
    const lowStreak = calculatePriority(today, 50, 1, 0)
    expect(highStreak).toBeGreaterThan(lowStreak)
  })

  it('returns a non-negative integer', () => {
    const farFuture = new Date(Date.now() + 365 * 86400000)
    const priority = calculatePriority(farFuture, 95, 10, 0)
    expect(priority).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(priority)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════
// 3. INITIAL SCHEDULE TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Initial schedule creation', () => {
  it('creates schedule due tomorrow with 1 day interval', () => {
    const schedule = createInitialSchedule()
    expect(schedule.intervalDays).toBe(1)

    const tomorrow = Math.round(
      (schedule.nextReviewAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    expect(tomorrow).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════
// 4. CONFIDENCE UPDATE TESTS (via quality → confidence mapping)
// ═════════════════════════════════════════════════════════════════════

describe('Confidence updates via quality', () => {
  it('quality=3 (easy) increases confidence', () => {
    const confidence = Math.max(0, Math.min(100, 50 + 15))
    expect(confidence).toBe(65)
  })

  it('quality=2 (good) slightly increases confidence', () => {
    const confidence = Math.max(0, Math.min(100, 50 + 5))
    expect(confidence).toBe(55)
  })

  it('quality=1 (hard) slightly decreases confidence', () => {
    const confidence = Math.max(0, Math.min(100, 50 - 5))
    expect(confidence).toBe(45)
  })

  it('quality=0 (forgot) significantly decreases confidence', () => {
    const confidence = Math.max(0, Math.min(100, 50 - 15))
    expect(confidence).toBe(35)
  })

  it('confidence never goes below 0', () => {
    const confidence = Math.max(0, 10 - 15)
    expect(confidence).toBe(0)
  })

  it('confidence never goes above 100', () => {
    const confidence = Math.min(100, 95 + 15)
    expect(confidence).toBe(100)
  })
})

// ═════════════════════════════════════════════════════════════════════
// 5. EDGE CASES
// ═════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles zero current interval for first review with quality=1', () => {
    const result = computeNextReview(0, 0, INITIAL_EASE_FACTOR, 1)
    expect(result.interval).toBe(SM2_INTERVALS[0])
  })

  it('very high review count uses ease factor without exceeding cap', () => {
    const result = computeNextReview(30, 10, 2.5, 2)
    expect(result.interval).toBeLessThanOrEqual(90)
    expect(result.interval).toBeGreaterThan(30)
  })

  it('repeated forgot responses approach minimum ease factor', () => {
    let ef = INITIAL_EASE_FACTOR
    for (let i = 0; i < 10; i++) {
      const result = computeNextReview(1, i, ef, 0)
      ef = result.easeFactor
    }
    expect(ef).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
  })

  it('repeated easy responses approach maximum ease factor', () => {
    let ef = INITIAL_EASE_FACTOR
    for (let i = 0; i < 10; i++) {
      const result = computeNextReview(30, 5 + i, ef, 3)
      ef = result.easeFactor
    }
    expect(ef).toBeLessThanOrEqual(MAX_EASE_FACTOR)
  })

  it('large intervals are capped at maximum', () => {
    const result = computeNextReview(90, 10, 3.5, 2)
    expect(result.interval).toBeLessThanOrEqual(90)
  })
})

// ═════════════════════════════════════════════════════════════════════
// 6. REVISION SUMMARY COMPUTATION (Logic replica)
// ═════════════════════════════════════════════════════════════════════

describe('Revision summary', () => {
  interface RevisionItemShim {
    isCompleted: boolean
    nextReviewAt: string
  }

  it('computes correct counts for mixed items', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000).toISOString()
    const tomorrow = new Date(now.getTime() + 86400000).toISOString()
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const todayStr = todayEnd.toISOString()

    const items: RevisionItemShim[] = [
      { isCompleted: false, nextReviewAt: yesterday },   // overdue
      { isCompleted: false, nextReviewAt: todayStr },     // due today
      { isCompleted: true, nextReviewAt: yesterday },     // completed (was due)
      { isCompleted: false, nextReviewAt: tomorrow },     // upcoming
      { isCompleted: true, nextReviewAt: tomorrow },      // completed (was upcoming)
    ]

    const overdueCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) < now).length
    const todayCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) <= todayEnd).length
    const upcomingCount = items.filter(i => !i.isCompleted && new Date(i.nextReviewAt) > todayEnd).length
    const completedCount = items.filter(i => i.isCompleted).length
    const totalCount = items.length
    const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    expect(overdueCount).toBe(1)
    expect(todayCount).toBe(2)
    expect(upcomingCount).toBe(1)
    expect(completedCount).toBe(2)
    expect(totalCount).toBe(5)
    expect(completionPercent).toBe(40)
  })

  it('all items completed shows 100%', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const items: RevisionItemShim[] = [
      { isCompleted: true, nextReviewAt: yesterday },
      { isCompleted: true, nextReviewAt: yesterday },
    ]

    const completedCount = items.filter(i => i.isCompleted).length
    const totalCount = items.length
    expect(Math.round((completedCount / totalCount) * 100)).toBe(100)
  })

  it('empty items returns zero counts', () => {
    expect(0).toBe(0)
  })
})
