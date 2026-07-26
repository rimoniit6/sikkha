'use client'

import { useState, useCallback } from 'react'
import { useAuthUser } from '@/store/auth'
import { api } from '@/lib/api-client'

interface UseDashboardProfileResult {
  editProfileOpen: boolean
  setEditProfileOpen: (open: boolean) => void
  editName: string
  setEditName: (name: string) => void
  editMobile: string
  setEditMobile: (mobile: string) => void
  updatingProfile: boolean
  handleEditProfile: () => Promise<void>
  openEditProfile: () => void
}

/**
 * Manages profile editing state and submission.
 */
export function useDashboardProfile(): UseDashboardProfileResult {
  const user = useAuthUser()
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)

  const handleEditProfile = useCallback(async () => {
    if (!user?.id) return
    setUpdatingProfile(true)
    try {
      await api.patch('user/profile', { name: editName, phone: editMobile })
      window.location.reload()
    } catch (err) {
      console.error('[useDashboardProfile] Failed to update:', err)
    } finally {
      setUpdatingProfile(false)
    }
  }, [user?.id, editName, editMobile])

  const openEditProfile = useCallback(() => {
    setEditName(user?.name || '')
    setEditMobile((user as any)?.phone || (user as any)?.mobile || '')
    setEditProfileOpen(true)
  }, [user])

  return {
    editProfileOpen,
    setEditProfileOpen,
    editName,
    setEditName,
    editMobile,
    setEditMobile,
    updatingProfile,
    handleEditProfile,
    openEditProfile,
  }
}
