// cortex/frontend/src/components/bento/tiles/ServicesTile.tsx
import type { Service } from '../../../lib/api'

export function ServicesTile({ services }: { services: Service[] }) {
  const up = services.filter(s => s.status === 'running').length
  const arr = services.filter(s => !s.name.startsWith('cortex-'))
  const cortex = services.filter(s => s.name.startsWith('cortex-'))

  return (
    <div className="p-4 h-full flex flex-col gap-3 overflow-hidden">
      <div className="mono text-[11px] text-[var(--color-text-muted)] tracking-widest shrink-0">SERVICES</div>

      <div className="shrink-0">
        <span className="mono font-bold text-[var(--color-text-primary)]" style={{ fontSize: '28px', lineHeight: 1 }}>
          {up}
        </span>
        <span className="mono text-sm text-[var(--color-text-muted)]">/{services.length}</span>
      </div>

      <div className="flex-1 overflow-hidden space-y-1 min-h-0">
        {arr.slice(0, 8).map(s => (
          <div key={s.container_id} className="flex items-center gap-2">
            <span className={`dot shrink-0 ${s.status === 'running' ? 'dot-up' : 'dot-down'}`} />
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer"
                 className="mono text-[11px] text-[var(--color-text-muted)] truncate
                            hover:text-[var(--color-accent)] transition-colors">
                {s.name}
              </a>
            ) : (
              <span className="mono text-[11px] text-[var(--color-text-muted)] truncate">{s.name}</span>
            )}
          </div>
        ))}
        {arr.length > 8 && (
          <div className="mono text-[10px] text-[var(--color-text-muted)]">+{arr.length - 8} more</div>
        )}
      </div>

      {cortex.length > 0 && (
        <div className="border-t border-[var(--color-border)] pt-2 shrink-0 space-y-1">
          {cortex.map(s => (
            <div key={s.container_id} className="flex items-center gap-2">
              <span className={`dot shrink-0 ${s.status === 'running' ? 'dot-up' : 'dot-down'}`} />
              <span className="mono text-[10px] text-[var(--color-text-muted)] truncate">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
