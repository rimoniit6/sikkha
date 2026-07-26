'use client'

import { memo } from 'react'
import { Flame, Trophy, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { StudyStreak as StudyStreakData } from '@/types/user-dashboard'

interface StudyStreakProps {
  streak: StudyStreakData
}

function DayCell({ active, day, isToday }: { active: boolean; day: string; isToday: boolean }) {
  const dayNames: Record<string, string> = {
    '0': 'রবি', '1': 'সোম', '2': 'মঙ্গল', '3': 'বুধ', '4': 'বৃহ', '5': 'শুক্র', '6': 'শনি',
  }
  const dayIndex = new Date(day).getDay()
  const label = dayNames[dayIndex] || ''

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
          active
            ? isToday
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/30 scale-110'
              : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-400/20'
            : 'bg-muted/40 border border-border/40'
        }`}
      >
        {active && (
          <div className={`w-1.5 h-1.5 rounded-full bg-white ${isToday ? 'animate-pulse-soft' : ''}`} />
        )}
      </div>
    </div>
  )
}

function StudyStreakComponent({ streak }: StudyStreakProps) {
  // Generate last 7 days
  const last7: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last7.push(d.toISOString().slice(0, 10))
  }

  const today = new Date().toISOString().slice(0, 10)
  const activeSet = new Set(streak.activeDates)

  return (
    <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
      <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 opacity-60" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-400/30">
              <Flame className="size-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                Study Streak
                {streak.currentStreak >= 7 && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                    হট Streak!
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">টানা পড়ার অভ্যাস</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                {streak.currentStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">দিন</p>
            </div>
            <div className="w-px h-10 bg-border/50" />
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <Trophy className="size-3.5 text-amber-500" />
                <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {streak.longestStreak}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">সর্বোচ্চ</p>
            </div>
          </div>
        </div>

        {/* 7-day mini grid */}
        <div className="flex items-center justify-between px-1">
          {last7.map((day) => (
            <DayCell
              key={day}
              day={day}
              active={activeSet.has(day)}
              isToday={day === today}
            />
          ))}
        </div>

        {/* Daily tip based on streak */}
        <div className="mt-3.5 flex items-center gap-2 text-xs text-muted-foreground bg-background/50 dark:bg-background/20 rounded-lg px-3 py-2">
          <Zap className="size-3.5 shrink-0 text-amber-500" />
          <span>
            {streak.currentStreak === 0
              ? 'আজ পড়া শুরু করুন! প্রতিদিন পড়লে অভ্যাস গড়ে ওঠে।'
              : streak.currentStreak < 3
                ? 'টানা পড়া চালিয়ে যান! ৩ দিনে অভ্যাস শুরু হয়।'
                : streak.currentStreak < 7
                  ? 'দারুণ! আপনি একটি অভ্যাস গড়ে তুলছেন।'
                  : streak.currentStreak < 14
                    ? 'চমৎকার! ৭ দিনের streak! এখন এটা অভ্যাস।'
                    : 'অসাধারণ! আপনি একজন নিয়মিত শিক্ষার্থী!'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export const StudyStreak = memo(StudyStreakComponent)
