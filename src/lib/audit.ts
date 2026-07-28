import { db } from '@/lib/db'
import { parseUserAgent } from '@/lib/user-agent-parser'
import logger from '@/lib/logger'
import { sanitizeAuditData } from './audit-pii'
import { computeAuditLogHash } from './audit-integrity'

// ─── Transaction Client Type ───

/**
 * Minimal Prisma transaction client type for audit log operations.
 * Enables createAuditLog to participate in $transaction calls.
 */
export interface AuditTxClient {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
    createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>
  }
}

// ─── Input Types ───

export interface AuditLogInput {
  adminId: string
  action: string
  entityType: string
  entityId: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  userName?: string
  userRole?: string
  status?: 'success' | 'failed' | 'pending'
  duration?: number
  country?: string
  sessionId?: string
  requestId?: string
  correlationId?: string
  /** Prisma transaction client — when provided, the audit log is created inside the transaction */
  tx?: AuditTxClient
}

export interface BatchAuditLogInput {
  adminId: string
  action: string
  entityType: string
  entries: Array<{
    entityId: string
    oldData?: Record<string, unknown>
    newData?: Record<string, unknown>
  }>
  ipAddress?: string
  userAgent?: string
  userName?: string
  userRole?: string
  status?: 'success' | 'failed' | 'pending'
  requestId?: string
  correlationId?: string
  /** Prisma transaction client — when provided, audit logs are created inside the transaction */
  tx?: AuditTxClient
}

// ─── Core Functions ───

/**
 * Create a single audit log entry.
 * Never throws — audit logging should never break the main operation.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    // Validate input — warns on unknown values, logs errors for missing fields
    validateAuditLogInput(input)

    // Parse user agent for OS/browser info
    const ua = input.userAgent || null
    const parsedUA = parseUserAgent(ua)

    // Use transaction client when provided, otherwise use global db
    const client = input.tx || db

    // Compute hash for tamper detection (from entry's own data — no race condition)
    const now = new Date()
    const hash = computeAuditLogHash({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      adminId: input.adminId,
      createdAt: now,
    })

    await client.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldData: input.oldData ? JSON.stringify(sanitizeAuditData(input.oldData)) : null,
        newData: input.newData ? JSON.stringify(sanitizeAuditData(input.newData)) : null,
        ipAddress: input.ipAddress || null,
        userAgent: ua,
        userName: input.userName || null,
        userRole: input.userRole || null,
        status: input.status || 'success',
        duration: input.duration || null,
        os: parsedUA.os,
        browser: parsedUA.browser,
        country: input.country || null,
        sessionId: input.sessionId || null,
        requestId: input.requestId || null,
        correlationId: input.correlationId || null,
        hash,
      },
    })
  } catch (error) {
    logger.error('Failed to create audit log', error, { context: 'audit' })
  }
}

/**
 * Create multiple audit log entries in a single batch.
 * More efficient than calling createAuditLog multiple times.
 */
export async function createBatchAuditLogs(input: BatchAuditLogInput): Promise<void> {
  try {
    // Parse user agent for OS/browser info
    const ua = input.userAgent || null
    const parsedUA = parseUserAgent(ua)

    // Use transaction client when provided, otherwise use global db
    const client = input.tx || db

    await client.auditLog.createMany({
      data: input.entries.map(entry => ({
        adminId: input.adminId,
        action: input.action,
        entityType: input.entityType,
        entityId: entry.entityId,
        oldData: entry.oldData ? JSON.stringify(sanitizeAuditData(entry.oldData)) : null,
        newData: entry.newData ? JSON.stringify(sanitizeAuditData(entry.newData)) : null,
        ipAddress: input.ipAddress || null,
        userAgent: ua,
        userName: input.userName || null,
        userRole: input.userRole || null,
        status: input.status || 'success',
        os: parsedUA.os,
        browser: parsedUA.browser,
        requestId: input.requestId || null,
        correlationId: input.correlationId || null,
      })),
    })
  } catch (error) {
    logger.error('Failed to create batch audit logs', error, { context: 'audit' })
  }
}

/**
 * Create audit log from request context.
 * Extracts IP and User-Agent from the request automatically.
 *
 * When called inside a Prisma $transaction, pass `tx` to ensure
 * the audit log participates in the same atomic transaction.
 */
export async function auditFromRequest(
  request: Request,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  /** Prisma transaction client — when provided, the audit log is created inside the transaction */
  tx?: AuditTxClient
): Promise<void> {
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || undefined

  // Try to get user info from request headers (set by auth middleware)
  const userName = request.headers.get('x-user-name') || undefined
  const userRole = request.headers.get('x-user-role') || undefined

  const requestId = request.headers.get('x-request-id') || undefined

  await createAuditLog({
    adminId,
    action,
    entityType,
    entityId,
    oldData,
    newData,
    ipAddress,
    userAgent,
    userName,
    userRole,
    requestId,
    tx,
  })
}

/**
 * Create batch audit logs from request context.
 *
 * When called inside a Prisma $transaction, pass `tx` to ensure
 * the audit logs participate in the same atomic transaction.
 */
export async function auditBatchFromRequest(
  request: Request,
  adminId: string,
  action: string,
  entityType: string,
  entries: BatchAuditLogInput['entries'],
  /** Prisma transaction client — when provided, the audit log is created inside the transaction */
  tx?: AuditTxClient
): Promise<void> {
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || undefined

  const requestId = request.headers.get('x-request-id') || undefined

  await createBatchAuditLogs({
    adminId,
    action,
    entityType,
    entries,
    ipAddress,
    userAgent,
    requestId,
    tx,
  })
}

// ─── Helper Functions ───

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return 'unknown'
}

// ─── Action Constants ───

