/**
 * SM-2 Inspired Spaced Repetition Algorithm
 *
 * This implements a simplified SM-2 algorithm adapted for the revision engine.
 *
 * Core parameters:
 * - easeFactor: Starting at 2.5, adjusts based on performance quality
 * - interval: Grows by easeFactor after each successful review
 * - quality: User-assigned score (0=forgot, 1=hard, 2=good, 3=easy)
 *
 * Minimum intervals:
 *   Review 1: 1 day
 *   Review 2: 3 days
 *   Review 3: 7 days
 *   Review 4: 14 days
 *   Review 5+: 30 days (scaled by ease factor)
 *
 * Quality mapping:
 *   0 (forgot) → reset to interval 1, ease factor decreases
 *   1 (hard)   → interval stays, ease factor decreases slightly
 *   2 (good)   → interval grows normally
 *   3 (easy)   → interval grows faster, ease factor increases
 */

export const SM2_INTERVALS = [1, 3, 7, 14, 30] as const

export const MIN_EASE_FACTOR = 1.3
export const MAX_EASE_FACTOR = 3.5
export const INITIAL_EASE_FACTOR = 2.5

/**
 * Compute the next interval based on the SM-2 algorithm.
 *
 * @param currentInterval - Current interval in days (0 for first review)
 * @param reviewCount - Number of successful reviews so far
 * @param easeFactor - Current ease factor
 * @param quality - Performance quality: 0=forgot, 1=hard, 2=good, 3=easy
 * @returns { interval: number; easeFactor: number }
 */
export function computeNextReview(
  currentInterval: number,
  reviewCount: number,
  easeFactor: number,
  quality: 0 | 1 | 2 | 3,
): { interval: number; easeFactor: number } {
  let newEaseFactor = easeFactor
  let newInterval: number

  // Update ease factor based on quality
  if (quality === 0) {
    // Forgot — decrease ease factor, reset interval
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2)
    newInterval = SM2_INTERVALS[0] // Reset to 1 day
  } else if (quality === 1) {
    // Hard — slight ease decrease, repeat same interval
    newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15)
    newInterval = currentInterval > 0 ? currentInterval : SM2_INTERVALS[0]
  } else if (quality === 2) {
    // Good — normal progression
    newInterval = calculateNormalInterval(currentInterval, reviewCount, easeFactor)
  } else {
    // Easy — faster progression, increase ease factor
    newEaseFactor = Math.min(MAX_EASE_FACTOR, easeFactor + 0.15)
    newInterval = calculateEasyInterval(currentInterval, reviewCount, easeFactor)
  }

  return { interval: Math.round(newInterval), easeFactor: Math.round(newEaseFactor * 100) / 100 }
}

function calculateNormalInterval(currentInterval: number, reviewCount: number, easeFactor: number): number {
  if (reviewCount === 0 || currentInterval === 0) {
    return SM2_INTERVALS[0] // First review: 1 day
  }
  if (reviewCount === 1) {
    return SM2_INTERVALS[1] // Second review: 3 days
  }
  if (reviewCount === 2) {
    return SM2_INTERVALS[2] // Third review: 7 days
  }
  if (reviewCount === 3) {
    return SM2_INTERVALS[3] // Fourth review: 14 days
  }
  // Fifth+ review: multiply current interval by ease factor, capped at 90 days
  return Math.min(Math.round(currentInterval * easeFactor), 90)
}

function calculateEasyInterval(currentInterval: number, reviewCount: number, easeFactor: number): number {
  if (reviewCount === 0 || currentInterval === 0) {
    return SM2_INTERVALS[1] // Skip to 3 days
  }
  if (reviewCount === 1) {
    return SM2_INTERVALS[2] // Skip to 7 days
  }
  if (reviewCount === 2) {
    return SM2_INTERVALS[3] // Skip to 14 days
  }
  if (reviewCount === 3) {
    return SM2_INTERVALS[4] // Skip to 30 days
  }
  // Fifth+ review: faster growth
  return Math.min(Math.round(currentInterval * easeFactor * 1.3), 120)
}

/**
 * Calculate a priority score for a revision item.
 * Higher score = more urgent/important.
 *
 * Factors:
 * - Days overdue (exponential weight)
 * - Low confidence score (weakness priority)
 * - Fewer reviews (new items need attention)
 * - Learning streak bonus (active students get priority)
 */
export function calculatePriority(
  nextReviewAt: Date,
  confidenceScore: number,
  reviewCount: number,
  studyStreak: number,
): number {
  const now = new Date()
  const daysUntilDue = Math.round((nextReviewAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const daysOverdue = -daysUntilDue // Positive if overdue

  // Urgency: exponential penalty for overdue items
  let urgencyScore = 0
  if (daysOverdue > 0) {
    urgencyScore = Math.min(100, daysOverdue * 10) // 10 per day overdue, cap at 100
  } else {
    urgencyScore = Math.max(0, daysUntilDue * -2) // Small boost for items due soon
  }

  // Weakness: inverse of confidence (low confidence = more urgent)
  const weaknessScore = 100 - confidenceScore

  // Novelty: new items with fewer reviews need attention
  const noveltyScore = reviewCount === 0 ? 50 : Math.max(0, 30 - reviewCount * 5)

  // Streak bonus: active students get a small boost
  const streakBonus = Math.min(20, studyStreak * 2)

  return Math.round(urgencyScore * 0.4 + weaknessScore * 0.3 + noveltyScore * 0.2 + streakBonus * 0.1)
}

/**
 * Generate the initial revision schedule for a content item.
 */
export function createInitialSchedule(): { nextReviewAt: Date; intervalDays: number } {
  return {
    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
    intervalDays: 1,
  }
}
