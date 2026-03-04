import type { StorageSnapshot } from '../../../lib/api'

function fmt(bytes: number) {
  if (bytes > 1e12) return `${(bytes/1e12).toFixed(1)}T`
  if (bytes > 1e9)  return `${(bytes/1e9).toFixed(1)}G`
  return `${(bytes/1e6).toFixed(0)}M`
}

export function StorageTile({ storage }: { storage: StorageSnapshot[] | null }) {
  if (!storage) return <div className="p-4 mono text-[10px] text-[var(--color-text-muted)]">loading…</div>
  const total = storage[0]?.total_bytes ?? 0
  const used = storage.reduce((s, r) => s + r.used_bytes, 0)
  const pct = total > 0 ? (used / total * 100) : 0
  return (
    <div className="p-4 h-full flex flex-col gap-2">
      <div className="mono text-[11px] text-[var(--color-text-muted)] tracking-widest">STORAGE</div>
      <div className="mono text-xl text-[var(--color-text-primary)]">{fmt(used)} <span className="text-sm text-[var(--color-text-muted)]">/ {fmt(total)}</span></div>
      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {storage.map(s => (
          <div key={s.folder} className="flex items-center justify-between gap-2">
            <span className="mono text-[10px] text-[var(--color-text-muted)]">{s.folder}</span>
            <span className="mono text-[10px] text-[var(--color-text-primary)]">{fmt(s.used_bytes)}</span>
          </div>
        ))}
      </div>
      {storage[0]?.saved_bytes > 0 && (
        <div className="mono text-[10px] text-[var(--color-up)]">↓ {fmt(storage[0].saved_bytes)} saved</div>
      )}
    </div>
  )
}
