// cortex/frontend/src/sections/Jobs.tsx
import { useEffect, useState, useRef } from 'react'
import { api, type JobRecord } from '../lib/api'

function TerminalStream({ jobId }: { jobId: number }) {
  const [lines, setLines] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/jobs/${jobId}`)
    ws.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        if (data.log) setLines(l => [...l, data.log].slice(-100))
      } catch { /* non-json */ }
    }
    return () => ws.close()
  }, [jobId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  return (
    <div className="h-full overflow-y-auto bg-void border border-[var(--color-border)] p-3">
      {lines.length === 0 && (
        <div className="mono text-[10px] text-[var(--color-text-muted)]">waiting for output…</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="mono text-[10px] text-[var(--color-text-muted)] leading-relaxed">{line}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-[var(--color-accent)]', done: 'text-[var(--color-up)]',
  failed: 'text-[var(--color-down)]', cancelled: 'text-[var(--color-text-muted)]',
  pending: 'text-[var(--color-warn)]',
}

export function Jobs() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selected, setSelected] = useState<JobRecord | null>(null)

  const load = async () => {
    try { setJobs(await api.jobs.list()) } catch { /* silent */ }
  }

  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id) }, [])

  useEffect(() => {
    if (selected) setSelected(jobs.find(j => j.id === selected.id) ?? null)
  }, [jobs])

  const activeJob = jobs.find(j => j.status === 'running')

  return (
    <div className="h-full flex gap-0">
      {/* Job queue */}
      <div className="w-80 border-r border-[var(--color-border)] overflow-auto">
        <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-widest px-4 py-3 border-b border-[var(--color-border)]">JOB QUEUE</div>
        {jobs.map(j => (
          <div key={j.id} onClick={() => setSelected(j)}
               className={`px-4 py-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition-colors ${selected?.id === j.id ? 'bg-[var(--color-surface)]' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="mono text-[10px] text-[var(--color-text-primary)]">#{j.id} · {j.action}</span>
              <span className={`mono text-[9px] ${STATUS_COLOR[j.status] ?? ''}`}>{j.status}</span>
            </div>
            {j.status === 'running' && (
              <div className="h-0.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            )}
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="mono text-[10px] text-[var(--color-text-muted)] px-4 py-6">no jobs</div>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {activeJob ? (
          <>
            <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-widest">
              LIVE OUTPUT · #{activeJob.id} · {activeJob.progress.toFixed(0)}%
              {activeJob.eta_s != null && ` · ETA ${activeJob.eta_s}s`}
            </div>
            <div className="flex-1">
              <TerminalStream jobId={activeJob.id} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="mono text-[10px] text-[var(--color-text-muted)]">no active job</span>
          </div>
        )}
      </div>
    </div>
  )
}
