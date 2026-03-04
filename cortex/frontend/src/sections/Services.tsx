// cortex/frontend/src/sections/Services.tsx
import { useEffect, useState } from 'react'
import { api, type Service } from '../lib/api'

export function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try { setServices(await api.services.list()) } catch { /* silent */ }
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id) }, [])

  const doAction = async (id: string, action: string) => {
    setBusy(`${id}:${action}`)
    try { await api.services.action(id, action); await load() } finally { setBusy(null) }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-widest mb-4">SERVICES</div>
      {services.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <span className="mono text-[10px] text-[var(--color-text-muted)] tracking-widest">NO SERVICES DISCOVERED</span>
          <span className="mono text-[9px] text-[var(--color-text-muted)] max-w-sm">
            Add <code className="text-[var(--color-accent)]">cortex.enable=true</code> labels to Docker containers to list them here.
          </span>
        </div>
      )}
      {services.length > 0 && <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {['', 'name', 'type', 'port', 'status', 'actions'].map(h => (
              <th key={h} className="mono text-[9px] text-[var(--color-text-muted)] text-left px-2 py-2 tracking-widest">{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.container_id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-2 py-2"><span className={`dot ${s.status === 'running' ? 'dot-up' : 'dot-down'}`} /></td>
              <td className="px-2 py-2 mono text-xs text-[var(--color-text-primary)]">{s.name}</td>
              <td className="px-2 py-2 mono text-[10px] text-[var(--color-text-muted)]">{s.type || '—'}</td>
              <td className="px-2 py-2 mono text-[10px] text-[var(--color-text-muted)]">{s.port || '—'}</td>
              <td className="px-2 py-2 mono text-[10px] text-[var(--color-text-muted)]">{s.status}</td>
              <td className="px-2 py-2 flex gap-1">
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer"
                     className="mono text-[9px] px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                    open
                  </a>
                )}
                {(['restart','stop'] as const).map(action => (
                  <button key={action} disabled={!!busy}
                    onClick={() => doAction(s.container_id, action)}
                    className="mono text-[9px] px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] disabled:opacity-40 transition-colors">
                    {busy === `${s.container_id}:${action}` ? '…' : action}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>}
    </div>
  )
}
