'use client'

import { useState } from 'react'
import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useNotifications, useUnreadNotificationCount, useMarkNotificationsRead } from '@/hooks/student/use-notifications'
import { useRouterStore } from '@/store/router'
import type { RoutePath } from '@/store/router'

const TYPE_ICONS: Record<string, typeof Bell> = {
  INFO: Info,
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
}

const TYPE_COLORS: Record<string, string> = {
  INFO: 'text-blue-500',
  SUCCESS: 'text-green-500',
  WARNING: 'text-yellow-500',
  ERROR: 'text-red-500',
}

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  critical: { label: 'জরুরি', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  high: { label: 'গুরুত্বপূর্ণ', className: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
  medium: { label: 'মাঝারি', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  low: { label: 'সাধারণ', className: 'bg-gray-500/15 text-gray-500 border-gray-500/30' },
}

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-2 border-l-red-500',
  high: 'border-l-2 border-l-orange-500',
  medium: '',
  low: '',
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'এখনই'
  if (diffMins < 60) return `${diffMins} মিনিট আগে`
  if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`
  if (diffDays < 7) return `${diffDays} দিন আগে`
  return date.toLocaleDateString('bn-BD')
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useRouterStore((s) => s.navigate)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const { data: notificationsData } = useNotifications({ limit: 10 })
  const markRead = useMarkNotificationsRead()

  const notifications = notificationsData?.notifications || []

  const handleMarkAllRead = () => {
    markRead.mutate({ markAll: true })
  }

  const handleNotificationClick = (notification: { link?: string | null; id: string }) => {
    // Mark as read
    if (!notification.link) {
      markRead.mutate({ ids: [notification.id] })
    }

    // Navigate if link exists
    if (notification.link) {
      // Extract route from link (e.g., "/admin/workflow/lecture/lec-1" → "admin-workflow")
      // For now, just mark as read — full routing will be added later
      markRead.mutate({ ids: [notification.id] })
    }

    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent transition-colors"
          aria-label={`নোটিফিকেশন${unreadCount > 0 ? ` (${unreadCount}টি অপঠিত)` : ''}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold bg-red-500 text-white border-2 border-background"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">নোটিফিকেশন</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllRead}
              disabled={markRead.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              সব পড়া হয়েছে
            </Button>
          )}
        </DropdownMenuLabel>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">কোনো নোটিফিকেশন নেই</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Info
                const iconColor = TYPE_COLORS[notification.type] || 'text-muted-foreground'

                return (
                  <button
                    key={notification.id}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                      !notification.isRead ? 'bg-accent/20' : ''
                    } ${PRIORITY_BORDER[notification.priority || 'medium']}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          {notification.priority && notification.priority !== 'medium' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_BADGES[notification.priority]?.className || ''}`}>
                              {PRIORITY_BADGES[notification.priority]?.label || notification.priority}
                            </span>
                          )}
                          {!notification.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
