import { useEffect, useState } from 'react'
import { api, fmtBytes } from '../api.js'
import JobProgress from '../components/JobProgress.jsx'
import LoadingDots from '../components/LoadingDots.jsx'

const STATUS_ORDER = { running: 0, pending: 1, done: 2, reverted: 3, failed: 4, cancelled: 5 }

const ACTION_LABELS = {
  reencode:  'Re-encode',
  remux:     'Remux',
  downscale: 'Downscale',
  delete:    'Delete',
}

const STATUS_COLOR = {
  done:      'var(--success)',
  reverted:  'var(--warn)',
  failed:    'var(--danger)',
  cancelled: 'var(--border-bright)',
}

function SectionTitle({ children, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
        {children}
      </span>
      {count != null && count > 0 && (
        <span style={{
          fontSize: '11px', color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--accent-dim)',
          padding: '1px 8px',
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function JobCard({ job, onCancel }) {
  const actionLabel = ACTION_LABELS[job.action] || job.action
  const isActive = ['pending', 'running'].includes(job.status)
  const isRunning = job.status === 'running'

  return (
    <div
      className="animate-in"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${isRunning ? 'var(--accent)' : 'var(--border)'}`,
        marginBottom: '8px',
      }}
    >
      <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            {isRunning && (
              <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '11px', color: isRunning ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {actionLabel}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {job.status === 'pending' ? '· queued' : ''}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.filename}>
            {job.filename}
          </p>
          {job.size_before && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtBytes(job.size_before)}
            </p>
          )}
        </div>
        {isActive && (
          <button
            onClick={onCancel}
            style={{
              flexShrink: 0, padding: '4px 12px',
              fontSize: '11px', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: "'Barlow', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--danger)'
              e.currentTarget.style.borderColor = 'var(--danger)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Cancel
          </button>
        )}
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <JobProgress job={job} />
      </div>
    </div>
  )
}

function HistoryRow({ job }) {
  const saved = job.size_before && job.size_after ? job.size_before - job.size_after : null
  const finished = job.finished_at ? new Date(job.finished_at).toLocaleString() : '—'
  const actionLabel = ACTION_LABELS[job.action] || job.action
  const statusColor = STATUS_COLOR[job.status] || 'var(--text-muted)'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <td style={{ padding: '10px 16px', maxWidth: '260px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.filename}>
          {job.filename}
        </p>
        {job.error && (
          <p style={{ fontSize: '11px', color: 'var(--danger)', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error}>
            {job.error}
          </p>
        )}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
          {actionLabel}
        </span>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: '11px', color: statusColor, fontFamily: "'JetBrains Mono', monospace" }}>
          {job.status}
        </span>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        {saved !== null && saved > 0 ? (
          <span style={{ fontSize: '11px', color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace" }}>
            -{fmtBytes(saved)}
          </span>
        ) : saved !== null && saved <= 0 ? (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            +{fmtBytes(Math.abs(saved))}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {finished}
        </span>
      </td>
    </tr>
  )
}

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelError, setCancelError] = useState(null)

  async function load() {
    try {
      const data = await api.jobs()
      setJobs(data.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  async function handleCancel(id) {
    setCancelError(null)
    try { await api.cancelJob(id); load() }
    catch (e) { setCancelError(e.message) }
  }

  const running = jobs.filter((j) => j.status === 'running')
  const pending = jobs.filter((j) => j.status === 'pending')
  const history = jobs.filter((j) => !['running', 'pending'].includes(j.status))

  if (loading) return <LoadingDots />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-in">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
          Jobs
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
          Encode queue & history
        </p>
      </div>

      {/* Cancel error */}
      {cancelError && (
        <div style={{
          padding: '8px 12px', fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--danger)',
          background: 'rgba(184,96,112,0.08)',
          border: '1px solid rgba(184,96,112,0.25)',
        }}>
          {cancelError}
        </div>
      )}

      {/* Running */}
      {running.length > 0 && (
        <section>
          <SectionTitle count={running.length}>Running</SectionTitle>
          {running.map((j) => (
            <JobCard key={j.id} job={j} onCancel={() => handleCancel(j.id)} />
          ))}
        </section>
      )}

      {/* Queue */}
      <section>
        <SectionTitle count={pending.length}>Queue</SectionTitle>
        {pending.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", padding: '16px 0' }}>
            Queue empty
          </p>
        ) : (
          pending.map((j) => (
            <JobCard key={j.id} job={j} onCancel={() => handleCancel(j.id)} />
          ))
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <SectionTitle>History</SectionTitle>
          <div style={{ border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  {['File', 'Action', 'Result', 'Saved', 'Finished'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: h === 'Saved' ? 'right' : 'left',
                      fontSize: '11px', color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 400,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((j) => <HistoryRow key={j.id} job={j} />)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {jobs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '8px' }}>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
            No jobs yet
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            Go to Library to queue encode or delete jobs
          </p>
        </div>
      )}
    </div>
  )
}
