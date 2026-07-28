'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { LoadingContext } from '@/context/LoadingContext'
import { createLoadingManager } from '@/lib/loading-manager'
import { LoadingOverlay } from '@/components/loading/LoadingOverlay'
import type {
  LoadingOptions,
  LoadingMode,
  LoadingContextType,
} from '@/types/loading'

interface LoadingProviderProps {
  children: React.ReactNode
}

export default function LoadingProvider({
  children,
}: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgressState] = useState(0)
  const [message, setMessageState] = useState('')
  const [priority, setPriority] = useState<LoadingContextType['priority']>('low')
  const [mode, setModeState] = useState<LoadingMode>('fake')

  // Create manager inside useEffect so StrictMode double-mount creates a fresh one
  // instead of operating on a destroyed manager from the previous mount.
  const managerRef = useRef<ReturnType<typeof createLoadingManager> | null>(null)

  useEffect(() => {
    const manager = createLoadingManager()
    managerRef.current = manager

    const unsub = manager.subscribe((state) => {
      setIsLoading(state.isLoading)
      setProgressState(state.progress)
      setMessageState(state.message)
      setPriority(state.priority)
      setModeState(state.mode)
    })

    return () => {
      unsub()
      manager.destroy()
      managerRef.current = null
    }
  }, [])

  const getManager = useCallback(() => {
    // Fallback: if manager is somehow null (e.g., called during SSR before effect),
    // create a throwaway instance rather than throwing.
    return managerRef.current ?? createLoadingManager()
  }, [])

  const startLoading = useCallback((options?: LoadingOptions): string => {
    return getManager().startLoading(options)
  }, [getManager])

  const stopLoading = useCallback((id: string) => {
    getManager().stopLoading(id)
  }, [getManager])

  const withLoading = useCallback(
    <T,>(fn: () => Promise<T>, options?: LoadingOptions): Promise<T> => {
      return getManager().withLoading(fn, options)
    },
    [getManager],
  )

  const setProgress = useCallback((value: number) => {
    getManager().setProgress(value)
  }, [getManager])

  const setMessage = useCallback((text: string) => {
    getManager().setMessage(text)
  }, [getManager])

  const setMode = useCallback((newMode: LoadingMode) => {
    getManager().setMode(newMode)
  }, [getManager])

  const reset = useCallback(() => {
    getManager().reset()
  }, [getManager])

  const contextValue = useMemo<LoadingContextType>(
    () => ({
      startLoading,
      stopLoading,
      withLoading,
      setProgress,
      setMessage,
      setMode,
      reset,
      isLoading,
      progress,
      message,
      priority,
      mode,
    }),
    [
      startLoading,
      stopLoading,
      withLoading,
      setProgress,
      setMessage,
      setMode,
      reset,
      isLoading,
      progress,
      message,
      priority,
      mode,
    ],
  )

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      {isLoading && <LoadingOverlay />}
    </LoadingContext.Provider>
  )
}
