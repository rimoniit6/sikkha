import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock DB Setup ───

interface MockNotification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  isRead: boolean
  link: string | null
  createdAt: Date
}

interface MockUser {
  id: string
  name: string
  email: string
  role: string
}

function createMockDb() {
  const notifications: MockNotification[] = []
  const users: MockUser[] = []
  let notifCounter = 0

  return {
    notification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        notifCounter++
        const notif: MockNotification = {
          id: `notif-${notifCounter}`,
          userId: (data.userId as string) || '',
          title: data.title as string,
          message: data.message as string,
          type: (data.type as string) || 'INFO',
          isRead: false,
          link: (data.link as string) || null,
          createdAt: new Date(),
        }
        notifications.push(notif)
        return notif
      }),
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        const count = data.length
        for (const item of data) {
          notifCounter++
          notifications.push({
            id: `notif-${notifCounter}`,
            userId: item.userId as string,
            title: item.title as string,
            message: item.message as string,
            type: (item.type as string) || 'INFO',
            isRead: false,
            link: (item.link as string) || null,
            createdAt: new Date(),
          })
        }
        return { count }
      }),
    },
    user: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return users.filter((u) => !where.role || u.role === where.role)
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return users.find((u) => u.id === where.id) || null
      }),
    },
    _notifications: notifications,
    _users: users,
    _addUser: (user: MockUser) => users.push(user),
  }
}

// ─── Imports ───

import {
  createInAppNotification,
  createBroadcastNotification,
  sendEmailNotification,
  dispatchWorkflowNotifications,
} from '../notification-service'

// ─── Tests ───

describe('createInAppNotification', () => {
  let db: ReturnType<typeof createMockDb>

  beforeEach(() => {
    db = createMockDb()
  })

  it('creates a notification for a specific user', async () => {
    const result = await createInAppNotification(db as any, {
      userId: 'user-1',
      title: 'Test Title',
      message: 'Test Message',
      type: 'INFO',
    })

    expect(result.id).toBeDefined()
    expect(db.notification.create).toHaveBeenCalledTimes(1)
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'Test Title',
        message: 'Test Message',
        type: 'INFO',
        priority: 'medium',
        category: null,
        link: null,
      },
    })
  })

  it('creates a notification with link', async () => {
    const result = await createInAppNotification(db as any, {
      userId: 'user-1',
      title: 'Test',
      message: 'Test',
      type: 'SUCCESS',
      link: '/admin/workflow/lecture/lec-1',
    })

    expect(result.id).toBeDefined()
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'Test',
        message: 'Test',
        type: 'SUCCESS',
        priority: 'medium',
        category: null,
        link: '/admin/workflow/lecture/lec-1',
      },
    })
  })
})

describe('createBroadcastNotification', () => {
  let db: ReturnType<typeof createMockDb>

  beforeEach(() => {
    db = createMockDb()
    db._addUser({ id: 'user-1', name: 'Student 1', email: 's1@test.com', role: 'STUDENT' })
    db._addUser({ id: 'user-2', name: 'Student 2', email: 's2@test.com', role: 'STUDENT' })
    db._addUser({ id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'SUPER_ADMIN' })
  })

  it('creates notifications for all students', async () => {
    const result = await createBroadcastNotification(db as any, {
      title: 'Broadcast',
      message: 'Hello everyone',
      type: 'INFO',
    })

    expect(result.count).toBe(2) // Only STUDENTs
    expect(db.notification.createMany).toHaveBeenCalledTimes(1)
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: 'STUDENT' },
      select: { id: true },
    })
  })

  it('returns 0 when no students exist', async () => {
    db._users.length = 0
    const result = await createBroadcastNotification(db as any, {
      title: 'Broadcast',
      message: 'Hello',
      type: 'INFO',
    })

    expect(result.count).toBe(0)
  })
})

