
import {
  BookOpen, HelpCircle, Lightbulb, FileText,
  GraduationCap, Brain, BookOpenCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, toBengaliNumerals } from '@/lib/utils'
import type { ChapterData } from '@/hooks/use-chapter-data'

interface StatDef {
  icon: React.ElementType
  label: string
  count: number
  gradient: string
}

function StatCard({ icon: Icon, label, count, gradient, delay }: StatDef & { delay: number }) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${delay}s` }}>
      <Card className="border-border/50 hover:shadow-md transition-shadow duration-300">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn('p-3 rounded-xl bg-gradient-to-br', gradient, 'shadow-sm')}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{toBengaliNumerals(count)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ChapterStats({ chapter }: { chapter: ChapterData }) {
  const stats: StatDef[] = [
    { icon: BookOpen, label: 'Lectures', count: chapter.lectureCount, gradient: 'from-blue-500 to-cyan-500' },
    { icon: HelpCircle, label: 'MCQ', count: chapter.mcqCount, gradient: 'from-orange-500 to-red-500' },
    { icon: Lightbulb, label: 'CQ', count: chapter.cqCount, gradient: 'from-violet-500 to-purple-500' },
    { icon: FileText, label: 'Board Questions', count: chapter.boardQuestionCount, gradient: 'from-orange-500 to-amber-500' },
    { icon: Brain, label: 'Knowledge Questions', count: chapter.contentCounts['short-questions'] || 0, gradient: 'from-pink-500 to-rose-500' },
    { icon: GraduationCap, label: 'Suggestions', count: chapter.contentCounts['suggestion'] || 0, gradient: 'from-indigo-500 to-blue-500' },
    { icon: BookOpenCheck, label: 'Exams', count: chapter.contentCounts['exam'] || 0, gradient: 'from-teal-500 to-emerald-500' },
  ]

  // Only show stats with actual content — hide cards with zero count
  const visibleStats = stats.filter((s) => s.count > 0)

  if (visibleStats.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-6">
      {visibleStats.map((s, i) => (
        <StatCard key={s.label} {...s} delay={0.05 * i} />
      ))}
    </div>
  )
}
