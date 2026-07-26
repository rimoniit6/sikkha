'use client'

import { memo } from 'react'
import { Calendar, Clock, FileQuestion, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRouterStore } from '@/store/router'
import type { UpcomingExam } from '@/types/user-dashboard'

interface UpcomingExamsProps {
  exams: UpcomingExam[]
}

function UpcomingExamsComponent({ exams }: UpcomingExamsProps) {
  const navigate = useRouterStore((s) => s.navigate)

  if (exams.length === 0) return null

  const now = new Date()
  const sorted = [...exams].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'আজ'
    if (date.toDateString() === tomorrow.toDateString()) return 'আগামীকাল'

    const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 7) {
      const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
      return `${dayNames[date.getDay()]}বার`
    }

    return date.toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })
  }

  const getUrgency = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - now.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    if (days < 0) return { label: 'শুরু হয়েছে', variant: 'secondary' as const }
    if (days <= 1) return { label: 'আগামীকাল', variant: 'destructive' as const }
    if (days <= 3) return { label: 'শীঘ্রই', variant: 'secondary' as const }
    if (days <= 7) return { label: 'এই সপ্তাহে', variant: 'secondary' as const }
    return { label: 'আসছে', variant: 'outline' as const }
  }

  const handleExamClick = (exam: UpcomingExam) => {
    if (exam.type === 'mcq') {
      navigate('mcq-exam-package-detail', { packageId: exam.packageId })
    } else {
      navigate('cq-exam-package-detail', { packageId: exam.packageId })
    }
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400 opacity-60" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-md shadow-rose-400/30">
            <Calendar className="size-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg">আসন্ন পরীক্ষা</h3>
            <p className="text-xs text-muted-foreground">
              {sorted.length}টি পরীক্ষা আসছে
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {sorted.slice(0, 5).map((exam, idx) => {
            const urgency = getUrgency(exam.scheduledDate)
            return (
              <div
                key={exam.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 dark:bg-muted/10 cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => handleExamClick(exam)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleExamClick(exam) }}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  exam.type === 'mcq'
                    ? 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40'
                    : 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40'
                }`}>
                  {exam.type === 'mcq'
                    ? <Target className="size-4 text-teal-600 dark:text-teal-400" />
                    : <FileQuestion className="size-4 text-violet-600 dark:text-violet-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {exam.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {exam.packageTitle}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {exam.duration}মি
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {exam.totalMarks} মার্কস
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-xs font-semibold tabular-nums whitespace-nowrap">
                    {formatDate(exam.scheduledDate)}
                  </p>
                  <Badge variant={urgency.variant} className="text-[9px] px-1.5 py-0 h-4">
                    {urgency.label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export const UpcomingExams = memo(UpcomingExamsComponent)