export const AuditActions = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',

  // User self-service actions
  USER_REGISTER: 'user_register',
  USER_PROFILE_UPDATE: 'user_profile_update',
  USER_PASSWORD_RESET: 'user_password_reset',
  USER_PASSWORD_CHANGE: 'user_password_change',
  USER_AVATAR_UPDATE: 'user_avatar_update',
  USER_LEARNING_PREFERENCE_UPDATE: 'user_learning_preference_update',

  // Purchase actions (user-facing)
  PAYMENT_SUBMIT: 'payment_submit',
  PAYMENT_APPROVE: 'payment_approve',
  PAYMENT_REJECT: 'payment_reject',
  PAYMENT_REFUND: 'payment_refund',
  SUBSCRIPTION_PURCHASE: 'subscription_purchase',
  COURSE_PURCHASE: 'course_purchase',
  BUNDLE_PURCHASE: 'bundle_purchase',
  PACKAGE_PURCHASE: 'package_purchase',
  MCQ_EXAM_PACKAGE_PURCHASE: 'mcq_exam_package_purchase',
  CQ_EXAM_PACKAGE_PURCHASE: 'cq_exam_package_purchase',

  // Course actions
  COURSE_ENROLL: 'course_enroll',
  COURSE_COMPLETE: 'course_complete',
  COURSE_LESSON_COMPLETE: 'course_lesson_complete',
  COURSE_ASSIGNMENT_SUBMIT: 'course_assignment_submit',

  // Exam actions
  EXAM_START: 'exam_start',
  EXAM_SUBMIT: 'exam_submit',
  EXAM_RESULT_VIEW: 'exam_result_view',
  MCQ_EXAM_START: 'mcq_exam_start',
  MCQ_EXAM_SUBMIT: 'mcq_exam_submit',
  CQ_EXAM_SUBMIT: 'cq_exam_submit',

  // Content interaction
  CONTENT_VIEW: 'content_view',
  CONTENT_BOOKMARK: 'content_bookmark',
  CONTENT_UNBOOKMARK: 'content_unbookmark',
  NOTE_CREATE: 'note_create',
  NOTE_UPDATE: 'note_update',
  NOTE_DELETE: 'note_delete',

  // Feedback
  FEEDBACK_SUBMIT: 'feedback_submit',
  FEEDBACK_MESSAGE_SEND: 'feedback_message_send',

  // Contact
  CONTACT_MESSAGE_SEND: 'contact_message_send',

  // Search
  SEARCH_EXECUTE: 'search_execute',

  // Notification
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_MARK_ALL_READ: 'notification_mark_all_read',

  // Grade actions
  GRADE_UPDATE: 'grade_update',
  GRADE_BULK: 'grade_bulk',

  // User actions (admin)
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_BAN: 'user_ban',
  USER_UNBAN: 'user_unban',
  ROLE_CHANGE: 'role_change',

  // Retake actions
  RETAKE_APPROVE: 'retake_approve',
  RETAKE_REJECT: 'retake_reject',

  // Content actions
  CONTENT_CREATE: 'content_create',
  CONTENT_UPDATE: 'content_update',
  CONTENT_DELETE: 'content_delete',
  CONTENT_SOFT_DELETE: 'content_soft_delete',
  CONTENT_RESTORE: 'content_restore',
  CONTENT_FORCE_DELETE: 'content_force_delete',

  // Workflow transitions
  WORKFLOW_SUBMIT_FOR_REVIEW: 'workflow_submit_for_review',
  WORKFLOW_APPROVE: 'workflow_approve',
  WORKFLOW_REJECT: 'workflow_reject',
  WORKFLOW_PUBLISH: 'workflow_publish',
  WORKFLOW_SCHEDULE: 'workflow_schedule',
  WORKFLOW_ARCHIVE: 'workflow_archive',
  WORKFLOW_RESET_TO_DRAFT: 'workflow_reset_to_draft',

  // Bulk actions
  BULK_SOFT_DELETE: 'bulk_soft_delete',
  BULK_RESTORE: 'bulk_restore',
  BULK_FORCE_DELETE: 'bulk_force_delete',

  // Import/Export
  IMPORT: 'import',
  EXPORT: 'export',
  DATABASE_IMPORT: 'database_import',
  DATABASE_EXPORT: 'database_export',
  BULK_IMPORT: 'bulk_import',

  // Trash operations
  RESTORE: 'restore',
  FORCE_DELETE: 'force_delete',
  BULK_RESTORE_TRASH: 'bulk_restore_trash',
  BULK_FORCE_DELETE_TRASH: 'bulk_force_delete_trash',
  TRASH_CLEANUP: 'trash_cleanup',
  TRASH_CLEANUP_PREVIEW: 'trash_cleanup_preview',

  // Settings
  SETTINGS_UPDATE: 'settings_update',
  SETTINGS_CREATE: 'settings_create',
  SETTINGS_DELETE: 'settings_delete',
  SETTINGS_BATCH_UPDATE: 'settings_batch_update',

  // Permission actions
  PERMISSION_UPDATE: 'permission_update',
  PERMISSION_CREATE: 'permission_create',
  PERMISSION_DELETE: 'permission_delete',

  // Navigation
  NAVIGATION_CREATE: 'navigation_create',
  NAVIGATION_UPDATE: 'navigation_update',
  NAVIGATION_DELETE: 'navigation_delete',
  NAVIGATION_REORDER: 'navigation_reorder',
  NAVIGATION_SEED: 'navigation_seed',

  // Content type management
  CONTENT_TYPE_CREATE: 'content_type_create',
  CONTENT_TYPE_UPDATE: 'content_type_update',
  CONTENT_TYPE_DELETE: 'content_type_delete',

  // Board management
  BOARD_CREATE: 'board_create',
  BOARD_UPDATE: 'board_update',
  BOARD_DELETE: 'board_delete',

  // Year management
  YEAR_CREATE: 'year_create',
  YEAR_UPDATE: 'year_update',
  YEAR_DELETE: 'year_delete',

  // Board year management
  BOARD_YEAR_CREATE: 'board_year_create',
  BOARD_YEAR_UPDATE: 'board_year_update',
  BOARD_YEAR_DELETE: 'board_year_delete',

  // Hierarchy management
  CLASS_CREATE: 'class_create',
  CLASS_UPDATE: 'class_update',
  CLASS_DELETE: 'class_delete',
  SUBJECT_CREATE: 'subject_create',
  SUBJECT_UPDATE: 'subject_update',
  SUBJECT_DELETE: 'subject_delete',
  CHAPTER_CREATE: 'chapter_create',
  CHAPTER_UPDATE: 'chapter_update',
  CHAPTER_DELETE: 'chapter_delete',
  TOPIC_CREATE: 'topic_create',
  TOPIC_UPDATE: 'topic_update',
  TOPIC_DELETE: 'topic_delete',

  // Content management
  LECTURE_CREATE: 'lecture_create',
  LECTURE_UPDATE: 'lecture_update',
  LECTURE_DELETE: 'lecture_delete',
  MCQ_CREATE: 'mcq_create',
  MCQ_UPDATE: 'mcq_update',
  MCQ_DELETE: 'mcq_delete',
  CQ_CREATE: 'cq_create',
  CQ_UPDATE: 'cq_update',
  CQ_DELETE: 'cq_delete',
  KNOWLEDGE_CREATE: 'knowledge_create',
  KNOWLEDGE_UPDATE: 'knowledge_update',
  KNOWLEDGE_DELETE: 'knowledge_delete',
  SUGGESTION_CREATE: 'suggestion_create',
  SUGGESTION_UPDATE: 'suggestion_update',
  SUGGESTION_DELETE: 'suggestion_delete',

  // Course management
  COURSE_CREATE: 'course_create',
  COURSE_UPDATE: 'course_update',
  COURSE_DELETE: 'course_delete',
  COURSE_LESSON_CREATE: 'course_lesson_create',
  COURSE_LESSON_UPDATE: 'course_lesson_update',
  COURSE_LESSON_DELETE: 'course_lesson_delete',

  // Package management
  PACKAGE_CREATE: 'package_create',
  PACKAGE_UPDATE: 'package_update',
  PACKAGE_DELETE: 'package_delete',
  BUNDLE_CREATE: 'bundle_create',
  BUNDLE_UPDATE: 'bundle_update',
  BUNDLE_DELETE: 'bundle_delete',

  // Exam package management
  MCQ_EXAM_PACKAGE_CREATE: 'mcq_exam_package_create',
  MCQ_EXAM_PACKAGE_UPDATE: 'mcq_exam_package_update',
  MCQ_EXAM_PACKAGE_DELETE: 'mcq_exam_package_delete',
  MCQ_EXAM_SET_CREATE: 'mcq_exam_set_create',
  MCQ_EXAM_SET_UPDATE: 'mcq_exam_set_update',
  MCQ_EXAM_SET_DELETE: 'mcq_exam_set_delete',
  MCQ_EXAM_SET_QUESTIONS_ADD: 'mcq_exam_set_questions_add',
  MCQ_EXAM_SET_QUESTIONS_REMOVE: 'mcq_exam_set_questions_remove',
  CQ_EXAM_PACKAGE_CREATE: 'cq_exam_package_create',
  CQ_EXAM_PACKAGE_UPDATE: 'cq_exam_package_update',
  CQ_EXAM_PACKAGE_DELETE: 'cq_exam_package_delete',
  CQ_EXAM_SET_CREATE: 'cq_exam_set_create',
  CQ_EXAM_SET_UPDATE: 'cq_exam_set_update',
  CQ_EXAM_SET_DELETE: 'cq_exam_set_delete',
  CQ_EXAM_SET_QUESTIONS_ADD: 'cq_exam_set_questions_add',
  CQ_EXAM_SET_QUESTIONS_REMOVE: 'cq_exam_set_questions_remove',
  CQ_EXAM_SUBMISSION_GRADE: 'cq_exam_submission_grade',
  CQ_EXAM_BULK_GRADE: 'cq_exam_bulk_grade',
  CQ_EXAM_RESULTS_PUBLISH: 'cq_exam_results_publish',
  CQ_EXAM_GRADING_REOPEN: 'cq_exam_grading_reopen',
  CQ_EXAM_RETAKE_APPROVE: 'cq_exam_retake_approve',
  CQ_EXAM_QUESTION_UPDATE: 'cq_exam_question_update',
  CQ_EXAM_REORDER_QUESTIONS: 'cq_exam_reorder_questions',

  // CMS management
  BANNER_CREATE: 'banner_create',
  BANNER_UPDATE: 'banner_update',
  BANNER_DELETE: 'banner_delete',
  FAQ_CREATE: 'faq_create',
  FAQ_UPDATE: 'faq_update',
  FAQ_DELETE: 'faq_delete',
  TESTIMONIAL_CREATE: 'testimonial_create',
  TESTIMONIAL_UPDATE: 'testimonial_update',
  TESTIMONIAL_DELETE: 'testimonial_delete',
  NOTICE_CREATE: 'notice_create',
  NOTICE_UPDATE: 'notice_update',
  NOTICE_DELETE: 'notice_delete',

  // Featured content
  FEATURED_CREATE: 'featured_create',
  FEATURED_UPDATE: 'featured_update',
  FEATURED_DELETE: 'featured_delete',

  // Teacher management
  TEACHER_CREATE: 'teacher_create',
  TEACHER_UPDATE: 'teacher_update',
  TEACHER_DELETE: 'teacher_delete',

  // Notification management
  NOTIFICATION_CREATE: 'notification_create',
  NOTIFICATION_UPDATE: 'notification_update',
  NOTIFICATION_DELETE: 'notification_delete',

  // Exam management
  EXAM_CREATE: 'exam_create',
  EXAM_UPDATE: 'exam_update',
  EXAM_DELETE: 'exam_delete',

  // Subscription management
  SUBSCRIPTION_CREATE: 'subscription_create',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  SUBSCRIPTION_DELETE: 'subscription_delete',

  // Contact message management
  CONTACT_MESSAGE_READ: 'contact_message_read',
  CONTACT_MESSAGE_DELETE: 'contact_message_delete',

  // Feedback management
  FEEDBACK_UPDATE: 'feedback_update',

  // Blog management
  BLOG_CREATE: 'blog_create',
  BLOG_UPDATE: 'blog_update',
  BLOG_DELETE: 'blog_delete',
  BLOG_PUBLISH: 'blog_publish',
  BLOG_RESTORE: 'blog_restore',
  BLOG_CATEGORY_CREATE: 'blog_category_create',
  BLOG_CATEGORY_UPDATE: 'blog_category_update',
  BLOG_CATEGORY_DELETE: 'blog_category_delete',

  // Automation actions
  AUTOMATION_SOURCE_CREATE: 'automation_source_create',
  AUTOMATION_SOURCE_UPDATE: 'automation_source_update',
  AUTOMATION_SOURCE_DELETE: 'automation_source_delete',
  AUTOMATION_PROVIDER_CREATE: 'automation_provider_create',
  AUTOMATION_PROVIDER_UPDATE: 'automation_provider_update',
  AUTOMATION_PROVIDER_KEY_ROTATE: 'automation_provider_key_rotate',
  AUTOMATION_PROVIDER_DELETE: 'automation_provider_delete',
  AUTOMATION_PIPELINE_CREATE: 'automation_pipeline_create',
  AUTOMATION_PIPELINE_UPDATE: 'automation_pipeline_update',
  AUTOMATION_TEMPLATE_CREATE: 'automation_template_create',
  AUTOMATION_TEMPLATE_UPDATE: 'automation_template_update',
  AUTOMATION_RULE_CREATE: 'automation_rule_create',
  AUTOMATION_RULE_UPDATE: 'automation_rule_update',
  AUTOMATION_RULE_DELETE: 'automation_rule_delete',
  AUTOMATION_SETTING_CHANGE: 'automation_setting_change',
  AUTOMATION_CONTENT_CREATE: 'automation_content_create',
  AUTOMATION_REVIEW_APPROVE: 'automation_review_approve',
  AUTOMATION_REVIEW_REJECT: 'automation_review_reject',
  AUTOMATION_PUBLISH: 'automation_publish',
  AUTOMATION_PIPELINE_RUN: 'automation_pipeline_run',
  AUTOMATION_IMPORT: 'automation_import',
  AUTOMATION_RUN: 'automation_run',
  AUTOMATION_TEMPLATE_DELETE: 'automation_template_delete',
  AUTOMATION_SCHEDULE_CREATE: 'automation_schedule_create',
  AUTOMATION_SCHEDULE_CANCEL: 'automation_schedule_cancel',

  // Audit log
  AUDIT_LOG_VIEW: 'audit_log_view',
  AUDIT_LOG_EXPORT: 'audit_log_export',
} as const

