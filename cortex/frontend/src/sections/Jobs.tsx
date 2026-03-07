// cortex/frontend/src/sections/Jobs.tsx
import { useEffect, useState, useRef } from 'react'
import { api, type JobRecord } from '../lib/api'
import { CheckCircle2, XCircle, Clock, Loader2, Trash2 } from 'lucide-react'
import { Drawer } from '../components/Drawer'

type StatusFilter = 'all' | 'running' | 'pending' | 'done' | 'failed'

function TerminalStream({ jobId }: { jobId: number }) {
  const [lines, setLines] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/jobs/${jobId}`)
    ws.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        if (data.log) setLines(l => [...l, data.log].slice(-200))
      } catch { /* non-json */ }
    }
    return () => ws.close()
  }, [jobId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  return (
    <div className="overflow-y-auto bg-[var(--color-void)] border border-[var(--color-border)] p-3 max-h-64">
      {lines.length === 0 && (
        <div className="font-display text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> waiting...
        </div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="font-display text-[11px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre">{line}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  running: <Loader2 className="w-3.5 h-3.5 text-[var(--color-accent)] animate-spin" />,
  done: <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-up)]" />,
  failed: <XCircle className="w-3.5 h-3.5 text-[var(--color-down)]" />,
  cancelled: <XCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />,
  pending: <Clock className="w-3.5 h-3.5 text-[var(--color-warn)]" />,
}

function fmt(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)}G`
  return `${(bytes / 1e6).toFixed(0)}M`
}

export function Jobs() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [drawerJob, setDrawerJob] = useState<JobRecord | null>(null)

  const load = async () => {
    try { setJobs(await api.jobs.list()) } catch { /* silent */ }
  }

  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (drawerJob) setDrawerJob(jobs.find(j => j.id === drawerJob.id) ?? null)
  }, [jobs])

  async function cancelJob(id: number) {
    try { await api.jobs.cancel(id); await load() } catch { /* silent */ }
  }

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)
  const activeJob = jobs.find(j => j.status === 'running')

  const FILTERS: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: jobs.length },
    { key: 'running', label: 'Running', count: jobs.filter(j => j.status === 'running').length },
    { key: 'pending', label: 'Pending', count: jobs.filter(j => j.status === 'pending').length },
    { key: 'done', label: 'Done', count: jobs.filter(j => j.status === 'done').length },
    { key: 'failed', label: 'Failed', count: jobs.filter(j => j.status === 'failed').length },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Active job bar */}
      {activeJob && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-[var(--color-accent)] animate-spin" />
            <span className="label-accent">ENCODING</span>
            <span className="text-[13px] text-[var(--color-text-primary)]">#{activeJob.id} — {activeJob.action}</span>
            <span className="font-display text-[13px] text-[var(--color-accent)] ml-auto font-semibold"
                  style={{ textShadow: '0 0 6px rgba(34,197,94,0.4)' }}>
              {Math.round(activeJob.progress)}%
            </span>
            {activeJob.eta_s != null && (
              <span className="font-display text-[11px] text-[var(--color-text-muted)]">ETA {activeJob.eta_s}s</span>
            )}
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${activeJob.progress}%` }} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`pill ${filter === f.key ? 'pill-active' : ''}`}>
              {f.label} {f.count > 0 && <span className="opacity-50">{f.count}</span>}
            </button>
          ))}
        </div>
        <span className="label ml-auto">{jobs.length} total</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-void)] border-b border-[var(--color-border)]">
              <th className="table-header w-14">ID</th>
              <th className="table-header">ACTION</th>
              <th className="table-header w-28">STATUS</th>
              <th className="table-header w-24 hidden sm:table-cell">PROGRESS</th>
              <th className="table-header text-right w-28 hidden md:table-cell">SIZE</th>
              <th className="table-header w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => (
              <tr key={j.id} onClick={() => setDrawerJob(j)}
                  className={`border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-elevated)] transition-colors
                    ${drawerJob?.id === j.id ? 'bg-[var(--color-elevated)]' : ''}`}>
                <td className="table-cell-mono">#{j.id}</td>
                <td className="table-cell text-[var(--color-text-primary)]">{j.action}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[j.status]}
                    <span className="font-display text-[11px] text-[var(--color-text-secondary)]">{j.status}</span>
                  </div>
                </td>
                <td className="table-cell hidden sm:table-cell">
                  {j.status === 'running' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress-track !h-[4px]">
                        <div className="progress-fill" style={{ width: `${j.progress}%` }} />
                      </div>
                      <span className="font-display text-[11px] text-[var(--color-accent)] w-8 text-right">{Math.round(j.progress)}%</span>
                    </div>
                  ) : j.status === 'done' ? (
                    <span className="font-display text-[11px] text-[var(--color-text-muted)]">100%</span>
                  ) : (
                    <span className="font-display text-[11px] text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="table-cell-mono text-right hidden md:table-cell">
                  {j.size_before ? `${fmt(j.size_before)}${j.size_after ? ` → ${fmt(j.size_after)}` : ''}` : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {(j.status === 'pending' || j.status === 'running') && (
                    <button onClick={e => { e.stopPropagation(); cancelJob(j.id) }}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-down)] transition-colors"
                            title="Cancel">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <span className="font-display text-[12px] text-[var(--color-text-muted)]">
                    {jobs.length === 0 ? 'No jobs queued' : 'No matching jobs'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <Drawer open={!!drawerJob} onClose={() => setDrawerJob(null)} title="JOB DETAILS" width="w-[480px]">
        {drawerJob && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              {STATUS_ICON[drawerJob.status]}
              <span className="text-[14px] text-[var(--color-text-primary)]">#{drawerJob.id} — {drawerJob.action}</span>
              <span className="font-display text-[11px] text-[var(--color-text-secondary)] ml-auto">{drawerJob.status}</span>
            </div>

            {drawerJob.status === 'running' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label">PROGRESS</span>
                  <span className="font-display text-[13px] text-[var(--color-accent)] font-semibold">{Math.round(drawerJob.progress)}%</span>
                </div>
                <div className="progress-track !h-[8px]">
                  <div className="progress-fill" style={{ width: `${drawerJob.progress}%` }} />
                </div>
                {drawerJob.eta_s != null && (
                  <span className="font-display text-[11px] text-[var(--color-text-muted)] mt-1.5 block">ETA {drawerJob.eta_s}s</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {([
                ['Size Before', fmt(drawerJob.size_before)],
                ['Size After', fmt(drawerJob.size_after)],
                ['Created', new Date(drawerJob.created_at).toLocaleString()],
                ['Finished', drawerJob.finished_at ? new Date(drawerJob.finished_at).toLocaleString() : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="label mb-1">{k.toUpperCase()}</div>
                  <div className="text-[13px] text-[var(--color-text-primary)]">{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="label mb-2">OUTPUT</div>
              {drawerJob.status === 'running' ? (
                <TerminalStream jobId={drawerJob.id} />
              ) : (
                <div className="overflow-y-auto bg-[var(--color-void)] border border-[var(--color-border)] p-3 max-h-64">
                  {drawerJob.log ? (
                    drawerJob.log.split('\n').map((line, i) => (
                      <div key={i} className="font-display text-[11px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre">{line}</div>
                    ))
                  ) : (
                    <span className="font-display text-[11px] text-[var(--color-text-muted)]">no output</span>
                  )}
                </div>
              )}
            </div>

            {(drawerJob.status === 'pending' || drawerJob.status === 'running') && (
              <button onClick={() => { cancelJob(drawerJob.id); setDrawerJob(null) }}
                      className="btn btn-danger w-full py-2.5">
                Cancel Job
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
