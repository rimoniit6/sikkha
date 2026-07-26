'use client'

import { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { useQueryClient } from '@tanstack/react-query'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'

export type LearningMode = 'CLASS_BASED' | 'GLOBAL'

interface LearningPreference {
  learningMode: LearningMode | null
  classLevel: string | null
  isLoading: boolean
  isOnboarded: boolean
  setPreference: (mode: LearningMode, classLevel?: string | null) => Promise<void>
  clearPreference: () => Promise<void>
}

const LearningPreferenceContext = createContext<LearningPreference>({
  learningMode: null,
  classLevel: null,
  isLoading: true,
  isOnboarded: false,
  setPreference: async () => {},
  clearPreference: async () => {},
})

export function useLearningPreference() {
  return useContext(LearningPreferenceContext)
}

function invalidateContentCache(queryClient: ReturnType<typeof useQueryClient>) {
  const prefixes = ['subjects', 'chapters', 'lectures', 'mcq', 'cq', 'courses', 'board-questions', 'suggestions', 'search', 'packages', 'bundles', 'mcq-exam-packages', 'cq-exam-packages', 'user']
  queryClient.invalidateQueries({ predicate: (query) => {
    const key = query.queryKey[0]
    return typeof key === 'string' && prefixes.includes(key)
  }})
}

export function LearningPreferenceProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const updateUser = useAuthStore((s) => s.updateUser)
  const queryClient = useQueryClient()
  const [learningMode, setLearningMode] = useState<LearningMode | null>(null)
  const [classLevel, setClassLevel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardedRef = useRef(false)

  const fetchPreference = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/user/learning-preference')
      if (res.ok) {
        const body = await res.json()
        const data = body.data ?? body
        const mode = data.learningMode as LearningMode | null
        const level = data.classLevel as string | null
        setLearningMode(mode)
        setClassLevel(level)

        if (!mode) {
          setShowOnboarding(true)
        } else {
          onboardedRef.current = true
          setShowOnboarding(false)
        }
      } else {
        setShowOnboarding(true)
      }
    } catch {
      setShowOnboarding(true)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPreference()
    } else {
      setIsLoading(false)
      setShowOnboarding(false)
      setLearningMode(null)
      setClassLevel(null)
    }
  }, [isAuthenticated, user, fetchPreference])

  const setPreference = useCallback(async (mode: LearningMode, classLevel?: string | null) => {
    const body: Record<string, unknown> = { learningMode: mode }
    if (classLevel !== undefined) body.classLevel = classLevel

    const res = await fetch('/api/user/learning-preference', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save preference' }))
      throw new Error(err.error || 'Failed to save preference')
    }

    setLearningMode(mode)
    setClassLevel(classLevel ?? null)
    onboardedRef.current = true
    setShowOnboarding(false)

    updateUser({ learningMode: mode, classLevel: classLevel ?? undefined })
    invalidateContentCache(queryClient)
  }, [updateUser, queryClient])

  const clearPreference = useCallback(async () => {
    await fetch('/api/user/learning-preference', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learningMode: 'GLOBAL', classLevel: null }),
    })
    setLearningMode('GLOBAL')
    setClassLevel(null)
    updateUser({ learningMode: 'GLOBAL', classLevel: undefined })
    invalidateContentCache(queryClient)
  }, [updateUser, queryClient])

  const isOnboarded = !!learningMode

  return (
    <LearningPreferenceContext.Provider value={{ learningMode, classLevel, isLoading, isOnboarded, setPreference, clearPreference }}>
      {children}
      <OnboardingModal
        open={showOnboarding && isAuthenticated}
        onComplete={setPreference}
        onSkip={() => setPreference('GLOBAL')}
      />
    </LearningPreferenceContext.Provider>
  )
}
