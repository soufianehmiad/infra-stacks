// cortex/frontend/src/sections/Jobs.tsx — single table + right drawer
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
    <div className="overflow-y-auto bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg p-3 max-h-64">
      {lines.length === 0 && (
        <div className="mono text-[10px] text-[var(--color-text-muted)] flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> waiting…
        </div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="mono text-[10px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre">{line}</div>
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
      {/* Active job progress bar */}
      {activeJob && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-[var(--color-accent)] animate-spin" />
            <span className="mono text-[10px] text-[var(--color-accent)] tracking-[0.2em]">ENCODING</span>
            <span className="text-xs text-[var(--color-text-primary)]">#{activeJob.id} — {activeJob.action}</span>
            <span className="mono text-xs text-[var(--color-accent)] ml-auto font-bold"
                  style={{ textShadow: '0 0 6px rgba(34,197,94,0.4)' }}>
              {Math.round(activeJob.progress)}%
            </span>
            {activeJob.eta_s != null && (
              <span className="mono text-[10px] text-[var(--color-text-muted)]">ETA {activeJob.eta_s}s</span>
            )}
          </div>
          <div className="h-2 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                 style={{ width: `${activeJob.progress}%`, boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface)]">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`mono text-[10px] tracking-widest px-2.5 py-1.5 rounded-full border transition-colors
                      ${filter === f.key
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {f.label} {f.count > 0 && <span className="opacity-60">{f.count}</span>}
            </button>
          ))}
        </div>
        <span className="mono text-[10px] text-[var(--color-text-muted)] ml-auto">{jobs.length} total</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-void)] border-b border-[var(--color-border)]">
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-4 py-2 w-14">ID</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-4 py-2">ACTION</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-4 py-2 w-28">STATUS</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-4 py-2 w-20 hidden sm:table-cell">PROGRESS</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-right px-4 py-2 w-28 hidden md:table-cell">SIZE</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-right px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => (
              <tr key={j.id} onClick={() => setDrawerJob(j)}
                  className={`border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-elevated)] transition-colors
                    ${drawerJob?.id === j.id ? 'bg-[var(--color-elevated)]' : ''}`}>
                <td className="px-4 py-2.5 mono text-xs text-[var(--color-text-muted)]">#{j.id}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-primary)]">{j.action}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {STATUS_ICON[j.status]}
                    <span className="mono text-[10px] text-[var(--color-text-muted)]">{j.status}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {j.status === 'running' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
                        <div className="h-full bg-[var(--color-accent)] rounded-full transition-all" style={{ width: `${j.progress}%` }} />
                      </div>
                      <span className="mono text-[10px] text-[var(--color-accent)] w-8 text-right">{Math.round(j.progress)}%</span>
                    </div>
                  ) : j.status === 'done' ? (
                    <span className="mono text-[10px] text-[var(--color-text-muted)]">100%</span>
                  ) : (
                    <span className="mono text-[10px] text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 mono text-[10px] text-[var(--color-text-muted)] text-right hidden md:table-cell">
                  {j.size_before ? `${fmt(j.size_before)}${j.size_after ? ` → ${fmt(j.size_after)}` : ''}` : '—'}
                </td>
                <td className="px-2 py-2.5">
                  {(j.status === 'pending' || j.status === 'running') && (
                    <button onClick={e => { e.stopPropagation(); cancelJob(j.id) }}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-down)] transition-colors"
                            title="Cancel">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <span className="mono text-xs text-[var(--color-text-muted)]">
                    {jobs.length === 0 ? 'No jobs queued' : 'No matching jobs'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      <Drawer open={!!drawerJob} onClose={() => setDrawerJob(null)} title="JOB DETAILS" width="w-[480px]">
        {drawerJob && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              {STATUS_ICON[drawerJob.status]}
              <span className="text-sm text-[var(--color-text-primary)]">#{drawerJob.id} — {drawerJob.action}</span>
              <span className="mono text-[10px] text-[var(--color-text-muted)] ml-auto">{drawerJob.status}</span>
            </div>

            {drawerJob.status === 'running' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="mono text-[10px] text-[var(--color-text-muted)]">Progress</span>
                  <span className="mono text-xs text-[var(--color-accent)] font-bold">{Math.round(drawerJob.progress)}%</span>
                </div>
                <div className="h-3 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
                  <div className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                       style={{ width: `${drawerJob.progress}%`, boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                </div>
                {drawerJob.eta_s != null && (
                  <span className="mono text-[10px] text-[var(--color-text-muted)] mt-1 block">ETA {drawerJob.eta_s}s</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {([
                ['Size Before', fmt(drawerJob.size_before)],
                ['Size After', fmt(drawerJob.size_after)],
                ['Created', new Date(drawerJob.created_at).toLocaleString()],
                ['Finished', drawerJob.finished_at ? new Date(drawerJob.finished_at).toLocaleString() : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-0.5">{k.toUpperCase()}</div>
                  <div className="text-xs text-[var(--color-text-primary)]">{v}</div>
                </div>
              ))}
            </div>

            {/* Live output or log */}
            <div>
              <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-2">OUTPUT</div>
              {drawerJob.status === 'running' ? (
                <TerminalStream jobId={drawerJob.id} />
              ) : (
                <div className="overflow-y-auto bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg p-3 max-h-64">
                  {drawerJob.log ? (
                    drawerJob.log.split('\n').map((line, i) => (
                      <div key={i} className="mono text-[10px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre">{line}</div>
                    ))
                  ) : (
                    <span className="mono text-[10px] text-[var(--color-text-muted)]">no output</span>
                  )}
                </div>
              )}
            </div>

            {(drawerJob.status === 'pending' || drawerJob.status === 'running') && (
              <button onClick={() => { cancelJob(drawerJob.id); setDrawerJob(null) }}
                      className="w-full px-3 py-2.5 text-xs rounded-lg border border-[var(--color-down)]/30
                                 text-[var(--color-down)] hover:bg-[rgba(239,68,68,0.08)] transition-colors">
                Cancel Job
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
