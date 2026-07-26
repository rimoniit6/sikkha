import { PrismaClient } from '@prisma/client'

// ─── Email Provider Abstraction ───

export interface EmailProvider {
  send: (params: {
    to: string
    subject: string
    html: string
  }) => Promise<{ success: boolean; error?: string }>
}

export interface NotificationOptions {
  emailProvider?: EmailProvider
}

// ─── Bengali Labels ───

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'খসড়া',
  IN_REVIEW: 'পর্যালোচনায়',
  APPROVED: 'অনুমোদিত',
  REJECTED: 'প্রত্যাখ্যাত',
  SCHEDULED: 'সময়নির্ধারিত',
  PUBLISHED: 'প্রকাশিত',
  ARCHIVED: 'সংরক্ষিত',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  lecture: 'লেকচার',
  mcq: 'এমসিকিউ',
  cq: 'সিকিউ',
  course: 'কোর্স',
  note: 'নোট',
}

// ─── In-App Notification ───

export interface InAppNotification {
  userId: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  link?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  category?: string
}

/**
 * Creates in-app notification(s) in the database.
 * This is the ONLY notification mechanism that is guaranteed to work.
 * Email is optional and best-effort.
 */
export async function createInAppNotification(
  db: PrismaClient,
  notification: InAppNotification
): Promise<{ id: string }> {
  const created = await db.notification.create({
    data: {
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority || 'medium',
      category: notification.category || null,
      link: notification.link || null,
    },
  })
  return { id: created.id }
}

/**
 * Creates in-app notifications for multiple users (broadcast).
 */
export async function createBroadcastNotification(
  db: PrismaClient,
  notification: Omit<InAppNotification, 'userId'>
): Promise<{ count: number }> {
  const users = await db.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true },
  })

  if (users.length === 0) return { count: 0 }

  const result = await db.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority || 'medium',
      category: notification.category || null,
      link: notification.link || null,
    })),
  })

  return { count: result.count }
}

// ─── Email Notification (Best-Effort) ───

/**
 * Sends email notification if provider is configured.
 * Returns `{ skipped: true }` if no provider — this is NOT an error.
 */
export async function sendEmailNotification(
  provider: EmailProvider | undefined,
  params: {
    to: string
    subject: string
    html: string
  }
): Promise<{ sent: boolean; skipped: boolean; error: string | undefined }> {
  if (!provider) {
    return { sent: false, skipped: true, error: undefined }
  }

  try {
    const result = await provider.send(params)
    return { sent: result.success, skipped: false, error: result.error }
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    }
  }
}

// ─── Workflow State Change Dispatch ───

export interface WorkflowNotificationContext {
  entityType: string
  entityId: string
  fromStatus: string
  toStatus: string
  contentTitle?: string
  userId?: string // content owner (for targeted notification)
  performedBy?: string // admin who made the change
  reason?: string // comment/reason for transition
}

/**
 * Dispatches notifications for a workflow state change.
 *
 * Rules:
 * - NEVER rolls back the workflow on notification failure
 * - In-app notification is always created
 * - Email is best-effort (skipped if no provider)
 * - Different notification types based on status transitions
 */
export async function dispatchWorkflowNotifications(
  db: PrismaClient,
  context: WorkflowNotificationContext,
  options?: NotificationOptions
): Promise<{
  inApp: { sent: boolean; id?: string }
  email: { sent: boolean; skipped: boolean; error: string | undefined }
}> {
  const { entityType, entityId, fromStatus, toStatus, contentTitle, userId, reason } = context
  const contentType = CONTENT_TYPE_LABELS[entityType] || entityType
  const title = contentTitle || `${contentType} #${entityId.slice(0, 8)}`
  const fromLabel = STATUS_LABELS[fromStatus] || fromStatus
  const toLabel = STATUS_LABELS[toStatus] || toStatus

  // Build notification content based on transition
  const notificationContent = buildNotificationContent(
    contentType,
    title,
    fromLabel,
    toLabel,
    reason
  )

  // 1. In-app notification (always, for content owner)
  let inAppResult = { sent: false, id: undefined as string | undefined }
  if (userId) {
    try {
      const result = await createInAppNotification(db, {
        userId,
        title: notificationContent.title,
        message: notificationContent.message,
        type: notificationContent.type,
        link: `/admin/workflow/${entityType}/${entityId}`,
      })
      inAppResult = { sent: true, id: result.id }
    } catch {
      // In-app notification failed — log but don't throw
      // Workflow is NOT rolled back
    }
  }

  // 2. Email notification (best-effort)
  let emailResult = { sent: false, skipped: true, error: undefined as string | undefined }
  if (userId && options?.emailProvider) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (user?.email) {
      emailResult = await sendEmailNotification(options.emailProvider, {
        to: user.email,
        subject: notificationContent.emailSubject,
        html: notificationContent.emailHtml(user.name || ''),
      })
    }
  }

  return {
    inApp: inAppResult,
    email: emailResult,
  }
}

// ─── Notification Content Builder ───

interface NotificationContent {
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  emailSubject: string
  emailHtml: (userName: string) => string
}

function buildNotificationContent(
  contentType: string,
  title: string,
  fromLabel: string,
  toLabel: string,
  reason?: string
): NotificationContent {
  // Determine notification type based on target status
  let type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO'
  if (toLabel === 'প্রকাশিত') type = 'SUCCESS'
  else if (toLabel === 'প্রত্যাখ্যাত') type = 'WARNING'
  else if (toLabel === 'সংরক্ষিত') type = 'ERROR'

  const titleText = `${contentType} আপডেট`
  const messageText = reason
    ? `"${title}" ${fromLabel} থেকে ${toLabel} এ পরিবর্তন করা হয়েছে। কারণ: ${reason}`
    : `"${title}" ${fromLabel} থেকে ${toLabel} এ পরিবর্তন করা হয়েছে।`

  return {
    title: titleText,
    message: messageText,
    type,
    emailSubject: `[শিক্ষা বাংলা] ${titleText}`,
    emailHtml: (userName: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${titleText}</h2>
        <p>প্রিয় ${userName},</p>
        <p>${messageText}</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://shikhaboro.com'}/admin/workflow/${contentType}/${title}"
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            দেখুন
          </a>
        </p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">এটি শিক্ষা বাংলা থেকে একটি স্বয়ংক্রিয় বার্তা।</p>
      </div>
    `,
  }
}
