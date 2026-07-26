'use client'

import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShallowAuth } from '@/store/auth'
import { useRouterStore } from '@/store/router'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { fetchCsrfToken } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateLearningCaches } from '@/lib/invalidate-learning-caches'

interface BookmarkButtonProps {
  contentId: string
  contentType: 'mcq' | 'cq' | 'lecture'
  contentTitle?: string
  size?: 'sm' | 'md' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'ghost' | 'minimal'
  className?: string
  initialBookmarked?: boolean
  onToggle?: (bookmarked: boolean) => void
}

export default function BookmarkButton({
  contentId,
  contentType,
  contentTitle,
  size = 'icon',
  variant = 'ghost',
  className,
  initialBookmarked,
  onToggle,
}: BookmarkButtonProps) {
  const { user, isAuthenticated } = useShallowAuth()
  const navigate = useRouterStore((s) => s.navigate)
  const { toast } = useToast()
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked || false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(initialBookmarked !== undefined)
  const queryClient = useQueryClient()

  // Check bookmark status from API if not provided
  useEffect(() => {
    if (initialBookmarked !== undefined) {
      setIsBookmarked(initialBookmarked)
      setChecked(true)
      return
    }
    if (!user?.id) { setChecked(true); return }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/bookmarks/check?contentId=${contentId}&contentType=${contentType}`)
        if (res.ok) {
          const data = await res.json()
          setIsBookmarked(data.data?.isBookmarked || false)
        }
      } catch { /* ignore */ }
      finally { setChecked(true) }
    }
    checkStatus()
  }, [contentId, contentType, user?.id, initialBookmarked])

  const handleToggle = async () => {
    if (!isAuthenticated) {
      toast({ title: 'লগইন প্রয়োজন', description: 'বুকমার্ক করতে লগইন করুন' })
      navigate('login')
      return
    }

    setLoading(true)
    try {
      const csrfToken = await fetchCsrfToken()
      const res = await fetch('/api/bookmarks', {
        method: isBookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, contentType, _csrf: csrfToken }),
      })
      if (res.ok) {
        const newStatus = !isBookmarked
        setIsBookmarked(newStatus)
        onToggle?.(newStatus)
        invalidateLearningCaches(queryClient)
        toast({
          title: newStatus ? 'বুকমার্ক যোগ হয়েছে' : 'বুকমার্ক সরানো হয়েছে',
          description: newStatus
            ? `${contentTitle || 'কন্টেন্ট'} সেভ করা হয়েছে`
            : `${contentTitle || 'কন্টেন্ট'} সেভ থেকে সরানো হয়েছে`,
          duration: 2000,
        })
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  if (!checked) return null

  const sizeMap = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
    icon: 'size-5',
  }

  const buttonSizeMap: Record<string, 'default' | 'sm' | 'lg' | 'icon'> = {
    sm: 'sm',
    md: 'default',
    lg: 'lg',
    icon: 'icon',
  }

  const buttonVariant = variant === 'minimal' ? 'ghost' : variant

  return (
    <Button
      variant={buttonVariant}
      size={buttonSizeMap[size]}
      className={cn(
        'gap-1.5 transition-all duration-200',
        isBookmarked && 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
        variant === 'minimal' && 'h-auto p-0 hover:bg-transparent shadow-none',
        className,
      )}
      onClick={handleToggle}
      disabled={loading}
      aria-label={isBookmarked ? 'বুকমার্ক সরান' : 'বুকমার্ক করুন'}
    >
      <Bookmark className={cn(sizeMap[size], isBookmarked ? 'fill-current' : '')} />
      {size !== 'icon' && variant !== 'minimal' && (
        <span className="text-sm">{isBookmarked ? 'সেভ করা' : 'সেভ করুন'}</span>
      )}
    </Button>
  )
}
