// cortex/frontend/src/lib/api.ts
const BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  if (res.status === 401) {
    const refresh = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!refresh.ok) throw new ApiError(401, 'Unauthorized')
    return req(method, path, body)
  }
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export const api = {
  get:    <T>(path: string) => req<T>('GET', path),
  post:   <T>(path: string, body?: unknown) => req<T>('POST', path, body),
  put:    <T>(path: string, body?: unknown) => req<T>('PUT', path, body),
  delete: <T>(path: string) => req<T>('DELETE', path),

  auth: {
    login:   (username: string, password: string) =>
               api.post('/auth/login', { username, password }),
    logout:  () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
  },
  services: {
    list:   () => api.get<Service[]>('/services/'),
    action: (id: string, action: string) => api.post(`/services/${id}/action?action=${action}`),
  },
  tunnels: {
    list:          () => api.get<Tunnel[]>('/tunnels/'),
    control:       (name: string, action: string) => api.post(`/tunnels/${name}/control`, { action }),
    getConfig:     (name: string) => api.get(`/tunnels/${name}/config`),
    getLogs:       (name: string, lines?: number) => api.get<string[]>(`/tunnels/${name}/logs?lines=${lines ?? 150}`),
    updateIngress: (name: string, rules: unknown[]) => api.put(`/tunnels/${name}/ingress`, { rules }),
    expose:     (tunnel: string, hostname: string, internal_url: string) =>
                  api.post(`/tunnels/${tunnel}/expose`, { hostname, internal_url }),
    unexpose:   (tunnel: string, hostname: string) =>
                  api.delete(`/tunnels/${tunnel}/expose?hostname=${encodeURIComponent(hostname)}`),
    allIngress: () => api.get<Record<string, { tunnel: string; service: string }>>('/tunnels/ingress/all'),
  },
  media: {
    list: (params?: Record<string, unknown>) =>
      api.get<{ items: MediaFileRecord[]; total: number }>(`/media/?${new URLSearchParams(params as never)}`),
    get: (id: number) => api.get<MediaFileRecord>(`/media/${id}`),
  },
  jobs: {
    list:   () => api.get<JobRecord[]>('/jobs/'),
    create: (file_id: number, action: string) => api.post<JobRecord>('/jobs/', { file_id, action }),
    cancel: (id: number) => api.delete(`/jobs/${id}`),
  },
  storage: {
    current: () => api.get<StorageSnapshot[]>('/storage/'),
    history: (days = 30) => api.get<StorageSnapshot[]>(`/storage/history?days=${days}`),
  },
  proxmox: {
    nodes:   () => api.get<PveNode>('/proxmox/nodes'),
    storage: () => api.get<PveStorage[]>('/proxmox/storage'),
    lxc:     () => api.get<PveLxc[]>('/proxmox/lxc'),
  },
}

// Types
export interface Service {
  container_id: string; name: string; type: string; status: string
  port: number | null; path: string | null; url: string | null; icon: string | null
  category: string; host: string; public_url: string | null
}
export interface Tunnel {
  name: string; service: string; active: string; sub: string; running: boolean; description: string
}
export interface MediaFileRecord {
  id: number; path: string; filename: string; folder: string; size_bytes: number
  codec: string | null; resolution: string | null; duration: number | null
  audio: string | null; suggested_action: string | null; flagged: boolean
}
export interface JobRecord {
  id: number; file_id: number; action: string; status: string
  progress: number; eta_s: number | null; size_before: number | null; size_after: number | null
  created_at: string; finished_at: string | null; log: string
}
export interface StorageSnapshot {
  id: number; folder: string; used_bytes: number; total_bytes: number
  saved_bytes: number; taken_at: string
}
export interface PveNode {
  node: string; cpu_pct: number; mem_used: number; mem_total: number; uptime: number
}
export interface PveStorage {
  storage: string; type: string; used: number; total: number; avail: number; pct: number
}
export interface PveLxc {
  vmid: number; name: string; status: string; mem_used: number; mem_total: number
  disk_used: number; disk_total: number; uptime: number; cpu: number
}
