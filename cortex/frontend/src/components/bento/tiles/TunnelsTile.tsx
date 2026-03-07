import type { Tunnel } from '../../../lib/api'

export function TunnelsTile({ tunnels }: { tunnels: Tunnel[] }) {
  const up = tunnels.filter(t => t.running).length
  return (
    <div className="p-5 h-full flex flex-col gap-3">
      <div className="mono text-xs text-[var(--color-accent)] tracking-[0.2em]">TUNNELS</div>
      <div className="flex items-baseline gap-1">
        <span className="mono text-3xl text-[var(--color-text-primary)] font-bold"
              style={{ textShadow: '0 0 8px rgba(34, 197, 94, 0.3)' }}>{up}</span>
        <span className="text-lg text-[var(--color-text-muted)]">/{tunnels.length}</span>
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {tunnels.map(t => (
          <div key={t.name} className="flex items-center gap-2">
            <span className={`dot ${t.running ? 'dot-up' : 'dot-down'}`} />
            <span className="text-xs text-[var(--color-text-primary)] truncate">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
