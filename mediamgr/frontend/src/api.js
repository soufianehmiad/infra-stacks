// import.meta.env.BASE_URL is '/mediamgr/' in production, '/' in dev
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') // → '/mediamgr' or ''

export async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res.json()
}

export const api = {
  files: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'all')
    ))
    return apiFetch(`/api/files?${q}`)
  },
  deleteFile: (id) => apiFetch(`/api/files/${id}`, { method: 'DELETE' }),

  startScan: () => apiFetch('/api/scan', { method: 'POST' }),
  scanStatus: () => apiFetch('/api/scan/status'),

  createJob: (file_id, action) =>
    apiFetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ file_id, action }),
    }),
  jobs: () => apiFetch('/api/jobs'),
  cancelJob: (id) => apiFetch(`/api/jobs/${id}`, { method: 'DELETE' }),

  storage: () => apiFetch('/api/storage'),
  storageHistory: (days = 30) => apiFetch(`/api/storage/history?days=${days}`),
}

export const cf = {
  tunnels: () => apiFetch('/api/cf/tunnels'),
  control: (name, action) => apiFetch(`/api/cf/tunnels/${name}/control`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  }),
  logs: (name, lines = 150) => apiFetch(`/api/cf/tunnels/${name}/logs?lines=${lines}`),
  config: (name) => apiFetch(`/api/cf/tunnels/${name}/config`),
  updateIngress: (name, rules) => apiFetch(`/api/cf/tunnels/${name}/ingress`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  }),
}

export function connectCfLogsWs(name, onLine, onError) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${proto}//${window.location.host}${BASE}/ws/cf/tunnels/${name}/logs`)
  ws.onmessage = (e) => onLine(e.data)
  ws.onerror = () => { onError?.(); ws.close() }
  return ws
}

export function connectJobWs(jobId, onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${proto}//${window.location.host}${BASE}/ws/jobs/${jobId}`)
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data))
    } catch {
      // ignore
    }
  }
  ws.onerror = () => ws.close()
  return ws
}

export function fmtBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(1)} ${units[i]}`
}

export function fmtDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
