'use client'

import { BookOpen, ClipboardCheck, FileQuestion, Search } from 'lucide-react'
import { useRouterStore } from '@/store/router'

interface QuickAction {
  icon: React.ElementType
  label: string
  description: string
  route: Parameters<ReturnType<typeof useRouterStore.getState>['navigate']>[0]
  color: string
  bgColor: string
  hoverBg: string
}

const actions: QuickAction[] = [
  {
    icon: BookOpen,
    label: 'ভিডিও ক্লাস',
    description: 'লেকচার দেখুন',
    route: 'class-list',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
  },
  {
    icon: ClipboardCheck,
    label: 'MCQ প্র্যাকটিস',
    description: 'প্রশ্ন সমাধান করুন',
    route: 'exam-center',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-100 dark:bg-sky-900/40',
    hoverBg: 'hover:bg-sky-50 dark:hover:bg-sky-900/30',
  },
  {
    icon: FileQuestion,
    label: 'বোর্ড প্রশ্ন',
    description: 'পূর্বের বছরগুলোর প্রশ্ন',
    route: 'board-questions',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/30',
  },
  {
    icon: Search,
    label: 'অনুসন্ধান',
    description: 'যেকোনো কিছু খুঁজুন',
    route: 'search',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/40',
    hoverBg: 'hover:bg-violet-50 dark:hover:bg-violet-900/30',
  },
]

export default function QuickActionsSection() {
  const navigate = useRouterStore((s) => s.navigate)

  return (
    <section className="py-4 bg-background" aria-label="দ্রুত অ্যাকশন">
      <div className="container-app">
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.route}
                onClick={() => {
                  if (action.route === 'search') {
                    navigate('search', { searchQuery: '' })
                  } else {
                    navigate(action.route as any)
                  }
                }}
                className={`flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3.5 transition-all duration-200 active:scale-[0.98] hover:shadow-sm ${action.hoverBg} hover:border-emerald-200/50 dark:hover:border-emerald-800/30 text-left group cursor-pointer`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${action.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