describe('sendEmailNotification', () => {
  it('returns skipped when no provider', async () => {
    const result = await sendEmailNotification(undefined, {
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })

    expect(result.skipped).toBe(true)
    expect(result.sent).toBe(false)
  })

  it('sends email when provider is configured', async () => {
    const mockProvider = {
      send: vi.fn(async () => ({ success: true })),
    }

    const result = await sendEmailNotification(mockProvider, {
      to: 'test@test.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    })

    expect(result.sent).toBe(true)
    expect(result.skipped).toBe(false)
    expect(mockProvider.send).toHaveBeenCalledWith({
      to: 'test@test.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    })
  })

  it('returns error when provider fails', async () => {
    const mockProvider = {
      send: vi.fn(async () => ({ success: false, error: 'SMTP error' })),
    }

    const result = await sendEmailNotification(mockProvider, {
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('SMTP error')
  })

  it('catches provider exceptions', async () => {
    const mockProvider = {
      send: vi.fn(async () => {
        throw new Error('Network error')
      }),
    }

    const result = await sendEmailNotification(mockProvider, {
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('dispatchWorkflowNotifications', () => {
  let db: ReturnType<typeof createMockDb>

  beforeEach(() => {
    db = createMockDb()
    db._addUser({ id: 'user-1', name: 'Student 1', email: 's1@test.com', role: 'STUDENT' })
  })

  it('creates in-app notification for content owner', async () => {
    const result = await dispatchWorkflowNotifications(
      db as any,
      {
        entityType: 'lecture',
        entityId: 'lec-1',
        fromStatus: 'DRAFT',
        toStatus: 'PUBLISHED',
        contentTitle: 'Test Lecture',
        userId: 'user-1',
      }
    )

    expect(result.inApp.sent).toBe(true)
    expect(result.inApp.id).toBeDefined()
    expect(result.email.skipped).toBe(true) // No provider
    expect(db.notification.create).toHaveBeenCalledTimes(1)
    // Verify priority defaults to medium for workflow notifications
    const createCall = db.notification.create.mock.calls[0][0]
    expect(createCall.data.priority).toBe('medium')
  })

  it('skips in-app notification when no userId', async () => {
    const result = await dispatchWorkflowNotifications(
      db as any,
      {
        entityType: 'lecture',
        entityId: 'lec-1',
        fromStatus: 'DRAFT',
        toStatus: 'IN_REVIEW',
      }
    )

    expect(result.inApp.sent).toBe(false)
    expect(result.email.skipped).toBe(true)
  })

  it('sends email when provider is configured', async () => {
    const mockProvider = {
      send: vi.fn(async () => ({ success: true })),
    }

    const result = await dispatchWorkflowNotifications(
      db as any,
      {
        entityType: 'mcq',
        entityId: 'mcq-1',
        fromStatus: 'APPROVED',
        toStatus: 'PUBLISHED',
        contentTitle: 'Test MCQ',
        userId: 'user-1',
      },
      { emailProvider: mockProvider }
    )

    expect(result.inApp.sent).toBe(true)
    expect(result.email.sent).toBe(true)
    expect(result.email.skipped).toBe(false)
    expect(mockProvider.send).toHaveBeenCalledTimes(1)
  })

  it('includes reason in notification message', async () => {
    await dispatchWorkflowNotifications(
      db as any,
      {
        entityType: 'lecture',
        entityId: 'lec-1',
        fromStatus: 'IN_REVIEW',
        toStatus: 'REJECTED',
        contentTitle: 'Test Lecture',
        userId: 'user-1',
        reason: 'Content needs more examples',
      }
    )

    const createCall = db.notification.create.mock.calls[0][0]
    expect(createCall.data.message).toContain('কারণ: Content needs more examples')
  })

  it('never throws on notification failure', async () => {
    // Make notification.create throw
    db.notification.create.mockRejectedValueOnce(new Error('DB error'))

    const result = await dispatchWorkflowNotifications(
      db as any,
      {
        entityType: 'lecture',
        entityId: 'lec-1',
        fromStatus: 'DRAFT',
        toStatus: 'PUBLISHED',
        contentTitle: 'Test',
        userId: 'user-1',
      }
    )

    // Should not throw, in-app failed gracefully
    expect(result.inApp.sent).toBe(false)
    expect(result.email.skipped).toBe(true)
  })

  it('sets correct notification type based on status', async () => {
    // PUBLISHED → SUCCESS
    await dispatchWorkflowNotifications(db as any, {
      entityType: 'lecture',
      entityId: 'lec-1',
      fromStatus: 'APPROVED',
      toStatus: 'PUBLISHED',
      userId: 'user-1',
    })
    expect(db.notification.create.mock.calls[0][0].data.type).toBe('SUCCESS')
    expect(db.notification.create.mock.calls[0][0].data.priority).toBe('medium')

    // REJECTED → WARNING
    db.notification.create.mockClear()
    await dispatchWorkflowNotifications(db as any, {
      entityType: 'lecture',
      entityId: 'lec-1',
      fromStatus: 'IN_REVIEW',
      toStatus: 'REJECTED',
      userId: 'user-1',
    })
    expect(db.notification.create.mock.calls[0][0].data.type).toBe('WARNING')
  })
})
