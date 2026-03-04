import type { Tunnel } from '../../../lib/api'

export function TunnelsTile({ tunnels }: { tunnels: Tunnel[] }) {
  const up = tunnels.filter(t => t.running).length
  return (
    <div className="p-4 h-full flex flex-col gap-2">
      <div className="mono text-[11px] text-[var(--color-text-muted)] tracking-widest">TUNNELS</div>
      <div className="mono text-3xl text-[var(--color-text-primary)] font-bold leading-none">{up}<span className="text-base text-[var(--color-text-muted)]">/{tunnels.length}</span></div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {tunnels.map(t => (
          <div key={t.name} className="flex items-center gap-2">
            <span className={`dot ${t.running ? 'dot-up' : 'dot-down'}`} />
            <span className="mono text-[10px] text-[var(--color-text-primary)] truncate">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
