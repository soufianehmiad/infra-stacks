import type { JobRecord } from '../../../lib/api'

export function JobsTile({ jobs }: { jobs: JobRecord[] }) {
  const running = jobs.find(j => j.status === 'running')
  const pending = jobs.filter(j => j.status === 'pending').length
  return (
    <div className="p-4 h-full flex flex-col gap-2">
      <div className="mono text-[11px] text-[var(--color-text-muted)] tracking-widest">JOBS</div>
      {running ? (
        <div className="flex flex-col gap-1.5">
          <div className="mono text-xs text-[var(--color-accent)] truncate">{running.action} · {running.progress.toFixed(0)}%</div>
          <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${running.progress}%` }} />
          </div>
          {running.eta_s != null && (
            <div className="mono text-[10px] text-[var(--color-text-muted)]">ETA {running.eta_s}s</div>
          )}
        </div>
      ) : (
        <div className="mono text-xs text-[var(--color-text-muted)]">idle</div>
      )}
      {pending > 0 && <div className="mono text-[10px] text-[var(--color-text-muted)]">{pending} queued</div>}
    </div>
  )
}
