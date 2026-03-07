// cortex/frontend/src/stores/heartbeat.ts
import { create } from 'zustand'
import { useServicesStore } from './services'

interface HeartbeatState {
  events: string[]
  latest: string | null
  connect: () => void
}

export const useHeartbeat = create<HeartbeatState>((set) => ({
  events: [],
  latest: null,
  connect: () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/heartbeat`)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'services:refresh') {
        useServicesStore.getState().refresh()
      }
      const line = `${data.ts?.slice(11, 19) ?? ''} · ${data.type} · ${data.msg}`
      set(s => ({ latest: line, events: [line, ...s.events].slice(0, 200) }))
    }
    ws.onclose = () => setTimeout(() => useHeartbeat.getState().connect(), 3000)
  },
}))