// ─── Entity Type Constants ───

export const EntityTypes = {
  // Payment
  PAYMENT: 'payment',

  // User
  USER: 'user',

  // Content
  LECTURE: 'lecture',
  MCQ: 'mcq',
  CQ: 'cq',
  KNOWLEDGE_QUESTION: 'knowledge_question',
  SUGGESTION: 'suggestion',
  RESOURCE: 'resource',

  // Hierarchy
  CLASS_CATEGORY: 'class_category',
  SUBJECT: 'subject',
  CHAPTER: 'chapter',
  TOPIC: 'topic',

  // Course
  COURSE: 'course',
  COURSE_LESSON: 'course_lesson',
  COURSE_ASSIGNMENT: 'course_assignment',

  // Package
  CONTENT_PACKAGE: 'content_package',
  CONTENT_BUNDLE: 'content_bundle',
  BUNDLE_ITEM: 'bundle_item',

  // Exam
  EXAM: 'exam',
  EXAM_QUESTION: 'exam_question',
  EXAM_RESULT: 'exam_result',

  // Exam packages
  MCQ_EXAM_PACKAGE: 'mcq_exam_package',
  MCQ_EXAM_SET: 'mcq_exam_set',
  CQ_EXAM_PACKAGE: 'cq_exam_package',
  CQ_EXAM_SET: 'cq_exam_set',

  // CMS
  BANNER: 'banner',
  FAQ: 'faq',
  TESTIMONIAL: 'testimonial',
  NOTICE: 'notice',
  FEATURED_CONTENT: 'featured_content',
  TEACHER_MODERATOR: 'teacher_moderator',
  NAVIGATION: 'navigation',
  CONTENT_TYPE: 'content_type',

  // Board
  BOARD: 'board',
  EXAM_YEAR: 'exam_year',
  BOARD_YEAR: 'board_year',

  // Question entity types (aliases for existing types, used for audit context clarity)
  MCQ_QUESTION: 'mcq',
  CQ_QUESTION: 'cq',
  SUBMISSION: 'cq_exam_submission',

  // Blog
  BLOG_POST: 'blog_post',
  BLOG_CATEGORY: 'blog_category',
  BLOG_TAG: 'blog_tag',

  // Automation
  AUTOMATION_SOURCE: 'automation_source',
  AUTOMATION_PIPELINE_RUN: 'automation_pipeline_run',
  AUTOMATION_PIPELINE_STAGE: 'automation_pipeline_stage',
  AUTOMATION_PROVIDER: 'automation_provider',
  AUTOMATION_PROMPT_TEMPLATE: 'automation_prompt_template',
  AUTOMATION_PROMPT_VERSION: 'automation_prompt_version',
  AUTOMATION_RULE: 'automation_rule',
  AUTOMATION_REVIEW_TASK: 'automation_review_task',
  AUTOMATION_SCHEDULE: 'automation_schedule',
  AUTOMATION_MEDIA_ASSET: 'automation_media_asset',
  AUTOMATION_IMPORTED_CONTENT: 'automation_imported_content',
  AUTOMATION_SETTING: 'automation_setting',
  AUTOMATION_AI_REQUEST: 'automation_ai_request',
  AUTOMATION_OUTBOX: 'automation_outbox',
  AUTOMATION_SCHEDULER_JOB: 'automation_scheduler_job',

  // Other
  SUBSCRIPTION: 'subscription',
  NOTIFICATION: 'notification',
  NOTE: 'note',
  CONTACT_MESSAGE: 'contact_message',
  FEEDBACK: 'feedback',
  FEEDBACK_MESSAGE: 'feedback_message',
  SITE_SETTING: 'site_setting',
  PERMISSION: 'permission',
  ROLE_PERMISSION: 'role_permission',
  AUDIT_LOG: 'audit_log',
  DATABASE: 'database',
  TRASH: 'trash',
} as const

