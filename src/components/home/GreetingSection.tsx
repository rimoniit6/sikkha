'use client'

import { useEffect, useState } from 'react'
import { BookOpen, GraduationCap, Sparkles, Sun, Moon, CloudSun } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLearningPreference } from '@/providers/LearningPreferenceProvider'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { cn } from '@/lib/utils'

function getTimeGreeting(): { text: string; Icon: typeof Sun } {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'শুভ সকাল', Icon: Sun }
  if (hour < 17) return { text: 'শুভ বিকাল', Icon: CloudSun }
  return { text: 'শুভ সন্ধ্যা', Icon: Moon }
}

export default function GreetingSection() {
  const user = useAuthStore((s) => s.user)
  const { classLevel } = useLearningPreference()
  const { getClassName } = useHierarchyMetadata()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  const { text: greeting, Icon: GreetingIcon } = getTimeGreeting()
  const isAuthenticated = !!user
  const displayName = user?.name || ''
  const firstName = displayName.split(' ')[0]
  const classLabel = classLevel ? getClassName(classLevel) : null

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04]" 
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}
        aria-hidden="true"
      />
      
      {/* Decorative circles */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-white/5" aria-hidden="true" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5" aria-hidden="true" />

      <div className="relative z-10 container-app py-6 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Greeting */}
          <div className="flex-1 min-w-0">
            {/* Greeting + Name */}
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon className="w-5 h-5 text-white/80" />
              <span className="text-sm font-medium text-white/80">
                {greeting}
                {isAuthenticated && firstName ? `, ${firstName}` : ''}
              </span>
            </div>

            {/* Main message */}
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mt-1">
              {isAuthenticated
                ? 'আজ কী শিখবেন?'
                : 'শিখতে শুরু করুন!'}
            </h1>

            {/* Subtitle */}
            <p className="text-sm text-white/70 mt-1.5 max-w-md leading-relaxed">
              {isAuthenticated
                ? classLabel
                  ? `${classLabel} — আপনার জন্য প্রস্তুত কন্টেন্ট`
                  : 'আপনার জন্য প্রস্তুত কন্টেন্ট'
                : '৮০% কনটেন্ট বিনামূল্যে — এখনই শুরু করুন'}
            </p>

            {/* Class badge */}
            {isAuthenticated && classLabel && (
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/10">
                <GraduationCap className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs font-medium text-white/80">{classLabel}</span>
              </div>
            )}
          </div>

          {/* Right: Motivational icon */}
          <div className="shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-7 h-7 text-yellow-300" />
          </div>
        </div>
      </div>
    </section>
  )
}
