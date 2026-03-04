import { useEffect, useState } from 'react'
import { connectJobWs, fmtDuration } from '../api.js'

export default function JobProgress({ job }) {
  const [progress, setProgress] = useState(job.progress || 0)
  const [eta, setEta] = useState(job.eta_s)
  const [status, setStatus] = useState(job.status)

  useEffect(() => {
    setProgress(job.progress || 0)
    setEta(job.eta_s)
    setStatus(job.status)

    if (!['pending', 'running'].includes(job.status)) return

    const ws = connectJobWs(job.id, (msg) => {
      if (msg.ping) return
      if (msg.pct !== undefined) setProgress(msg.pct)
      if (msg.eta_s !== undefined) setEta(msg.eta_s)
      if (msg.status) setStatus(msg.status)
    })

    return () => ws.close()
  }, [job.id, job.status])

  const isRunning = status === 'running'
  const isDone = status === 'done' || status === 'reverted'
  const displayPct = isDone ? 100 : progress

  return (
    <div className="space-y-1.5">
      {/* Progress track */}
      <div className="h-[3px] bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isRunning ? 'progress-shimmer' :
            status === 'done' ? 'bg-[var(--success)]' :
            status === 'reverted' ? 'bg-[var(--warn)]' :
            status === 'failed' ? 'bg-[var(--danger)]' :
            status === 'cancelled' ? 'bg-[var(--border-bright)]' :
            'bg-[var(--border-bright)]'
          }`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      {/* Status label */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {isRunning && <span className="text-acid">{progress}%</span>}
          {!isRunning && status}
        </span>
        {isRunning && eta != null && (
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            ETA {fmtDuration(eta)}
          </span>
        )}
      </div>
    </div>
  )
}
