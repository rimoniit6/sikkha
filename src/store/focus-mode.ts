import { create } from 'zustand'

interface FocusModeState {
  active: boolean
  startedAt: Date | null
}

interface FocusModeActions {
  enterFocusMode: () => void
  exitFocusMode: () => void
  resetFocusMode: () => void
}

type FocusModeStore = FocusModeState & FocusModeActions

export const useFocusMode = create<FocusModeStore>((set) => ({
  // ── State ──
  active: false,
  startedAt: null,

  // ── Actions ──
  enterFocusMode: () =>
    set({ active: true, startedAt: new Date() }),

  exitFocusMode: () =>
    set({ active: false, startedAt: null }),

  resetFocusMode: () =>
    set({ active: false, startedAt: null }),
}))
