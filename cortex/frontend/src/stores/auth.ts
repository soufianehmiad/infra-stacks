// cortex/frontend/src/stores/auth.ts
import { create } from 'zustand'
import { api } from '../lib/api'

interface AuthState {
  authenticated: boolean
  checking: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  check: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  authenticated: false,
  checking: true,

  check: async () => {
    try {
      await api.get('/services/')
      set({ authenticated: true, checking: false })
    } catch {
      set({ authenticated: false, checking: false })
    }
  },

  login: async (username, password) => {
    await api.auth.login(username, password)
    set({ authenticated: true })
  },

  logout: async () => {
    await api.auth.logout()
    set({ authenticated: false })
  },
}))
