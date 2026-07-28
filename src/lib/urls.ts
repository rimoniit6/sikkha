import type { RouteParams,RoutePath } from '@/store/router'

type _SegmentValue = string | undefined

interface RouteDef {
  path: string
  queryParams: (keyof RouteParams)[]
}

const ROUTE_DEFS: Record<RoutePath, RouteDef> = {
  home: { path: '/', queryParams: [] },
  login: { path: '/login', queryParams: [] },
  register: { path: '/register', queryParams: [] },

  search: { path: '/search', queryParams: ['searchQuery'] },
  'class-list': { path: '/classes', queryParams: [] },
  'class-detail': { path: '/class/{classSlug}', queryParams: ['scrollTarget'] },
  'subject-detail': { path: '/class/{classSlug}/{subjectSlug}', queryParams: ['subjectId', 'initialTab', 'source', 'scrollTarget'] },
  'chapter-detail': { path: '/class/{classSlug}/{subjectSlug}/{chapterSlug}', queryParams: ['subjectId', 'initialTab', 'scrollTarget'] },
  'lecture-list': { path: '/lectures', queryParams: ['chapterId', 'subjectId', 'classSlug', 'scrollTarget'] },
  'lecture-viewer': { path: '/lecture/{lectureId}', queryParams: ['chapterId', 'subjectId', 'classSlug', 'scrollTarget'] },
  'exam-session': { path: '/mcq/exam', queryParams: ['examId', 'source', 'scrollTarget'] },
  'exam-result': { path: '/mcq/result/{resultId}', queryParams: ['examId', 'scrollTarget'] },
  'cq-list': { path: '/cq', queryParams: ['chapterId', 'subjectId', 'classSlug', 'scrollTarget'] },
  'cq-viewer': { path: '/cq/{cqId}', queryParams: ['chapterId', 'subjectId', 'classSlug', 'scrollTarget'] },
  'board-questions': { path: '/board-questions', queryParams: ['boardName', 'year', 'source', 'scrollTarget'] },
  notices: { path: '/notices', queryParams: ['scrollTarget'] },
  'notice-detail': { path: '/notices/{noticeId}', queryParams: ['scrollTarget'] },
  suggestions: { path: '/suggestions', queryParams: ['classId', 'scrollTarget'] },
  'suggestion-detail': { path: '/suggestions/{suggestionId}', queryParams: ['scrollTarget'] },
  premium: { path: '/premium', queryParams: ['scrollTarget'] },
  payment: { path: '/payment', queryParams: ['contentType', 'contentId', 'contentTitle', 'contentPrice', 'bundleId', 'planId', 'classLevel', 'source'] },
  'user-dashboard': { path: '/dashboard', queryParams: ['tab', 'scrollTarget'] },
  'create-exam': { path: '/create-exam', queryParams: [] },
  'exam-center': { path: '/exams', queryParams: ['scrollTarget'] },
  'mcq-exam-package-list': { path: '/exams/mcq-packages', queryParams: ['scrollTarget'] },
  'mcq-exam-package-detail': { path: '/exams/mcq-packages/{packageId}', queryParams: ['scrollTarget', 'startSetId'] },
  'mcq-exam-history': { path: '/exams/history', queryParams: ['scrollTarget'] },
  'exam-creator-history': { path: '/exams/my-exams', queryParams: ['scrollTarget'] },
  'exam-creator-result': { path: '/mcq/result/{resultId}/review', queryParams: ['scrollTarget'] },
  'cq-exam-package-list': { path: '/exams/cq-packages', queryParams: ['scrollTarget'] },
  'cq-exam-package-detail': { path: '/exams/cq-packages/{packageId}', queryParams: ['scrollTarget'] },
  'cq-exam-viewer': { path: '/exams/cq-packages/{packageId}/take', queryParams: ['examId', 'scrollTarget'] },
  'cq-exam-result': { path: '/exams/cq-packages/{packageId}/result/{resultId}', queryParams: ['scrollTarget'] },
  'short-questions': { path: '/knowledge-questions', queryParams: ['chapterId', 'classSlug', 'scrollTarget'] },
  'admin-dashboard': { path: '/admin', queryParams: [] },
  'admin-users': { path: '/admin/users', queryParams: [] },
  'admin-content': { path: '/admin/content', queryParams: [] },
  'admin-mcq': { path: '/admin/mcq', queryParams: [] },
  'admin-cq': { path: '/admin/cq', queryParams: [] },
  'admin-lectures': { path: '/admin/lectures', queryParams: [] },
  'admin-board': { path: '/admin/board', queryParams: [] },
  'admin-payments': { path: '/admin/payments', queryParams: [] },
  'admin-settings': { path: '/admin/settings', queryParams: [] },
  'admin-exams': { path: '/admin/exams', queryParams: [] },
  'admin-banners': { path: '/admin/banners', queryParams: [] },
  'admin-notifications': { path: '/admin/notifications', queryParams: [] },
  'admin-notices': { path: '/admin/notices', queryParams: [] },
  'admin-suggestions': { path: '/admin/suggestions', queryParams: [] },
  'admin-bundles': { path: '/admin/bundles', queryParams: [] },
  'admin-packages': { path: '/admin/packages', queryParams: [] },
  'admin-hierarchy': { path: '/admin/hierarchy', queryParams: [] },
  'admin-bulk-import': { path: '/admin/bulk-import', queryParams: [] },
  'admin-featured': { path: '/admin/featured', queryParams: [] },
  'admin-content-types': { path: '/admin/content-types', queryParams: [] },
  'admin-mcq-exam-packages': { path: '/admin/mcq-exam-packages', queryParams: [] },
  'admin-exam-results': { path: '/admin/exam-results', queryParams: [] },
  'admin-mcq-exam-purchases': { path: '/admin/mcq-exam-purchases', queryParams: [] },
  'admin-subscriptions': { path: '/admin/subscriptions', queryParams: [] },
  'admin-faqs': { path: '/admin/faqs', queryParams: [] },
  'admin-testimonials': { path: '/admin/testimonials', queryParams: [] },
  'admin-notes': { path: '/admin/notes', queryParams: [] },
  'admin-content-purchases': { path: '/admin/content-purchases', queryParams: [] },
  'admin-feedback': { path: '/admin/feedback', queryParams: [] },
  'admin-contact-messages': { path: '/admin/contact-messages', queryParams: [] },
  'admin-teacher-moderators': { path: '/admin/teacher-moderators', queryParams: [] },
  'admin-cq-exam-packages': { path: '/admin/cq-exam-packages', queryParams: [] },
  'admin-knowledge-questions': { path: '/admin/knowledge-questions', queryParams: [] },
  'course-list': { path: '/courses', queryParams: ['classId', 'subjectId', 'scrollTarget'] },
  'course-detail': { path: '/courses/{courseSlug}', queryParams: ['scrollTarget'] },
  'course-viewer': { path: '/courses/{courseSlug}/view', queryParams: ['scrollTarget'] },
  'my-courses': { path: '/my-courses', queryParams: [] },
  'certificates': { path: '/certificates', queryParams: [] },
  'bookmarks': { path: '/bookmarks', queryParams: [] },
  'admin-courses': { path: '/admin/courses', queryParams: [] },
  'admin-analytics': { path: '/admin/analytics', queryParams: [] },
  'admin-analytics-revenue': { path: '/admin/analytics/revenue', queryParams: [] },
  'admin-analytics-students': { path: '/admin/analytics/students', queryParams: [] },
  'admin-analytics-retention': { path: '/admin/analytics/retention', queryParams: [] },
  'admin-analytics-conversion': { path: '/admin/analytics/conversion', queryParams: [] },
  'admin-analytics-dropoff': { path: '/admin/analytics/dropoff', queryParams: [] },
  'admin-analytics-courses': { path: '/admin/analytics/courses', queryParams: [] },
  'admin-analytics-lectures': { path: '/admin/analytics/lectures', queryParams: [] },
  'admin-analytics-mcq': { path: '/admin/analytics/mcq', queryParams: [] },
  'admin-analytics-cq': { path: '/admin/analytics/cq', queryParams: [] },
  'admin-analytics-payments': { path: '/admin/analytics/payments', queryParams: [] },
  'admin-analytics-acquisition': { path: '/admin/analytics/acquisition', queryParams: [] },
  'admin-analytics-search': { path: '/admin/analytics/search', queryParams: [] },
  'admin-analytics-devices': { path: '/admin/analytics/devices', queryParams: [] },
  'admin-analytics-geo': { path: '/admin/analytics/geo', queryParams: [] },
  'admin-analytics-realtime': { path: '/admin/analytics/realtime', queryParams: [] },
  'admin-analytics-reports': { path: '/admin/analytics/reports', queryParams: [] },
  'admin-trash': { path: '/admin/trash', queryParams: [] },
  'admin-audit-logs': { path: '/admin/audit-logs', queryParams: [] },
  'admin-version-history': { path: '/admin/version-history', queryParams: [] },
  'blog': { path: '/blog', queryParams: [] },
  'blog-detail': { path: '/blog/{slug}', queryParams: [] },
  'blog-category': { path: '/blog/category/{slug}', queryParams: [] },
  'blog-tag': { path: '/blog/tag/{slug}', queryParams: [] },
  'blog-author': { path: '/blog/author/{id}', queryParams: [] },
  'admin-blog': { path: '/admin/blog', queryParams: [] },
  'admin-blog-editor': { path: '/admin/blog/editor', queryParams: ['postId'] },
  'admin-blog-categories': { path: '/admin/blog/categories', queryParams: [] },
  'admin-blog-tags': { path: '/admin/blog/tags', queryParams: [] },

  // Automation — Dashboard
  'admin-automation': { path: '/admin/automation', queryParams: [] },

  // Automation — Sources
  'admin-automation-sources': { path: '/admin/automation/sources', queryParams: [] },
  'admin-automation-source-editor': { path: '/admin/automation/sources/editor', queryParams: [] },

  // Automation — Providers
  'admin-automation-providers': { path: '/admin/automation/providers', queryParams: [] },

  // Automation — Content (canonical routes)
  'admin-automation-content': { path: '/admin/automation/content', queryParams: ['tab'] },
  'admin-automation-content-templates': { path: '/admin/automation/content/templates', queryParams: [] },
  'admin-automation-content-template-editor': { path: '/admin/automation/content/templates/editor', queryParams: [] },
  'admin-automation-content-pipelines': { path: '/admin/automation/content/pipelines', queryParams: [] },
  'admin-automation-content-pipeline-detail': { path: '/admin/automation/content/pipelines/{pipelineId}', queryParams: [] },
  'admin-automation-content-review': { path: '/admin/automation/content/review', queryParams: [] },
  'admin-automation-content-schedules': { path: '/admin/automation/content/schedules', queryParams: [] },

  // Automation — Blog (backward-compat aliases — same paths as content routes above)
  'admin-automation-blog': { path: '/admin/automation/blog', queryParams: ['tab'] },
  'admin-automation-blog-templates': { path: '/admin/automation/blog/templates', queryParams: [] },
  'admin-automation-blog-template-editor': { path: '/admin/automation/blog/templates/editor', queryParams: [] },
  'admin-automation-blog-pipelines': { path: '/admin/automation/blog/pipelines', queryParams: [] },
  'admin-automation-blog-pipeline-detail': { path: '/admin/automation/blog/pipelines/{pipelineId}', queryParams: [] },
  'admin-automation-blog-review': { path: '/admin/automation/blog/review', queryParams: [] },
  'admin-automation-blog-schedules': { path: '/admin/automation/blog/schedules', queryParams: [] },

  // Automation — Settings
  'admin-automation-settings': { path: '/admin/automation/settings', queryParams: [] },
  'admin-automation-settings-rules': { path: '/admin/automation/settings/rules', queryParams: [] },
  'admin-automation-settings-rule-editor': { path: '/admin/automation/settings/rules/editor', queryParams: [] },
  'admin-automation-settings-logs': { path: '/admin/automation/settings/logs', queryParams: [] },

  // Automation v2 — parallel routes alongside old /admin/automation/*
  'admin-automation-v2': { path: '/admin/automation-v2', queryParams: [] },
  'admin-automation-v2-sources': { path: '/admin/automation-v2/sources', queryParams: [] },
  'admin-automation-v2-providers': { path: '/admin/automation-v2/providers', queryParams: [] },
  'admin-automation-v2-content': { path: '/admin/automation-v2/content', queryParams: ['tab'] },
  'admin-automation-v2-settings': { path: '/admin/automation-v2/settings', queryParams: [] },

  // Automation — Legacy aliases (backward compat — same URLs, different route names)
  'admin-automation-templates': { path: '/admin/automation/blog/templates', queryParams: [] },
  'admin-automation-template-editor': { path: '/admin/automation/blog/templates/editor', queryParams: [] },
  'admin-automation-pipelines': { path: '/admin/automation/blog/pipelines', queryParams: [] },
  'admin-automation-pipeline-detail': { path: '/admin/automation/blog/pipelines/{pipelineId}', queryParams: [] },
  'admin-automation-rules': { path: '/admin/automation/settings/rules', queryParams: [] },
  'admin-automation-rule-editor': { path: '/admin/automation/settings/rules/editor', queryParams: [] },
  'admin-automation-logs': { path: '/admin/automation/settings/logs', queryParams: [] },
  'admin-automation-review': { path: '/admin/automation/blog/review', queryParams: [] },
  'admin-automation-schedules': { path: '/admin/automation/blog/schedules', queryParams: [] },
}

