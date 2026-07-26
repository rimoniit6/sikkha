import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    cQExamPackagePurchase: { findUnique: vi.fn() },
    mCQExamPackagePurchase: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/course-access-resolver', () => ({
  resolveCourseLayerAccess: vi.fn(),
}))

import { validateExamAccess } from '../access'
import { db } from '@/lib/db'
import { resolveCourseLayerAccess } from '@/lib/course-access-resolver'

describe('validateExamAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns hasAccess=true with direct_purchase source when active CQ purchase exists', async () => {
    vi.mocked(db.cQExamPackagePurchase.findUnique).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      packageId: 'pkg1',
      isActive: true,
    } as any)

    const result = await validateExamAccess('u1', 'pkg1', 'cq')

    expect(result.hasAccess).toBe(true)
    expect(result).toEqual({
      hasAccess: true,
      purchaseId: 'p1',
      accessSource: 'direct_purchase',
    })
  })

  it('returns hasAccess=true with direct_purchase source when active MCQ purchase exists', async () => {
    vi.mocked(db.mCQExamPackagePurchase.findUnique).mockResolvedValue({
      id: 'p2',
      userId: 'u1',
      packageId: 'pkg2',
      isActive: true,
    } as any)

    const result = await validateExamAccess('u1', 'pkg2', 'mcq')

    expect(result.hasAccess).toBe(true)
    expect(result).toEqual({
      hasAccess: true,
      purchaseId: 'p2',
      accessSource: 'direct_purchase',
    })
  })

  it('falls through to course access when CQ purchase is inactive', async () => {
    vi.mocked(db.cQExamPackagePurchase.findUnique).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      packageId: 'pkg1',
      isActive: false,
    } as any)
    vi.mocked(resolveCourseLayerAccess).mockResolvedValue({ hasAccess: true, source: 'course' })

    const result = await validateExamAccess('u1', 'pkg1', 'cq')

    expect(result.hasAccess).toBe(true)
    expect(result).toEqual({
      hasAccess: true,
      purchaseId: null,
      accessSource: 'course',
    })
    expect(resolveCourseLayerAccess).toHaveBeenCalledWith('u1', 'cq-exam-package', 'pkg1')
  })

  it('falls through to course access when no CQ purchase exists', async () => {
    vi.mocked(db.cQExamPackagePurchase.findUnique).mockResolvedValue(null)
    vi.mocked(resolveCourseLayerAccess).mockResolvedValue({ hasAccess: true, source: 'course' })

    const result = await validateExamAccess('u1', 'pkg1', 'cq')

    expect(result.hasAccess).toBe(true)
    expect(result).toEqual({
      hasAccess: true,
      purchaseId: null,
      accessSource: 'course',
    })
    expect(resolveCourseLayerAccess).toHaveBeenCalledWith('u1', 'cq-exam-package', 'pkg1')
  })

  it('returns hasAccess=false when no MCQ purchase and no course access', async () => {
    vi.mocked(db.mCQExamPackagePurchase.findUnique).mockResolvedValue(null)
    vi.mocked(resolveCourseLayerAccess).mockResolvedValue({ hasAccess: false, source: null })

    const result = await validateExamAccess('u1', 'pkg1', 'mcq')

    expect(result.hasAccess).toBe(false)
    expect(result).toEqual({ hasAccess: false, accessSource: 'none' })
    expect(resolveCourseLayerAccess).toHaveBeenCalledWith('u1', 'mcq-exam-package', 'pkg1')
  })

  it('returns hasAccess=false when no CQ purchase and no course access', async () => {
    vi.mocked(db.cQExamPackagePurchase.findUnique).mockResolvedValue(null)
    vi.mocked(resolveCourseLayerAccess).mockResolvedValue({ hasAccess: false, source: null })

    const result = await validateExamAccess('u1', 'pkg1', 'cq')

    expect(result.hasAccess).toBe(false)
    expect(result).toEqual({ hasAccess: false, accessSource: 'none' })
  })
})
