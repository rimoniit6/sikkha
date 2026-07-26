'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AchievementDefinition, UserAchievementState } from '@/types/achievements'
import { CATEGORY_LABELS } from '@/types/achievements'

// Dynamic icon mapper (Lucide)
import {
  Zap, Flame, Award, Trophy, BookOpen, GraduationCap, Library,
  FileQuestion, BrainCircuit, Target, Crosshair, FileText,
  RefreshCw, CalendarCheck, CalendarDays, Clock, Timer,
  Sunrise, Moon, Sparkles,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Flame, Award, Trophy, BookOpen, GraduationCap, Library,
  FileQuestion, BrainCircuit, Target, Crosshair, FileText,
  RefreshCw, CalendarCheck, CalendarDays, Clock, Timer,
  Sunrise, Moon, Sparkles,
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  bronze: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    gradient: 'from-amber-600 to-amber-800',
  },
  silver: {
    bg: 'bg-slate-200 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-400 dark:border-slate-600',
    gradient: 'from-slate-500 to-slate-700',
  },
  gold: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-400 dark:border-yellow-600',
    gradient: 'from-yellow-500 via-amber-500 to-orange-600',
  },
  diamond: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-400 dark:border-cyan-600',
    gradient: 'from-cyan-400 via-blue-500 to-violet-600',
  },
}

interface AchievementUnlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: AchievementDefinition
  userState: UserAchievementState | null
  onClaim?: () => void
  claiming?: boolean
}

export function AchievementUnlockDialog({
  open,
  onOpenChange,
  definition,
  userState,
  onClaim,
  claiming,
}: AchievementUnlockDialogProps) {
  const Icon = ICON_MAP[definition.icon] || Sparkles
  const tier = TIER_COLORS[definition.tier]
  const isClaimed = userState?.claimedAt

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <div className="py-6">
          {/* Icon with gradient background */}
          <div className={cn(
            'mx-auto w-20 h-20 rounded-full bg-gradient-to-br flex items-center justify-center mb-4',
            'motion-safe:animate-bounce-soft',
            tier.gradient,
          )}>
            <Icon className="size-9 text-white" />
          </div>

          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              🎉 অর্জন আনলক!
            </DialogTitle>
            <DialogDescription className="text-base font-semibold mt-2">
              {definition.title}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mt-2 px-4">
            {definition.description}
          </p>

          {/* Category + Tier badges */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[definition.category]}
            </Badge>
            <Badge className={cn('text-xs capitalize', tier.bg, tier.text, tier.border)}>
              {definition.tier}
            </Badge>
          </div>

          {/* Claim button */}
          {!isClaimed && onClaim && (
            <Button
              className="mt-6 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              onClick={onClaim}
              disabled={claiming}
            >
              {claiming ? 'দাবি করা হচ্ছে...' : 'পুরস্কার দাবি করুন'}
            </Button>
          )}
          {isClaimed && (
            <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ ইতিমধ্যে দাবি করা হয়েছে
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
