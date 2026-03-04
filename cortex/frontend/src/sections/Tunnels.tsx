// cortex/frontend/src/sections/Tunnels.tsx
import { useEffect, useState } from 'react'
import { api, type Tunnel } from '../lib/api'

export function Tunnels() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try { setTunnels(await api.tunnels.list()) } catch { /* silent */ }
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id) }, [])

  const loadLogs = async (name: string) => {
    try {
      const lines = await api.tunnels.getLogs(name, 50)
      setLogs(l => ({ ...l, [name]: lines }))
    } catch { /* silent */ }
  }

  const doControl = async (name: string, action: string) => {
    setBusy(`${name}:${action}`)
    try { await api.tunnels.control(name, action); await load() } finally { setBusy(null) }
  }

  return (
    <div className="h-full flex gap-0 overflow-auto">
      {tunnels.map(t => (
        <div key={t.name}
             className={`flex-1 min-w-48 border-r border-[var(--color-border)] flex flex-col
                         ${selected === t.name ? 'bg-[var(--color-surface)]' : ''}`}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]"
               onClick={() => { setSelected(t.name); loadLogs(t.name) }}>
            <span className={`dot ${t.running ? 'dot-up' : 'dot-down'}`} />
            <span className="mono text-xs text-[var(--color-text-primary)] flex-1 truncate cursor-pointer">{t.name}</span>
          </div>

          {/* Controls */}
          <div className="flex gap-1 px-3 py-2 border-b border-[var(--color-border)]">
            {(['start','stop','restart'] as const).map(action => (
              <button key={action} disabled={!!busy} onClick={() => doControl(t.name, action)}
                      className="mono text-[9px] px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)]
                                 hover:text-[var(--color-accent)] disabled:opacity-40 transition-colors">
                {busy === `${t.name}:${action}` ? '…' : action}
              </button>
            ))}
            <button onClick={() => loadLogs(t.name)}
                    className="mono text-[9px] px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors ml-auto">
              refresh
            </button>
          </div>

          {/* Log tail */}
          <div className="flex-1 overflow-auto p-3">
            {(logs[t.name] ?? []).map((line, i) => (
              <div key={i} className="mono text-[9px] text-[var(--color-text-muted)] leading-relaxed">{line}</div>
            ))}
            {!logs[t.name] && (
              <div className="mono text-[9px] text-[var(--color-text-muted)]">click to load logs</div>
            )}
          </div>

          {/* Status */}
          <div className="mono text-[9px] text-[var(--color-text-muted)] px-3 py-2 border-t border-[var(--color-border)]">
            {t.active} · {t.sub}
          </div>
        </div>
      ))}
      {tunnels.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="mono text-[10px] text-[var(--color-text-muted)]">no tunnels</span>
        </div>
      )}
    </div>
  )
}
