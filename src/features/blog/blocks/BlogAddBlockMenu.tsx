'use client'

import React, { useState } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { blogBlockTypeConfig } from './blog-block-types'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'

export function BlogAddBlockMenu({
  onAdd,
  allowedBlocks,
}: {
  onAdd: (type: BlogContentBlock['type']) => void
  allowedBlocks?: BlogContentBlock['type'][]
}) {
  const [open, setOpen] = useState(false)

  const allTypes: BlogContentBlock['type'][] = Object.keys(blogBlockTypeConfig) as BlogContentBlock['type'][]
  const types = allowedBlocks ?? allTypes

  return (
    <div className="space-y-0">
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
          'border-2 border-dashed border-border/50 hover:border-emerald-400/60',
          'text-sm text-muted-foreground hover:text-emerald-600',
          'bg-transparent hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10',
          'transition-all duration-200',
        )}
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-4 w-4" />
        ব্লক যোগ করুন
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' } as const}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  ব্লকের ধরন নির্বাচন করুন
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {types.map((type, idx) => {
                  const config = blogBlockTypeConfig[type]
                  const Icon = config.icon
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all',
                        'border border-border/40 hover:border-border',
                        'bg-card hover:shadow-md',
                        'group/card',
                      )}
                      onClick={() => {
                        onAdd(type)
                        setOpen(false)
                      }}
                    >
                      <div className={cn(
                        'p-2.5 rounded-xl transition-transform group-hover/card:scale-110',
                        config.bg,
                      )}>
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{config.bnLabel}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{config.description}</div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3 w-3" />
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
