'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FileText,
  FileQuestion,
  AlignLeft,
  Brain,
  BookOpen,
  Archive,
  CreditCard,
  ClipboardCheck,
  Image as ImageIcon,
  Bell,
  Megaphone,
  Lightbulb,
  Package,
  Box,
  Settings,
  Menu,
  ChevronLeft,
  ExternalLink,
  LogOut,
  Layers,
  X,
  Upload,
  Star,
  Tags,
  HelpCircle,
  MessageSquareQuote,
  MessageSquareText,
  StickyNote,
  Trophy,
  ShoppingCart,
  CalendarCheck,
  Filter,
  GraduationCap,
  BarChart3,
  Mail,
  Trash2,
  Activity,
  History,
  Newspaper,
  Cpu,
  Radio,
  Shield,
} from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRouterStore, RoutePath, isAdminRoute } from '@/store/router'
import { useAuthStore, useAuthUser } from '@/store/auth'
import { parseUrl } from '@/lib/urls'
import AdminAuthGuard from './AdminAuthGuard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSiteConfig } from '@/hooks/use-metadata'
import { AdminActionCenter } from './AdminNotificationBellDropdown'
import Image from 'next/image'

// Lazy load admin pages by feature group - only loads the needed page
const AdminPages = {
  // Core
  'admin-dashboard': lazy(() => import('./AdminDashboardPage')),
  'admin-users': lazy(() => import('./AdminUsersPage')),
  'admin-content': lazy(() => import('./AdminContentPage')),
  'admin-hierarchy': lazy(() => import('./AdminHierarchyPage')),
  'admin-bulk-import': lazy(() => import('./AdminBulkImportPage')),  // Questions
  'admin-mcq': lazy(() => import('./AdminMCQPage')),
  'admin-cq': lazy(() => import('./AdminCQPage')),
  'admin-knowledge-questions': lazy(() => import('./AdminKnowledgeQuestionsPage')),

  // Exams
  'admin-exams': lazy(() => import('./AdminExamsPage')),

  // Content
  'admin-lectures': lazy(() => import('./AdminLecturesPage')),
  'admin-board': lazy(() => import('./AdminBoardPage')),
  'admin-notices': lazy(() => import('./AdminNoticePage')),
  'admin-suggestions': lazy(() => import('./AdminSuggestionPage')),
  'admin-featured': lazy(() => import('./AdminFeaturedPage')),
  'admin-content-types': lazy(() => import('./AdminContentTypesPage')),
  
  // Bundles & Packages
  'admin-bundles': lazy(() => import('./AdminBundlesPage')),
  'admin-packages': lazy(() => import('./AdminPackagesPage')),
  
  // MCQ Exam
  'admin-mcq-exam-packages': lazy(() => import('@/features/mcq-exam/admin/MCQExamAdminContainer')),
  'admin-mcq-exam-purchases': lazy(() => import('./AdminMCQExamPurchasesPage')),
  
  // CQ Exam
  'admin-cq-exam-packages': lazy(() => import('@/features/cq-exam/admin/CQExamAdminContainer')),
  'admin-exam-results': lazy(() => import('./AdminExamResultsPage')),

  // Blog
  'admin-blog': lazy(() => import('@/features/blog/admin/AdminBlogPage')),
  'admin-blog-editor': lazy(() => import('@/features/blog/admin/AdminBlogEditor')),
  'admin-blog-categories': lazy(() => import('@/features/blog/admin/AdminBlogCategoriesPage')),
  'admin-blog-tags': lazy(() => import('@/features/blog/admin/AdminBlogTagsPage')),

  // Courses
  'admin-courses': lazy(() => import('@/features/course/admin/CourseAdminContainer')),
  
  // Commerce
  'admin-payments': lazy(() => import('./AdminPaymentsPage')),
  'admin-subscriptions': lazy(() => import('./AdminSubscriptionsPage')),
  'admin-content-purchases': lazy(() => import('./AdminContentPurchasesPage')),
  
  // CMS
  'admin-banners': lazy(() => import('./AdminBannersPage')),
  'admin-notifications': lazy(() => import('./AdminNotificationsPage')),
  'admin-faqs': lazy(() => import('./AdminFAQsPage')),
  'admin-testimonials': lazy(() => import('./AdminTestimonialsPage')),
  'admin-notes': lazy(() => import('./AdminNotesPage')),
  'admin-teacher-moderators': lazy(() => import('./AdminTeacherModeratorsPage')),
  'admin-feedback': lazy(() => import('./AdminFeedbackPage')),
  'admin-contact-messages': lazy(() => import('./AdminContactMessagesPage')),
  
  // Settings
  'admin-settings': lazy(() => import('./AdminSettingsPage')),

  // Trash
  'admin-trash': lazy(() => import('./AdminTrashPage')),

  // Audit Logs
  'admin-audit-logs': lazy(() => import('./AdminAuditLogsPage')),

  // Version History
  'admin-version-history': lazy(() => import('./AdminVersionHistoryPage')),

  // Analytics
  'admin-analytics': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-revenue': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-students': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-retention': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-conversion': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-dropoff': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-courses': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-lectures': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-mcq': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-cq': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-payments': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-acquisition': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-search': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-devices': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-geo': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-realtime': lazy(() => import('@/components/analytics/AnalyticsPage')),
  'admin-analytics-reports': lazy(() => import('@/components/analytics/AnalyticsPage')),

  // Automation — Dashboard (v2)
  'admin-automation': lazy(() => import('@/features/automation-v2/pages/AutomationDashboardPage')),

  // Automation — Sources (v2 — inline dialog, no separate editor)
  'admin-automation-sources': lazy(() => import('@/features/automation-v2/pages/SourceListPage')),
  'admin-automation-source-editor': lazy(() => import('@/features/automation-v2/pages/SourceListPage')),

  // Automation — Providers (v2)
  'admin-automation-providers': lazy(() => import('@/features/automation-v2/pages/ProviderListPage')),

  // Automation — Content workspace (v2 — all content sub-routes load the same workspace)
  'admin-automation-content': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-templates': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-template-editor': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-pipelines': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-pipeline-detail': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-review': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-content-schedules': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),

  // Automation — Blog (backward compat — loads v2 ContentWorkspace)
  'admin-automation-blog': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-templates': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-template-editor': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-pipelines': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-pipeline-detail': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-review': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-blog-schedules': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),

  // Automation — Settings (v2 — single page, no separate rules/logs)
  'admin-automation-settings': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-settings-rules': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-settings-rule-editor': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-settings-logs': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),

  // Automation — Legacy aliases (backward compat — point to v2 pages)
  'admin-automation-templates': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-template-editor': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-pipelines': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-pipeline-detail': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-rules': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-rule-editor': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-logs': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
  'admin-automation-review': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-schedules': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),

  // Automation v2 — direct routes (keep for /admin/automation-v2/* URL access)
  'admin-automation-v2': lazy(() => import('@/features/automation-v2/pages/AutomationDashboardPage')),
  'admin-automation-v2-sources': lazy(() => import('@/features/automation-v2/pages/SourceListPage')),
  'admin-automation-v2-providers': lazy(() => import('@/features/automation-v2/pages/ProviderListPage')),
  'admin-automation-v2-content': lazy(() => import('@/features/automation-v2/pages/ContentWorkspace')),
  'admin-automation-v2-settings': lazy(() => import('@/features/automation-v2/pages/AutomationSettingsPage')),
}

