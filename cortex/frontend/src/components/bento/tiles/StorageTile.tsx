import type { StorageSnapshot } from '../../../lib/api'

function fmt(bytes: number) {
  if (bytes > 1e12) return `${(bytes/1e12).toFixed(1)}T`
  if (bytes > 1e9)  return `${(bytes/1e9).toFixed(1)}G`
  return `${(bytes/1e6).toFixed(0)}M`
}

export function StorageTile({ storage }: { storage: StorageSnapshot[] | null }) {
  if (!storage) return <div className="p-5 text-xs text-[var(--color-text-muted)]">loading...</div>
  const total = storage[0]?.total_bytes ?? 0
  const used = storage.reduce((s, r) => s + r.used_bytes, 0)
  const pct = total > 0 ? (used / total * 100) : 0
  return (
    <div className="p-5 h-full flex flex-col gap-3">
      <div className="mono text-xs text-[var(--color-accent)] tracking-[0.2em]">MEDIA STORAGE</div>
      <div className="flex items-baseline gap-2">
        <span className="mono text-2xl text-[var(--color-text-primary)] font-semibold"
              style={{ textShadow: '0 0 8px rgba(34, 197, 94, 0.3)' }}>{fmt(used)}</span>
        <span className="text-sm text-[var(--color-text-muted)]">/ {fmt(total)}</span>
      </div>
      <div className="h-2 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
        <div className="h-full bg-[var(--color-accent)] transition-all rounded-full"
             style={{ width: `${pct}%`, boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)' }} />
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {storage.map(s => (
          <div key={s.folder} className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">{s.folder}</span>
            <span className="mono text-xs text-[var(--color-text-primary)]">{fmt(s.used_bytes)}</span>
          </div>
        ))}
      </div>
      {storage[0]?.saved_bytes > 0 && (
        <div className="text-xs text-[var(--color-up)]"
             style={{ textShadow: '0 0 4px rgba(34, 197, 94, 0.3)' }}>
          ↓ {fmt(storage[0].saved_bytes)} saved
        </div>
      )}
    </div>
  )
}
