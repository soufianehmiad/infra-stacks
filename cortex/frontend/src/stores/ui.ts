// cortex/frontend/src/stores/ui.ts
import { create } from 'zustand'

export type Section = 'home' | 'services' | 'jobs' | 'media' | 'tunnels'

interface UIState {
  section: Section
  setSection: (s: Section) => void
}

export const useUI = create<UIState>((set) => ({
  section: 'home',
  setSection: (section) => set({ section }),
}))