const GROUPS = {
  MAIN: 'মূল',
  ANALYTICS: 'বিশ্লেষণ',
  CONTENT: 'কন্টেন্ট',
  QUESTIONS: 'প্রশ্ন',
  EDUCATION: 'শিক্ষা',
  EXAMS: 'এক্সাম ও প্যাকেজ',
  RESULTS: 'ফলাফল ও ক্রয়',
  FINANCIAL: 'আর্থিক',
  CMS: 'সিএমএস',
  AUTOMATION: 'অটোমেশন',
  SETTINGS: 'সেটিংস',
} as const

const GROUP_ORDER = [GROUPS.MAIN, GROUPS.CONTENT, GROUPS.QUESTIONS, GROUPS.EDUCATION, GROUPS.EXAMS, GROUPS.RESULTS, GROUPS.FINANCIAL, GROUPS.CMS, GROUPS.AUTOMATION, GROUPS.SETTINGS, GROUPS.ANALYTICS]

interface SidebarItem {
  label: string
  icon: React.ElementType
  route: RoutePath
  group: string
}

const sidebarItems: SidebarItem[] = [
  { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, route: 'admin-dashboard', group: GROUPS.MAIN },
  { label: 'ব্যবহারকারী', icon: Users, route: 'admin-users', group: GROUPS.MAIN },
  { label: 'শিক্ষক ও মডারেটর', icon: GraduationCap, route: 'admin-teacher-moderators', group: GROUPS.MAIN },
  { label: 'কন্টেন্ট', icon: FileText, route: 'admin-content', group: GROUPS.CONTENT },
  { label: 'হায়ারার্কি', icon: Layers, route: 'admin-hierarchy', group: GROUPS.CONTENT },
  { label: 'বাল্ক ইম্পোর্ট', icon: Upload, route: 'admin-bulk-import', group: GROUPS.CONTENT },
  { label: 'কন্টেন্ট টাইপ', icon: Tags, route: 'admin-content-types', group: GROUPS.CONTENT },
  { label: 'ফিচার্ড কন্টেন্ট', icon: Star, route: 'admin-featured', group: GROUPS.CONTENT },
  { label: 'MCQ ব্যবস্থাপনা', icon: FileQuestion, route: 'admin-mcq', group: GROUPS.QUESTIONS },
  { label: 'CQ ব্যবস্থাপনা', icon: AlignLeft, route: 'admin-cq', group: GROUPS.QUESTIONS },
  { label: 'সংক্ষিপ্ত প্রশ্ন', icon: Brain, route: 'admin-knowledge-questions', group: GROUPS.QUESTIONS },
  { label: 'বোর্ড প্রশ্ন', icon: Archive, route: 'admin-board', group: GROUPS.QUESTIONS },
  { label: 'লেকচার', icon: BookOpen, route: 'admin-lectures', group: GROUPS.EDUCATION },
  { label: 'নোটিশ', icon: Megaphone, route: 'admin-notices', group: GROUPS.EDUCATION },
  { label: 'সাজেশন', icon: Lightbulb, route: 'admin-suggestions', group: GROUPS.EDUCATION },
  { label: 'নোট', icon: StickyNote, route: 'admin-notes', group: GROUPS.EDUCATION },
  { label: 'FAQ', icon: HelpCircle, route: 'admin-faqs', group: GROUPS.EDUCATION },
  { label: 'এক্সাম', icon: ClipboardCheck, route: 'admin-exams', group: GROUPS.EXAMS },
  { label: 'বান্ডেল', icon: Package, route: 'admin-bundles', group: GROUPS.EXAMS },
  { label: 'প্যাকেজ', icon: Box, route: 'admin-packages', group: GROUPS.EXAMS },
  { label: 'কোর্স', icon: BookOpen, route: 'admin-courses', group: GROUPS.EXAMS },
  { label: 'MCQ এক্সাম প্যাকেজ', icon: FileQuestion, route: 'admin-mcq-exam-packages', group: GROUPS.EXAMS },
  { label: 'CQ এক্সাম প্যাকেজ', icon: AlignLeft, route: 'admin-cq-exam-packages', group: GROUPS.EXAMS },
  { label: 'এক্সাম ফলাফল', icon: Trophy, route: 'admin-exam-results', group: GROUPS.RESULTS },
  { label: 'MCQ ক্রয়', icon: ShoppingCart, route: 'admin-mcq-exam-purchases', group: GROUPS.RESULTS },
  { label: 'কন্টেন্ট ক্রয়', icon: Filter, route: 'admin-content-purchases', group: GROUPS.RESULTS },
  { label: 'সাবস্ক্রিপশন', icon: CalendarCheck, route: 'admin-subscriptions', group: GROUPS.RESULTS },
  { label: 'পেমেন্ট', icon: CreditCard, route: 'admin-payments', group: GROUPS.FINANCIAL },
  { label: 'ব্লগ', icon: Newspaper, route: 'admin-blog', group: GROUPS.CMS },
  { label: 'ব্লগ ক্যাটাগরি', icon: Tags, route: 'admin-blog-categories', group: GROUPS.CMS },
  { label: 'ব্লগ ট্যাগ', icon: Tags, route: 'admin-blog-tags', group: GROUPS.CMS },
  { label: 'ব্যানার', icon: ImageIcon, route: 'admin-banners', group: GROUPS.CMS },
  { label: 'নোটিফিকেশন', icon: Bell, route: 'admin-notifications', group: GROUPS.CMS },
  { label: 'টেস্টিমোনিয়াল', icon: MessageSquareQuote, route: 'admin-testimonials', group: GROUPS.CMS },
  { label: 'ফিডব্যাক', icon: MessageSquareText, route: 'admin-feedback', group: GROUPS.CMS },
  { label: 'যোগাযোগ বার্তা', icon: Mail, route: 'admin-contact-messages', group: GROUPS.CMS },
  { label: 'সেটিংস', icon: Settings, route: 'admin-settings', group: GROUPS.SETTINGS },
  { label: 'ট্র্যাশ', icon: Trash2, route: 'admin-trash', group: GROUPS.SETTINGS },
  { label: 'অডিট লগ', icon: Activity, route: 'admin-audit-logs', group: GROUPS.SETTINGS },
  { label: 'ভার্সন হিস্ট্রি', icon: History, route: 'admin-version-history', group: GROUPS.SETTINGS },

  // Automation — Dashboard
  { label: 'ড্যাশবোর্ড', icon: Cpu, route: 'admin-automation', group: GROUPS.AUTOMATION },

  // Automation — Sources
  { label: 'সোর্স', icon: Radio, route: 'admin-automation-sources', group: GROUPS.AUTOMATION },

  // Automation — Providers
  { label: 'প্রোভাইডার', icon: Shield, route: 'admin-automation-providers', group: GROUPS.AUTOMATION },

  // Automation — Content (single entry — templates, pipelines, review, schedules inside)
  { label: 'কন্টেন্ট', icon: Newspaper, route: 'admin-automation-content', group: GROUPS.AUTOMATION },

  // Automation — Settings (single entry — rules, logs inside)
  { label: 'সেটিংস', icon: Settings, route: 'admin-automation-settings', group: GROUPS.AUTOMATION },

  // Analytics (single entry — all tabs inside)
  { label: 'বিশ্লেষণ', icon: BarChart3, route: 'admin-analytics', group: GROUPS.ANALYTICS },
]