// ─── Validation ───

/** Union type of all valid AuditAction values. */
export type ValidAuditAction = typeof AuditActions[keyof typeof AuditActions]

/** Union type of all valid EntityType values. */
export type ValidEntityType = typeof EntityTypes[keyof typeof EntityTypes]

const VALID_ENTITY_TYPES = new Set<string>(Object.values(EntityTypes))
const VALID_ACTIONS = new Set<string>(Object.values(AuditActions))

/**
 * Validate the audit log input. Warns on unknown entityType/action,
 * logs errors for missing required fields.
 */
function validateAuditLogInput(input: AuditLogInput): void {
  if (input.entityType && !VALID_ENTITY_TYPES.has(input.entityType)) {
    logger.warn(`Unknown entityType "${input.entityType}". Use EntityTypes constants.`, { context: 'audit' })
  }
  if (input.action && !VALID_ACTIONS.has(input.action)) {
    logger.warn(`Unknown action "${input.action}". Use AuditActions constants.`, { context: 'audit' })
  }
  if (!input.action) {
    logger.error('Missing required field: action', { context: 'audit' })
  }
  if (!input.entityType) {
    logger.error('Missing required field: entityType', { context: 'audit' })
  }
  if (!input.entityId) {
    logger.error('Missing required field: entityId', { context: 'audit' })
  }
}

// ─── Action Display Names (Bengali) ───

