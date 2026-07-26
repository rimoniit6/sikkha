'use client'

import { Clock, Eye, BookOpen, HelpCircle, FileQuestion, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouterStore } from '@/store/router'
import { useRecentlyViewed } from '@/hooks/user/use-recently-viewed'

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  lecture: { icon: BookOpen, label: 'লেকচার', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40' },
  mcq: { icon: HelpCircle, label: 'MCQ', color: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40' },
  cq: { icon: FileQuestion, label: 'CQ', color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40' },
  boardQuestion: { icon: FileQuestion, label: 'বোর্ড প্রশ্ন', color: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40' },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Eye, label: type, color: 'text-muted-foreground bg-muted' }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'এইমাত্র'
    if (minutes < 60) return `${minutes} মি. আগে`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} ঘ. আগে`
    const days = Math.floor(hours / 24)
    return `${days} দিন আগে`
  } catch {
    return ''
  }
}

export default function RecentActivitySection() {
  const navigate = useRouterStore((s) => s.navigate)
  const { data: items, loading } = useRecentlyViewed({ limit: 10 })

  if (loading) return null
  if (items.length === 0) return null

  const visibleItems = items.slice(0, 6)

  const handleClick = (item: typeof visibleItems[0]) => {
    switch (item.contentType) {
      case 'lecture':
        navigate('lecture-viewer', { lectureId: item.contentId })
        break
      case 'mcq':
      case 'boardQuestion':
        navigate('board-questions', { mcqId: item.contentId })
        break
      case 'cq':
        navigate('cq-viewer', { cqId: item.contentId })
        break
      default:
        break
    }
  }

  return (
    <section className="py-5 bg-background" aria-labelledby="recent-activity-title">
      <div className="container-app">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 id="recent-activity-title" className="text-base sm:text-lg font-bold text-foreground">
            সাম্প্রতিক কার্যকলাপ
          </h2>
        </div>

        <div className="space-y-2">
          {visibleItems.map((item) => {
            const config = getTypeConfig(item.contentType)
            const Icon = config.icon
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className="w-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
              >
                <Card variant="compact" className="border-border/40 hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:shadow-sm transition-all duration-200 cursor-pointer">
                  <CardContent className="p-3 sm:p-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground">
                            {config.label}
                          </Badge>
                          {item.viewedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(item.viewedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
