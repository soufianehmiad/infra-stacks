import type {
  FilesResponse,
  FileQueryParams,
  Job,
  StorageResponse,
  StorageHistoryEntry,
  CfTunnel,
  CfConfig,
  JobWsMessage,
} from '../types/media';

const BASE = '/mediamgr';

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export const mediaApi = {
  files: (params: FileQueryParams = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'all'),
      ) as Record<string, string>,
    );
    return apiFetch<FilesResponse>(`/api/files?${q}`);
  },
  deleteFile: (id: number) => apiFetch<{ ok: boolean }>(`/api/files/${id}`, { method: 'DELETE' }),
  startScan: () => apiFetch<{ ok: boolean }>('/api/scan', { method: 'POST' }),
  scanStatus: () => apiFetch<{ running: boolean; scanned: number; total: number }>('/api/scan/status'),
  createJob: (file_id: number, action: string) =>
    apiFetch<{ id: number; status: string }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ file_id, action }),
    }),
  jobs: () => apiFetch<Job[]>('/api/jobs'),
  cancelJob: (id: number) => apiFetch<{ ok: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  storage: () => apiFetch<StorageResponse>('/api/storage'),
  storageHistory: (days = 30) => apiFetch<StorageHistoryEntry[]>(`/api/storage/history?days=${days}`),
};

export const mediaCf = {
  tunnels: () => apiFetch<CfTunnel[]>('/api/cf/tunnels'),
  control: (name: string, action: string) =>
    apiFetch<{ ok: boolean }>(`/api/cf/tunnels/${name}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  logs: (name: string, lines = 150) => apiFetch<string[]>(`/api/cf/tunnels/${name}/logs?lines=${lines}`),
  config: (name: string) => apiFetch<CfConfig>(`/api/cf/tunnels/${name}/config`),
  updateIngress: (name: string, rules: Array<{ hostname?: string; path?: string; service: string }>) =>
    apiFetch<{ ok: boolean }>(`/api/cf/tunnels/${name}/ingress`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }),
};

export function connectCfLogsWs(name: string, onLine: (line: string) => void, onError?: () => void) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${window.location.host}${BASE}/ws/cf/tunnels/${name}/logs`);
  ws.onmessage = (e) => onLine(e.data);
  ws.onerror = () => {
    onError?.();
    ws.close();
  };
  return ws;
}

export function connectJobWs(jobId: number, onMessage: (msg: JobWsMessage) => void) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${window.location.host}${BASE}/ws/jobs/${jobId}`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      // ignore
    }
  };
  ws.onerror = () => ws.close();
  return ws;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '\u2014';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export function fmtDuration(secs: number | null | undefined): string {
  if (!secs) return '\u2014';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