export const ACTION_LABELS: Record<string, string> = {
  // Authentication
  [AuditActions.LOGIN]: 'লগইন',
  [AuditActions.LOGOUT]: 'লগআউট',
  [AuditActions.LOGIN_FAILED]: 'লগইন ব্যর্থ',

  // User self-service
  [AuditActions.USER_REGISTER]: 'নতুন ব্যবহারকারী নিবন্ধন',
  [AuditActions.USER_PROFILE_UPDATE]: 'প্রোফাইল আপডেট',
  [AuditActions.USER_PASSWORD_RESET]: 'পাসওয়ার্ড রিসেট',
  [AuditActions.USER_PASSWORD_CHANGE]: 'পাসওয়ার্ড পরিবর্তন',
  [AuditActions.USER_AVATAR_UPDATE]: 'অ্যাভাটার আপডেট',
  [AuditActions.USER_LEARNING_PREFERENCE_UPDATE]: 'শেখার পছন্দ আপডেট',

  // Purchase actions
  [AuditActions.PAYMENT_SUBMIT]: 'পেমেন্ট জমা',
  [AuditActions.PAYMENT_APPROVE]: 'পেমেন্ট অনুমোদন',
  [AuditActions.PAYMENT_REJECT]: 'পেমেন্ট প্রত্যাখ্যান',
  [AuditActions.PAYMENT_REFUND]: 'পেমেন্ট রিফান্ড',
  [AuditActions.SUBSCRIPTION_PURCHASE]: 'সাবস্ক্রিপশন ক্রয়',
  [AuditActions.COURSE_PURCHASE]: 'কোর্স ক্রয়',
  [AuditActions.BUNDLE_PURCHASE]: 'বান্ডেল ক্রয়',
  [AuditActions.PACKAGE_PURCHASE]: 'প্যাকেজ ক্রয়',
  [AuditActions.MCQ_EXAM_PACKAGE_PURCHASE]: 'MCQ এক্সাম ক্রয়',
  [AuditActions.CQ_EXAM_PACKAGE_PURCHASE]: 'CQ এক্সাম ক্রয়',

  // Course actions
  [AuditActions.COURSE_ENROLL]: 'কোর্সে ভর্তি',
  [AuditActions.COURSE_COMPLETE]: 'কোর্স সম্পন্ন',
  [AuditActions.COURSE_LESSON_COMPLETE]: 'লেসন সম্পন্ন',
  [AuditActions.COURSE_ASSIGNMENT_SUBMIT]: 'অ্যাসাইনমেন্ট জমা',

  // Exam actions
  [AuditActions.EXAM_START]: 'এক্সাম শুরু',
  [AuditActions.EXAM_SUBMIT]: 'এক্সাম জমা',
  [AuditActions.EXAM_RESULT_VIEW]: 'ফলাফল দেখা',
  [AuditActions.MCQ_EXAM_START]: 'MCQ এক্সাম শুরু',
  [AuditActions.MCQ_EXAM_SUBMIT]: 'MCQ এক্সাম জমা',
  [AuditActions.CQ_EXAM_SUBMIT]: 'CQ এক্সাম জমা',

  // Content interaction
  [AuditActions.CONTENT_VIEW]: 'কন্টেন্ট দেখা',
  [AuditActions.CONTENT_BOOKMARK]: 'বুকমার্ক যোগ',
  [AuditActions.CONTENT_UNBOOKMARK]: 'বুকমার্ক সরানো',
  [AuditActions.NOTE_CREATE]: 'নোট তৈরি',
  [AuditActions.NOTE_UPDATE]: 'নোট আপডেট',
  [AuditActions.NOTE_DELETE]: 'নোট মুছে ফেলা',

  // Feedback
  [AuditActions.FEEDBACK_SUBMIT]: 'ফিডব্যাক জমা',
  [AuditActions.FEEDBACK_MESSAGE_SEND]: 'ফিডব্যাক বার্তা পাঠানো',

  // Contact
  [AuditActions.CONTACT_MESSAGE_SEND]: 'যোগাযোগ বার্তা পাঠানো',

  // Search
  [AuditActions.SEARCH_EXECUTE]: 'অনুসন্ধান',

  // Notification
  [AuditActions.NOTIFICATION_READ]: 'নোটিফিকেশন পঠিত',
  [AuditActions.NOTIFICATION_MARK_ALL_READ]: 'সব নোটিফিকেশন পঠিত',

  // Blog actions
  [AuditActions.BLOG_CREATE]: 'ব্লগ তৈরি',
  [AuditActions.BLOG_UPDATE]: 'ব্লগ আপডেট',
  [AuditActions.BLOG_DELETE]: 'ব্লগ মুছে ফেলা',
  [AuditActions.BLOG_PUBLISH]: 'ব্লগ প্রকাশ',
  [AuditActions.BLOG_RESTORE]: 'ব্লগ পুনরুদ্ধার',
  [AuditActions.BLOG_CATEGORY_CREATE]: 'ব্লগ ক্যাটাগরি তৈরি',
  [AuditActions.BLOG_CATEGORY_UPDATE]: 'ব্লগ ক্যাটাগরি আপডেট',
  [AuditActions.BLOG_CATEGORY_DELETE]: 'ব্লগ ক্যাটাগরি মুছে ফেলা',

  // Automation actions
  [AuditActions.AUTOMATION_SOURCE_CREATE]: 'অটোমেশন সোর্স তৈরি',
  [AuditActions.AUTOMATION_SOURCE_UPDATE]: 'অটোমেশন সোর্স আপডেট',
  [AuditActions.AUTOMATION_SOURCE_DELETE]: 'অটোমেশন সোর্স মুছে ফেলা',
  [AuditActions.AUTOMATION_PROVIDER_CREATE]: 'AI প্রোভাইডার তৈরি',
  [AuditActions.AUTOMATION_PROVIDER_UPDATE]: 'AI প্রোভাইডার আপডেট',
  [AuditActions.AUTOMATION_PROVIDER_KEY_ROTATE]: 'API কী রোটেট',
  [AuditActions.AUTOMATION_PROVIDER_DELETE]: 'AI প্রোভাইডার মুছে ফেলা',
  [AuditActions.AUTOMATION_PIPELINE_CREATE]: 'পাইপলাইন তৈরি',
  [AuditActions.AUTOMATION_PIPELINE_UPDATE]: 'পাইপলাইন আপডেট',
  [AuditActions.AUTOMATION_TEMPLATE_CREATE]: 'প্রম্পট টেমপ্লেট তৈরি',
  [AuditActions.AUTOMATION_TEMPLATE_UPDATE]: 'প্রম্পট টেমপ্লেট আপডেট',
  [AuditActions.AUTOMATION_RULE_CREATE]: 'অটোমেশন নিয়ম তৈরি',
  [AuditActions.AUTOMATION_RULE_UPDATE]: 'অটোমেশন নিয়ম আপডেট',
  [AuditActions.AUTOMATION_RULE_DELETE]: 'অটোমেশন নিয়ম মুছে ফেলা',
  [AuditActions.AUTOMATION_SETTING_CHANGE]: 'অটোমেশন সেটিংস পরিবর্তন',
  [AuditActions.AUTOMATION_REVIEW_APPROVE]: 'অটোমেশন পর্যালোচনা অনুমোদন',
  [AuditActions.AUTOMATION_REVIEW_REJECT]: 'অটোমেশন পর্যালোচনা প্রত্যাখ্যান',
  [AuditActions.AUTOMATION_PUBLISH]: 'অটোমেশন প্রকাশ',
  [AuditActions.AUTOMATION_PIPELINE_RUN]: 'অটোমেশন পাইপলাইন রান',
  [AuditActions.AUTOMATION_IMPORT]: 'অটোমেশন ইম্পোর্ট',
  [AuditActions.AUTOMATION_TEMPLATE_DELETE]: 'প্রম্পট টেমপ্লেট মুছে ফেলা',
  [AuditActions.AUTOMATION_SCHEDULE_CREATE]: 'প্রকাশ শিডিউল তৈরি',
  [AuditActions.AUTOMATION_SCHEDULE_CANCEL]: 'প্রকাশ শিডিউল বাতিল',

  // Admin actions
  [AuditActions.GRADE_UPDATE]: 'গ্রেড আপডেট',
  [AuditActions.GRADE_BULK]: 'বাল্ক গ্রেড',
  [AuditActions.USER_CREATE]: 'ব্যবহারকারী তৈরি',
  [AuditActions.USER_UPDATE]: 'ব্যবহারকারী আপডেট',
  [AuditActions.USER_DELETE]: 'ব্যবহারকারী মুছে ফেলা',
  [AuditActions.USER_BAN]: 'ব্যবহারকারী নিষিদ্ধ',
  [AuditActions.USER_UNBAN]: 'ব্যবহারকারী অনুমোদিত',
  [AuditActions.ROLE_CHANGE]: 'ভূমিকা পরিবর্তন',
  [AuditActions.RETAKE_APPROVE]: 'রিটেক অনুমোদন',
  [AuditActions.RETAKE_REJECT]: 'রিটেক প্রত্যাখ্যান',
  [AuditActions.CONTENT_CREATE]: 'কন্টেন্ট তৈরি',
  [AuditActions.CONTENT_UPDATE]: 'কন্টেন্ট আপডেট',
  [AuditActions.CONTENT_DELETE]: 'কন্টেন্ট মুছে ফেলা',
  [AuditActions.CONTENT_SOFT_DELETE]: 'কন্টেন্ট আর্কাইভ',
  [AuditActions.CONTENT_RESTORE]: 'কন্টেন্ট পুনরুদ্ধার',
  [AuditActions.CONTENT_FORCE_DELETE]: 'কন্টেন্ট স্থায়ী মুছে ফেলা',
  [AuditActions.WORKFLOW_SUBMIT_FOR_REVIEW]: 'পর্যালোচনায় পাঠানো',
  [AuditActions.WORKFLOW_APPROVE]: 'অনুমোদন',
  [AuditActions.WORKFLOW_REJECT]: 'প্রত্যাখ্যান',
  [AuditActions.WORKFLOW_PUBLISH]: 'প্রকাশ',
  [AuditActions.WORKFLOW_SCHEDULE]: 'নির্ধারণ',
  [AuditActions.WORKFLOW_ARCHIVE]: 'আর্কাইভ',
  [AuditActions.WORKFLOW_RESET_TO_DRAFT]: 'খসড়ায় ফেরানো',
  [AuditActions.BULK_SOFT_DELETE]: 'বাল্ক আর্কাইভ',
  [AuditActions.BULK_RESTORE]: 'বাল্ক পুনরুদ্ধার',
  [AuditActions.BULK_FORCE_DELETE]: 'বাল্ক স্থায়ী মুছে ফেলা',
  [AuditActions.IMPORT]: 'ইমপোর্ট',
  [AuditActions.EXPORT]: 'এক্সপোর্ট',
  [AuditActions.DATABASE_IMPORT]: 'ডাটাবেজ ইমপোর্ট',
  [AuditActions.DATABASE_EXPORT]: 'ডাটাবেজ এক্সপোর্ট',
  [AuditActions.BULK_IMPORT]: 'বাল্ক ইমপোর্ট',
  [AuditActions.RESTORE]: 'পুনরুদ্ধার',
  [AuditActions.FORCE_DELETE]: 'স্থায়ী মুছে ফেলা',
  [AuditActions.BULK_RESTORE_TRASH]: 'বাল্ক পুনরুদ্ধার',
  [AuditActions.BULK_FORCE_DELETE_TRASH]: 'বাল্ক স্থায়ী মুছে ফেলা',
  [AuditActions.TRASH_CLEANUP]: 'ট্র্যাশ পরিষ্কার',
  [AuditActions.TRASH_CLEANUP_PREVIEW]: 'ট্র্যাশ পরিষ্কার পূর্বরূপ',
  [AuditActions.SETTINGS_UPDATE]: 'সেটিংস আপডেট',
  [AuditActions.SETTINGS_CREATE]: 'সেটিংস তৈরি',
  [AuditActions.SETTINGS_DELETE]: 'সেটিংস মুছে ফেলা',
  [AuditActions.SETTINGS_BATCH_UPDATE]: 'সেটিংস বাল্ক আপডেট',
  [AuditActions.PERMISSION_UPDATE]: 'অনুমতি আপডেট',
  [AuditActions.PERMISSION_CREATE]: 'অনুমতি তৈরি',
  [AuditActions.PERMISSION_DELETE]: 'অনুমতি মুছে ফেলা',
  [AuditActions.NAVIGATION_CREATE]: 'নেভিগেশন তৈরি',
  [AuditActions.NAVIGATION_UPDATE]: 'নেভিগেশন আপডেট',
  [AuditActions.NAVIGATION_DELETE]: 'নেভিগেশন মুছে ফেলা',
  [AuditActions.NAVIGATION_REORDER]: 'নেভিগেশন পুনর্বিন্যাস',
  [AuditActions.NAVIGATION_SEED]: 'নেভিগেশন সিড',
  [AuditActions.CONTENT_TYPE_CREATE]: 'কন্টেন্ট টাইপ তৈরি',
  [AuditActions.CONTENT_TYPE_UPDATE]: 'কন্টেন্ট টাইপ আপডেট',
  [AuditActions.CONTENT_TYPE_DELETE]: 'কন্টেন্ট টাইপ মুছে ফেলা',
  [AuditActions.BOARD_CREATE]: 'বোর্ড তৈরি',
  [AuditActions.BOARD_UPDATE]: 'বোর্ড আপডেট',
  [AuditActions.BOARD_DELETE]: 'বোর্ড মুছে ফেলা',
  [AuditActions.YEAR_CREATE]: 'সাল তৈরি',
  [AuditActions.YEAR_UPDATE]: 'সাল আপডেট',
  [AuditActions.YEAR_DELETE]: 'সাল মুছে ফেলা',
  [AuditActions.BOARD_YEAR_CREATE]: 'বোর্ড সাল তৈরি',
  [AuditActions.BOARD_YEAR_UPDATE]: 'বোর্ড সাল আপডেট',
  [AuditActions.BOARD_YEAR_DELETE]: 'বোর্ড সাল মুছে ফেলা',
  [AuditActions.CLASS_CREATE]: 'শ্রেণি তৈরি',
  [AuditActions.CLASS_UPDATE]: 'শ্রেণি আপডেট',
  [AuditActions.CLASS_DELETE]: 'শ্রেণি মুছে ফেলা',
  [AuditActions.SUBJECT_CREATE]: 'বিষয় তৈরি',
  [AuditActions.SUBJECT_UPDATE]: 'বিষয় আপডেট',
  [AuditActions.SUBJECT_DELETE]: 'বিষয় মুছে ফেলা',
  [AuditActions.CHAPTER_CREATE]: 'অধ্যায় তৈরি',
  [AuditActions.CHAPTER_UPDATE]: 'অধ্যায় আপডেট',
  [AuditActions.CHAPTER_DELETE]: 'অধ্যায় মুছে ফেলা',
  [AuditActions.TOPIC_CREATE]: 'টপিক তৈরি',
  [AuditActions.TOPIC_UPDATE]: 'টপিক আপডেট',
  [AuditActions.TOPIC_DELETE]: 'টপিক মুছে ফেলা',
  [AuditActions.LECTURE_CREATE]: 'লেকচার তৈরি',
  [AuditActions.LECTURE_UPDATE]: 'লেকচার আপডেট',
  [AuditActions.LECTURE_DELETE]: 'লেকচার মুছে ফেলা',
  [AuditActions.MCQ_CREATE]: 'MCQ তৈরি',
  [AuditActions.MCQ_UPDATE]: 'MCQ আপডেট',
  [AuditActions.MCQ_DELETE]: 'MCQ মুছে ফেলা',
  [AuditActions.CQ_CREATE]: 'CQ তৈরি',
  [AuditActions.CQ_UPDATE]: 'CQ আপডেট',
  [AuditActions.CQ_DELETE]: 'CQ মুছে ফেলা',
  [AuditActions.KNOWLEDGE_CREATE]: 'সংক্ষিপ্ত প্রশ্ন তৈরি',
  [AuditActions.KNOWLEDGE_UPDATE]: 'সংক্ষিপ্ত প্রশ্ন আপডেট',
  [AuditActions.KNOWLEDGE_DELETE]: 'সংক্ষিপ্ত প্রশ্ন মুছে ফেলা',
  [AuditActions.SUGGESTION_CREATE]: 'সাজেশন তৈরি',
  [AuditActions.SUGGESTION_UPDATE]: 'সাজেশন আপডেট',
  [AuditActions.SUGGESTION_DELETE]: 'সাজেশন মুছে ফেলা',
  [AuditActions.COURSE_CREATE]: 'কোর্স তৈরি',
  [AuditActions.COURSE_UPDATE]: 'কোর্স আপডেট',
  [AuditActions.COURSE_DELETE]: 'কোর্স মুছে ফেলা',
  [AuditActions.COURSE_LESSON_CREATE]: 'কোর্স লেসন তৈরি',
  [AuditActions.COURSE_LESSON_UPDATE]: 'কোর্স লেসন আপডেট',
  [AuditActions.COURSE_LESSON_DELETE]: 'কোর্স লেসন মুছে ফেলা',
  [AuditActions.PACKAGE_CREATE]: 'প্যাকেজ তৈরি',
  [AuditActions.PACKAGE_UPDATE]: 'প্যাকেজ আপডেট',
  [AuditActions.PACKAGE_DELETE]: 'প্যাকেজ মুছে ফেলা',
  [AuditActions.BUNDLE_CREATE]: 'বান্ডেল তৈরি',
  [AuditActions.BUNDLE_UPDATE]: 'বান্ডেল আপডেট',
  [AuditActions.BUNDLE_DELETE]: 'বান্ডেল মুছে ফেলা',
  [AuditActions.MCQ_EXAM_PACKAGE_CREATE]: 'MCQ এক্সাম প্যাকেজ তৈরি',
  [AuditActions.MCQ_EXAM_PACKAGE_UPDATE]: 'MCQ এক্সাম প্যাকেজ আপডেট',
  [AuditActions.MCQ_EXAM_PACKAGE_DELETE]: 'MCQ এক্সাম প্যাকেজ মুছে ফেলা',
  [AuditActions.CQ_EXAM_PACKAGE_CREATE]: 'CQ এক্সাম প্যাকেজ তৈরি',
  [AuditActions.CQ_EXAM_PACKAGE_UPDATE]: 'CQ এক্সাম প্যাকেজ আপডেট',
  [AuditActions.CQ_EXAM_PACKAGE_DELETE]: 'CQ এক্সাম প্যাকেজ মুছে ফেলা',
  [AuditActions.CQ_EXAM_SET_CREATE]: 'CQ এক্সাম সেট তৈরি',
  [AuditActions.CQ_EXAM_SET_UPDATE]: 'CQ এক্সাম সেট আপডেট',
  [AuditActions.CQ_EXAM_SET_DELETE]: 'CQ এক্সাম সেট মুছে ফেলা',
  [AuditActions.CQ_EXAM_SET_QUESTIONS_ADD]: 'CQ এক্সাম সেটে প্রশ্ন যোগ',
  [AuditActions.CQ_EXAM_SET_QUESTIONS_REMOVE]: 'CQ এক্সাম সেট থেকে প্রশ্ন সরানো',
  [AuditActions.CQ_EXAM_SUBMISSION_GRADE]: 'CQ এক্সাম সাবমিশন গ্রেড',
  [AuditActions.CQ_EXAM_BULK_GRADE]: 'CQ এক্সাম বাল্ক গ্রেড',
  [AuditActions.CQ_EXAM_RESULTS_PUBLISH]: 'CQ এক্সাম ফলাফল প্রকাশ',
  [AuditActions.CQ_EXAM_GRADING_REOPEN]: 'CQ এক্সাম গ্রেডিং পুনরায় খোলা',
  [AuditActions.CQ_EXAM_RETAKE_APPROVE]: 'CQ এক্সাম রিটেক অনুমোদন',
  [AuditActions.CQ_EXAM_QUESTION_UPDATE]: 'CQ এক্সাম প্রশ্ন আপডেট',
  [AuditActions.CQ_EXAM_REORDER_QUESTIONS]: 'CQ এক্সাম প্রশ্ন পুনর্বিন্যাস',
  [AuditActions.BANNER_CREATE]: 'ব্যানার তৈরি',
  [AuditActions.BANNER_UPDATE]: 'ব্যানার আপডেট',
  [AuditActions.BANNER_DELETE]: 'ব্যানার মুছে ফেলা',
  [AuditActions.FAQ_CREATE]: 'FAQ তৈরি',
  [AuditActions.FAQ_UPDATE]: 'FAQ আপডেট',
  [AuditActions.FAQ_DELETE]: 'FAQ মুছে ফেলা',
  [AuditActions.TESTIMONIAL_CREATE]: 'টেস্টিমোনিয়াল তৈরি',
  [AuditActions.TESTIMONIAL_UPDATE]: 'টেস্টিমোনিয়াল আপডেট',
  [AuditActions.TESTIMONIAL_DELETE]: 'টেস্টিমোনিয়াল মুছে ফেলা',
  [AuditActions.NOTICE_CREATE]: 'নোটিশ তৈরি',
  [AuditActions.NOTICE_UPDATE]: 'নোটিশ আপডেট',
  [AuditActions.NOTICE_DELETE]: 'নোটিশ মুছে ফেলা',
  [AuditActions.FEATURED_CREATE]: 'ফিচার্ড কন্টেন্ট তৈরি',
  [AuditActions.FEATURED_UPDATE]: 'ফিচার্ড কন্টেন্ট আপডেট',
  [AuditActions.FEATURED_DELETE]: 'ফিচার্ড কন্টেন্ট মুছে ফেলা',
  [AuditActions.TEACHER_CREATE]: 'শিক্ষক তৈরি',
  [AuditActions.TEACHER_UPDATE]: 'শিক্ষক আপডেট',
  [AuditActions.TEACHER_DELETE]: 'শিক্ষক মুছে ফেলা',
  [AuditActions.NOTIFICATION_CREATE]: 'নোটিফিকেশন তৈরি',
  [AuditActions.NOTIFICATION_UPDATE]: 'নোটিফিকেশন আপডেট',
  [AuditActions.NOTIFICATION_DELETE]: 'নোটিফিকেশন মুছে ফেলা',
  [AuditActions.EXAM_CREATE]: 'এক্সাম তৈরি',
  [AuditActions.EXAM_UPDATE]: 'এক্সাম আপডেট',
  [AuditActions.EXAM_DELETE]: 'এক্সাম মুছে ফেলা',
  [AuditActions.SUBSCRIPTION_CREATE]: 'সাবস্ক্রিপশন তৈরি',
  [AuditActions.SUBSCRIPTION_UPDATE]: 'সাবস্ক্রিপশন আপডেট',
  [AuditActions.SUBSCRIPTION_DELETE]: 'সাবস্ক্রিপশন মুছে ফেলা',
  [AuditActions.CONTACT_MESSAGE_READ]: 'যোগাযোগ বার্তা পঠিত',
  [AuditActions.CONTACT_MESSAGE_DELETE]: 'যোগাযোগ বার্তা মুছে ফেলা',
  [AuditActions.FEEDBACK_UPDATE]: 'ফিডব্যাক আপডেট',
  [AuditActions.AUDIT_LOG_VIEW]: 'অডিট লগ দেখা',
  [AuditActions.AUDIT_LOG_EXPORT]: 'অডিট লগ এক্সপোর্ট',
}

