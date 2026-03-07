import type { JobRecord } from '../../../lib/api'

export function JobsTile({ jobs }: { jobs: JobRecord[] }) {
  const running = jobs.find(j => j.status === 'running')
  const pending = jobs.filter(j => j.status === 'pending').length
  return (
    <div className="p-5 h-full flex flex-col gap-3">
      <div className="mono text-xs text-[var(--color-accent)] tracking-[0.2em]">JOBS</div>
      {running ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-primary)]">{running.action}</span>
            <span className="mono text-xs text-[var(--color-accent)]">{Math.round(running.progress)}%</span>
          </div>
          <div className="h-2 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                 style={{ width: `${running.progress}%`, boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)' }} />
          </div>
          {running.eta_s != null && (
            <span className="text-xs text-[var(--color-text-muted)]">ETA {running.eta_s}s</span>
          )}
        </div>
      ) : (
        <span className="mono text-2xl text-[var(--color-text-muted)]">idle</span>
      )}
      {pending > 0 && (
        <span className="text-xs text-[var(--color-warn)]">{pending} pending</span>
      )}
    </div>
  )
}