const PARAM_REGEX = /\{(\w+)\}/g

// Pre-sort once at module load: longer paths (more specific) match before shorter ones
const SORTED_ROUTE_ENTRIES = (Object.entries(ROUTE_DEFS) as [RoutePath, RouteDef][]).sort(
  (a, b) => {
    const aDepth = (a[1].path.match(/\//g) || []).length
    const bDepth = (b[1].path.match(/\//g) || []).length
    return bDepth - aDepth
  }
)

export function routeToUrl(route: RoutePath, params: RouteParams): string {
  const def = ROUTE_DEFS[route]
  if (!def) return '/'

  let path = def.path
  const usedParams = new Set<string>()

  path = path.replace(PARAM_REGEX, (_, key: keyof RouteParams) => {
    usedParams.add(key)
    return encodeURIComponent(params[key] || '')
  })

  const qsParams: string[] = []
  for (const key of def.queryParams) {
    const val = params[key]
    if (val !== undefined && val !== '') {
      qsParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    }
  }

  if (qsParams.length > 0) {
    path += '?' + qsParams.join('&')
  }

  return path
}

function matchPath(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.replace(/^\/+/, '').split('/').filter(Boolean)
  const patternParts = pattern.replace(/^\/+/, '').split('/').filter(Boolean)

  if (pathParts.length !== patternParts.length) return null

  const matches: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const paramMatch = patternPart.match(/^\{(\w+)\}$/)

    if (paramMatch) {
      matches[paramMatch[1]] = decodeURIComponent(pathParts[i])
    } else if (patternPart !== pathParts[i]) {
      return null
    }
  }

  return matches
}

export function parseUrl(
  pathname: string,
  searchParams?: URLSearchParams,
): { route: RoutePath; params: RouteParams } | null {
  for (const [route, def] of SORTED_ROUTE_ENTRIES) {
    const pathParams = matchPath(pathname, def.path)
    if (pathParams === null) continue

    const params: RouteParams = { ...pathParams }

    if (searchParams) {
      for (const key of def.queryParams) {
        const val = searchParams.get(key)
        if (val !== null) {
          (params as Record<string, string>)[key] = val
        }
      }
    }

    return { route, params }
  }

  return null
}

export function getSiteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}
