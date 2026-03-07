// cortex/frontend/src/stores/ui.ts
import { create } from 'zustand'

export type Section = 'home' | 'services' | 'kubernetes' | 'jobs' | 'media' | 'tunnels'

const VALID_SECTIONS: Section[] = ['home', 'services', 'kubernetes', 'jobs', 'media', 'tunnels']

function readHash(): Section {
  const h = window.location.hash.replace('#', '')
  return VALID_SECTIONS.includes(h as Section) ? (h as Section) : 'home'
}

interface UIState {
  section: Section
  setSection: (s: Section) => void
}

export const useUI = create<UIState>((set) => ({
  section: readHash(),
  setSection: (section) => {
    window.location.hash = section
    set({ section })
  },
}))

// Sync on browser back/forward
window.addEventListener('hashchange', () => {
  useUI.setState({ section: readHash() })
})
