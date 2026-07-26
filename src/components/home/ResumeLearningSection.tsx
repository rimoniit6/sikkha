'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api-client'
import { useAuthUser } from '@/store/auth'
import { useRouterStore } from '@/store/router'

interface RecentLecture {
  id: string
  title: string
  subject: string
  chapter?: string
  progress: number
  viewedAt?: string
}

export default function ResumeLearningSection() {
  const user = useAuthUser()
  const navigate = useRouterStore((s) => s.navigate)
  const [lectures, setLectures] = useState<RecentLecture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    api.get<RecentLecture[]>('user/recent-lectures')
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setLectures(data)
        }
      })
      .catch(() => {
        if (!cancelled) setLectures([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id])

  if (loading) return null
  if (lectures.length === 0) return null

  // Show only top 8, sorted by progress ascending (least finished first)
  const sorted = [...lectures].sort((a, b) => a.progress - b.progress).slice(0, 8)

  return (
    <section className="py-5 bg-background" aria-labelledby="resume-learning-title">
      <div className="container-app">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 id="resume-learning-title" className="text-base sm:text-lg font-bold text-foreground leading-tight">
                চালিয়ে যান
              </h2>
              <p className="text-xs text-muted-foreground">{lectures.length}টি লেকচার বাকি</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('class-list')}
            className="gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0"
          >
            সব দেখুন
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 no-scrollbar -mx-4 px-4">
          {sorted.map((lecture) => (
            <button
              key={lecture.id}
              onClick={() => navigate('lecture-viewer', { lectureId: lecture.id })}
              className="snap-start shrink-0 w-[260px] sm:w-[280px] text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
              aria-label={`${lecture.title} — ${lecture.progress}% সম্পন্ন`}
            >
              <Card variant="compact" className="h-full border-border/50 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200">
                <CardContent className="p-3.5 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                      <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {lecture.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {lecture.subject}
                        {lecture.chapter ? ` › ${lecture.chapter}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <Progress
                      value={lecture.progress}
                      className="h-2 flex-1 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-500"
                    />
                    <span className="text-xs font-medium text-muted-foreground min-w-[2.5rem] text-right tabular-nums">
                      {lecture.progress}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