// ─── Entity Type Display Names (Bengali) ───

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  [EntityTypes.PAYMENT]: 'পেমেন্ট',
  [EntityTypes.USER]: 'ব্যবহারকারী',
  [EntityTypes.LECTURE]: 'লেকচার',
  [EntityTypes.MCQ]: 'MCQ',
  [EntityTypes.CQ]: 'CQ',
  [EntityTypes.KNOWLEDGE_QUESTION]: 'সংক্ষিপ্ত প্রশ্ন',
  [EntityTypes.SUGGESTION]: 'সাজেশন',
  [EntityTypes.RESOURCE]: 'রিসোর্স',
  [EntityTypes.CLASS_CATEGORY]: 'শ্রেণি',
  [EntityTypes.SUBJECT]: 'বিষয়',
  [EntityTypes.CHAPTER]: 'অধ্যায়',
  [EntityTypes.TOPIC]: 'টপিক',
  [EntityTypes.COURSE]: 'কোর্স',
  [EntityTypes.COURSE_LESSON]: 'কোর্স লেসন',
  [EntityTypes.COURSE_ASSIGNMENT]: 'কোর্স অ্যাসাইনমেন্ট',
  [EntityTypes.CONTENT_PACKAGE]: 'প্যাকেজ',
  [EntityTypes.CONTENT_BUNDLE]: 'বান্ডেল',
  [EntityTypes.BUNDLE_ITEM]: 'বান্ডেল আইটেম',
  [EntityTypes.EXAM]: 'এক্সাম',
  [EntityTypes.EXAM_QUESTION]: 'এক্সাম প্রশ্ন',
  [EntityTypes.EXAM_RESULT]: 'এক্সাম ফলাফল',
  [EntityTypes.MCQ_EXAM_PACKAGE]: 'MCQ এক্সাম প্যাকেজ',
  [EntityTypes.MCQ_EXAM_SET]: 'MCQ এক্সাম সেট',
  [EntityTypes.CQ_EXAM_PACKAGE]: 'CQ এক্সাম প্যাকেজ',
  [EntityTypes.CQ_EXAM_SET]: 'CQ এক্সাম সেট',
  [EntityTypes.SUBMISSION]: 'জমা দেওয়া',
  [EntityTypes.BANNER]: 'ব্যানার',
  [EntityTypes.FAQ]: 'FAQ',
  [EntityTypes.TESTIMONIAL]: 'টেস্টিমোনিয়াল',
  [EntityTypes.NOTICE]: 'নোটিশ',
  [EntityTypes.FEATURED_CONTENT]: 'ফিচার্ড কন্টেন্ট',
  [EntityTypes.TEACHER_MODERATOR]: 'শিক্ষক',
  [EntityTypes.NAVIGATION]: 'নেভিগেশন',
  [EntityTypes.CONTENT_TYPE]: 'কন্টেন্ট টাইপ',
  [EntityTypes.BOARD]: 'বোর্ড',
  [EntityTypes.EXAM_YEAR]: 'পরীক্ষার সাল',
  [EntityTypes.BOARD_YEAR]: 'বোর্ড সাল',
  [EntityTypes.BLOG_POST]: 'ব্লগ পোস্ট',
  [EntityTypes.BLOG_CATEGORY]: 'ব্লগ ক্যাটাগরি',
  [EntityTypes.BLOG_TAG]: 'ব্লগ ট্যাগ',
  [EntityTypes.AUTOMATION_SOURCE]: 'অটোমেশন সোর্স',
  [EntityTypes.AUTOMATION_PIPELINE_RUN]: 'অটোমেশন পাইপলাইন',
  [EntityTypes.AUTOMATION_PIPELINE_STAGE]: 'অটোমেশন স্টেজ',
  [EntityTypes.AUTOMATION_PROVIDER]: 'AI প্রোভাইডার',
  [EntityTypes.AUTOMATION_PROMPT_TEMPLATE]: 'প্রম্পট টেমপ্লেট',
  [EntityTypes.AUTOMATION_PROMPT_VERSION]: 'প্রম্পট ভার্সন',
  [EntityTypes.AUTOMATION_RULE]: 'অটোমেশন নিয়ম',
  [EntityTypes.AUTOMATION_REVIEW_TASK]: 'পর্যালোচনা টাস্ক',
  [EntityTypes.AUTOMATION_SCHEDULE]: 'প্রকাশ সময়সূচী',
  [EntityTypes.AUTOMATION_MEDIA_ASSET]: 'মিডিয়া অ্যাসেট',
  [EntityTypes.AUTOMATION_IMPORTED_CONTENT]: 'ইম্পোর্টেড কন্টেন্ট',
  [EntityTypes.AUTOMATION_SETTING]: 'অটোমেশন সেটিং',
  [EntityTypes.AUTOMATION_AI_REQUEST]: 'AI অনুরোধ',
  [EntityTypes.AUTOMATION_OUTBOX]: 'আউটবক্স',
  [EntityTypes.AUTOMATION_SCHEDULER_JOB]: 'শিডিউলার জব',
  [EntityTypes.SUBSCRIPTION]: 'সাবস্ক্রিপশন',
  [EntityTypes.NOTIFICATION]: 'নোটিফিকেশন',
  [EntityTypes.NOTE]: 'নোট',
  [EntityTypes.CONTACT_MESSAGE]: 'যোগাযোগ বার্তা',
  [EntityTypes.FEEDBACK]: 'ফিডব্যাক',
  [EntityTypes.FEEDBACK_MESSAGE]: 'ফিডব্যাক বার্তা',
  [EntityTypes.SITE_SETTING]: 'সেটিংস',
  [EntityTypes.PERMISSION]: 'অনুমতি',
  [EntityTypes.ROLE_PERMISSION]: 'ভূমিকা অনুমতি',
  [EntityTypes.AUDIT_LOG]: 'অডিট লগ',
  [EntityTypes.DATABASE]: 'ডাটাবেজ',
  [EntityTypes.TRASH]: 'ট্র্যাশ',
}
