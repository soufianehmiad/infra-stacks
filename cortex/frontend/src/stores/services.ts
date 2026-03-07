// cortex/frontend/src/stores/services.ts
import { create } from 'zustand'
import { api, Service } from '../lib/api'

const LS_KEY = 'cortex:services'

function loadFromStorage(): Service[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveToStorage(services: Service[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(services))
  } catch {}
}

interface ServicesState {
  services: Service[]
  loading: boolean    // true only when we have NO data at all (first ever load)
  error: string | null
  refresh: () => Promise<void>
}

const _initial = loadFromStorage()

export const useServicesStore = create<ServicesState>((set) => ({
  services: _initial,
  loading: _initial.length === 0,
  error: null,

  refresh: async () => {
    try {
      const fresh = await api.services.list()
      saveToStorage(fresh)
      set({ services: fresh, loading: false, error: null })
    } catch {
      set({ loading: false, error: 'Failed to load services' })
    }
  },
}))

// Trigger initial fetch at module load (runs once)
useServicesStore.getState().refresh()
