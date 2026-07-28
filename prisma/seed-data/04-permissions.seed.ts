import type { PrismaClient } from '@prisma/client'
import { deterministicId, resetCounter } from './00-helpers'

const ALL_PERMISSIONS = [
  { name: 'payment.approve', description: 'Approve payment requests', group: 'payment' },
  { name: 'payment.reject', description: 'Reject payment requests', group: 'payment' },
  { name: 'payment.view', description: 'View payment records', group: 'payment' },
  { name: 'payment.manage', description: 'Full payment management', group: 'payment' },
  { name: 'content.manage', description: 'Manage all content', group: 'content' },
  { name: 'content.create', description: 'Create content', group: 'content' },
  { name: 'content.edit', description: 'Edit any content', group: 'content' },
  { name: 'content.delete', description: 'Delete content (soft)', group: 'content' },
  { name: 'content.publish', description: 'Publish content', group: 'content' },
  { name: 'content.bulk-import', description: 'Bulk import content', group: 'content' },
  { name: 'users.manage', description: 'Manage user accounts', group: 'users' },
  { name: 'users.view', description: 'View user details', group: 'users' },
  { name: 'users.create', description: 'Create user accounts', group: 'users' },
  { name: 'users.delete', description: 'Delete user accounts', group: 'users' },
  { name: 'system.settings', description: 'Manage site settings', group: 'system' },
  { name: 'system.navigation', description: 'Manage navigation', group: 'system' },
  { name: 'system.content-types', description: 'Manage content types', group: 'system' },
  { name: 'system.featured', description: 'Manage featured content', group: 'system' },
  { name: 'exam.manage', description: 'Manage exams', group: 'exam' },
  { name: 'exam.create', description: 'Create exams', group: 'exam' },
  { name: 'exam.grade', description: 'Grade exam submissions', group: 'exam' },
  { name: 'exam.packages', description: 'Manage exam packages', group: 'exam' },
  { name: 'exam.retake', description: 'Approve exam retakes', group: 'exam' },
  { name: 'blog.manage', description: 'Manage blog', group: 'blog' },
  { name: 'blog.create', description: 'Create blog posts', group: 'blog' },
  { name: 'blog.edit', description: 'Edit any blog post', group: 'blog' },
  { name: 'blog.publish', description: 'Publish blog posts', group: 'blog' },
  { name: 'analytics.view', description: 'View analytics', group: 'analytics' },
  { name: 'analytics.manage', description: 'Manage analytics config', group: 'analytics' },
  { name: 'workflow.manage', description: 'Manage editorial workflow', group: 'workflow' },
  { name: 'workflow.approve', description: 'Approve workflow transitions', group: 'workflow' },
  { name: 'audit.view', description: 'View audit logs', group: 'audit' },
  { name: 'notifications.send', description: 'Send notifications', group: 'notifications' },
  { name: 'feedback.manage', description: 'Manage user feedback', group: 'feedback' },
  { name: 'contact.view', description: 'View contact messages', group: 'contact' },
  { name: 'trash.manage', description: 'Manage trash/restore', group: 'system' },

  // Automation permissions
  { name: 'automation.manage', description: 'Full automation management', group: 'automation' },
  { name: 'automation.sources', description: 'Manage content sources', group: 'automation' },
  { name: 'automation.providers', description: 'Manage AI providers', group: 'automation' },
  { name: 'automation.prompts', description: 'Manage prompt templates', group: 'automation' },
  { name: 'automation.pipelines', description: 'View and manage pipelines', group: 'automation' },
  { name: 'automation.rules', description: 'Manage automation rules', group: 'automation' },
  { name: 'automation.review', description: 'Review automation content', group: 'automation' },
  { name: 'automation.publish', description: 'Auto-publish content', group: 'automation' },
  { name: 'automation.settings', description: 'Manage automation settings', group: 'automation' },
  { name: 'automation.logs', description: 'View automation logs', group: 'automation' },
]

const ADMIN_PERMISSIONS = [
  'payment.view', 'payment.approve', 'payment.reject',
  'content.manage', 'content.create', 'content.edit', 'content.delete', 'content.publish',
  'users.view', 'users.create',
  'blog.manage', 'blog.create', 'blog.edit', 'blog.publish',
  'exam.manage', 'exam.create', 'exam.grade', 'exam.retake',
  'analytics.view',
  'feedback.manage', 'contact.view', 'notifications.send', 'trash.manage', 'system.navigation', 'system.featured',

  // Automation
  'automation.manage', 'automation.sources', 'automation.providers', 'automation.prompts',
  'automation.pipelines', 'automation.rules', 'automation.review', 'automation.publish',
  'automation.settings', 'automation.logs',
]

export async function seedPermissions(db: PrismaClient) {
  resetCounter()

  // Create all permissions
  for (const perm of ALL_PERMISSIONS) {
    await db.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, group: perm.group },
      create: { id: deterministicId('perm'), name: perm.name, description: perm.description, group: perm.group },
    })
  }

  // SUPER_ADMIN gets all permissions
  const allPerms = await db.permission.findMany()
  for (const perm of allPerms) {
    await db.rolePermission.upsert({
      where: { role_permissionId: { role: 'SUPER_ADMIN', permissionId: perm.id } },
      update: {},
      create: { id: deterministicId('rp'), role: 'SUPER_ADMIN', permissionId: perm.id },
    })
  }

  // ADMIN gets the subset
  const adminPerms = await db.permission.findMany({ where: { name: { in: ADMIN_PERMISSIONS } } })
  for (const perm of adminPerms) {
    await db.rolePermission.upsert({
      where: { role_permissionId: { role: 'ADMIN', permissionId: perm.id } },
      update: {},
      create: { id: deterministicId('rp'), role: 'ADMIN', permissionId: perm.id },
    })
  }
}