function SidebarContent({
  collapsed,
  currentRoute,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean
  currentRoute: RoutePath
  onNavigate?: () => void
  onToggleCollapse: () => void
}) {
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthUser()
  const logout = useAuthStore((s) => s.logout)
  const { config } = useSiteConfig()
  const siteName = config?.siteName || 'শিক্ষা বাংলা'
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const prevRouteRef = useRef<RoutePath>(currentRoute)

  // Route prefix matching for admin sidebar active state
  const isAdminRouteActive = useCallback((sidebarRoute: RoutePath, current: RoutePath): boolean => {
    if (current === sidebarRoute) return true
    // Blog: admin-blog also matches admin-blog-editor, admin-blog-categories, admin-blog-tags
    if (sidebarRoute === 'admin-blog' && current.startsWith('admin-blog')) return true
    // Automation: parent items highlight when any sub-route is active
    // Content parent matches all admin-automation-content-* sub-routes (+ backward-compat blog-*)
    if (sidebarRoute === 'admin-automation-content' && (current.startsWith('admin-automation-content-') || current.startsWith('admin-automation-blog-'))) return true
    // Settings parent matches all admin-automation-settings-* sub-routes
    if (sidebarRoute === 'admin-automation-settings' && current.startsWith('admin-automation-settings-')) return true
    // Sources parent matches source-editor
    if (sidebarRoute === 'admin-automation-sources' && current === 'admin-automation-source-editor') return true

    return false
  }, [])

  const groupedItems = useMemo(() => {
    const map = new Map<string, SidebarItem[]>()
    for (const item of sidebarItems) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return map
  }, [])

  const handleNavigate = (route: RoutePath) => {
    navigate(route)
    onNavigate?.()
  }

  // Auto-scroll to the active navigation item
  useEffect(() => {
    if (activeItemRef.current) {
      // Small delay to ensure the DOM has settled after route change
      const timer = setTimeout(() => {
        activeItemRef.current?.scrollIntoView({
          behavior: prevRouteRef.current === currentRoute ? 'smooth' : 'auto',
          block: 'center',
          inline: 'nearest',
        })
      }, 50)
      prevRouteRef.current = currentRoute
      return () => clearTimeout(timer)
    }
  }, [currentRoute])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border p-4 shrink-0">
        {config?.logo ? (
          <Image
            src={config.logo}
            alt={siteName}
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg object-contain shrink-0"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shrink-0">
            {siteName.charAt(0)}
          </div>
        )}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap flex-1 min-w-0"
            >
              <h1 className="font-bold text-sm truncate">{siteName}</h1>
              <p className="text-xs text-sidebar-foreground/60 truncate">অ্যাডমিন প্যানেল</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation — scrollable when items overflow */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-1 px-2 py-2">
          <TooltipProvider delayDuration={0}>
            {GROUP_ORDER.map((groupName) => {
              const groupItems = groupedItems.get(groupName)
              if (!groupItems) return null
              const isFirst = groupName === GROUP_ORDER[0]
              return (
                <div key={groupName} className="flex flex-col gap-0.5">
                  {!collapsed && (
                    <>
                      {!isFirst && <div className="border-t border-sidebar-border/40 mx-1 my-2" />}
                      <div className="px-3 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                          {groupName}
                        </span>
                      </div>
                    </>
                  )}
                  {groupItems.map((item) => {
                    const isActive = isAdminRouteActive(item.route, currentRoute)
                    const Icon = item.icon
                    return (
                      <Tooltip key={item.route}>
                        <TooltipTrigger asChild>
                          <button
                            ref={isActive ? activeItemRef : undefined}
                            onClick={() => handleNavigate(item.route)}
                            data-active={isActive || undefined}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full',
                              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                              isActive &&
                                'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20',
                              collapsed && 'justify-center px-2'
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-5 w-5 shrink-0',
                                isActive && 'text-emerald-600 dark:text-emerald-400'
                              )}
                            />
                            <AnimatePresence>
                              {!collapsed && (
                                <motion.span
                                  initial={{ opacity: 0, width: 0 }}
                                  animate={{ opacity: 1, width: 'auto' }}
                                  exit={{ opacity: 0, width: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden whitespace-nowrap"
                                >
                                  {item.label}
                                </motion.span>
                              )}
                            </AnimatePresence>
                            {isActive && !collapsed && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}
                          </button>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side="right" className="font-normal">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </div>
              )
            })}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Bottom section — user info + actions */}
      <div className="border-t border-sidebar-border p-3 space-y-2 shrink-0">
        {/* Visit website link */}
        <button
          onClick={() => handleNavigate('home')}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full',
            collapsed && 'justify-center px-2'
          )}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                ওয়েবসাইটে যান
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <Separator className="bg-sidebar-border" />

        {/* Admin user */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2',
            collapsed && 'justify-center px-2'
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user?.avatar} alt={user?.name || 'User avatar'} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
              {user?.name ? getInitials(user.name) : 'A'}
            </AvatarFallback>
          </Avatar>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden min-w-0"
              >
                <p className="text-sm font-medium truncate">{user?.name || 'অ্যাডমিন'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.role === 'SUPER_ADMIN' ? 'সুপার অ্যাডমিন' : 'অ্যাডমিন'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-destructive"
              onClick={() => {
                logout()
                navigate('home')
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapse toggle - desktop only */}
      <div className="hidden lg:block border-t border-sidebar-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              collapsed && 'rotate-180'
            )}
          />
        </Button>
      </div>
    </div>
  )
}

function AdminContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Derive admin page from URL to prevent double rendering.
  // Zustand's navigate() + _onNavigate → router.push() causes the old
  // page shell to render the new page before Next.js navigation completes.
  // Using the URL directly ensures only the correct shell renders the page.
  const parsed = parseUrl(pathname, searchParams ?? undefined)
  const adminRoute = parsed?.route && isAdminRoute(parsed.route)
    ? parsed.route
    : 'admin-dashboard'

  // Safety guard: if the URL is /admin/... but parseUrl failed, do a hard
  // redirect instead of silently falling back to the dashboard.
  // This catches cases where the Zustand _onNavigate bridge dropped a
  // sidebar click, leaving the URL/route out of sync.
  const needsHardRedirect = !parsed && pathname.startsWith('/admin/')
  useEffect(() => {
    if (needsHardRedirect && typeof window !== 'undefined') {
      window.location.href = pathname
    }
  }, [needsHardRedirect, pathname])
  if (needsHardRedirect) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>
  }

  const Page = AdminPages[adminRoute as keyof typeof AdminPages] || AdminPages['admin-dashboard']

  return (
    <AdminAuthGuard>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>}>
        <Page />
      </Suspense>
    </AdminAuthGuard>
  )
}

function AdminLayoutContent() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { config } = useSiteConfig()
  const siteName = config?.siteName || 'শিক্ষা বাংলা'

  // Derive route from URL to stay in sync with the page shell
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const parsed = parseUrl(pathname, searchParams ?? undefined)
  const currentRoute = parsed?.route && isAdminRoute(parsed.route) ? parsed.route : 'admin-dashboard'

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false)
  }, [])

  if (!isAdminRoute(currentRoute)) return null

  return (
    <>
      <AdminActionCenter />
      <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: 'easeInOut' } as const}
        className="hidden lg:flex flex-col border-r border-sidebar-border shrink-0 overflow-hidden"
      >
        <SidebarContent
          collapsed={collapsed}
          currentRoute={currentRoute}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={closeMobileSidebar}
              aria-hidden="true"
            />
            {/* Sidebar panel */}
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden shadow-xl"
            >
              {/* Close button */}
              <button
                onClick={closeMobileSidebar}
                className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                aria-label="মেনু বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent
                collapsed={false}
                currentRoute={currentRoute}
                onNavigate={closeMobileSidebar}
                onToggleCollapse={() => {}}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar for mobile */}
        <header className="lg:hidden flex items-center gap-3 border-b px-4 py-3 bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="মেনু খুলুন"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {config?.logo ? (
              <Image
                src={config.logo}
                alt={siteName}
                width={28}
                height={28}
                className="w-7 h-7 rounded-md object-contain shrink-0"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white font-bold text-xs shrink-0">
                {siteName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-sm truncate">{siteName}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 md:p-6 lg:p-8">
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>}>
              <AdminContent />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
    </>
  )
}

export default function AdminLayout() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <AdminLayoutContent />
    </Suspense>
  )
}
