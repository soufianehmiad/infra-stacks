import { useEffect, useState } from 'react'
import { api, cf, fmtBytes } from '../api.js'
import { DiskDonut, SavingsChart } from '../components/StorageChart.jsx'
import LoadingDots from '../components/LoadingDots.jsx'

const STATUS_COLOR = {
  pending:   'var(--text-muted)',
  running:   'var(--accent)',
  done:      'var(--success)',
  failed:    'var(--danger)',
  reverted:  'var(--warn)',
  cancelled: 'var(--border-bright)',
}

const ACTION_LABELS = {
  reencode: 'Re-encode', remux: 'Remux',
  downscale: 'Downscale', delete: 'Delete',
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Rule({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '24px 0 16px' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function MiniStat({ index, label, value, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", width: '14px', flexShrink: 0 }}>
        {String(index).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>{label}</span>
      <span style={{
        fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  )
}

function Panel({ label, children, style }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      ...style,
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em' }}>
          {label}
        </span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [storage, setStorage]   = useState(null)
  const [history, setHistory]   = useState([])
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [cfTunnels, setCfTunnels] = useState(null)

  async function load() {
    try {
      const [s, h, j] = await Promise.all([api.storage(), api.storageHistory(), api.jobs()])
      setStorage(s); setHistory(h); setJobs(j)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadCf() {
    try { setCfTunnels(await cf.tunnels()) }
    catch { setCfTunnels([]) }
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])
  useEffect(() => { loadCf(); const t = setInterval(loadCf, 30000); return () => clearInterval(t) }, [])

  if (loading) return <LoadingDots />

  const stats   = storage?.stats || {}
  const folders = storage?.folders || []
  const saved   = fmtBytes(stats.saved_bytes || 0)
  const recent  = jobs.slice(0, 12)

  // Split saved into number + unit for the hero display
  const savedParts = saved.split(' ')
  const savedNum  = savedParts[0] || '0'
  const savedUnit = savedParts[1] || 'B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }} className="animate-in">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{
            fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)',
            margin: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em',
          }}>Dashboard</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            System overview
          </p>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* ── Main layout: left column + right charts ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', alignItems: 'stretch' }}>

        {/* Left column */}
        <div style={{
          background: '#0e0e12',
          border: '1px solid var(--border)',
          padding: '20px 16px',
        }}>
          {/* Hero metric */}
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.14em', marginBottom: '8px' }}>
            SPACE RECOVERED
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{
              fontSize: '60px', fontWeight: 800, lineHeight: 1,
              fontFamily: "'Barlow Condensed', sans-serif",
              color: 'var(--accent)', letterSpacing: '-0.02em',
            }}>
              {savedNum}
            </span>
            <span style={{
              fontSize: '17px', fontWeight: 600,
              fontFamily: "'Barlow Condensed', sans-serif",
              color: 'var(--accent)', opacity: 0.7,
              alignSelf: 'flex-end', marginBottom: '8px',
            }}>
              {savedUnit}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            saved vs original size
          </div>

          <Rule label="SYSTEM" />

          <MiniStat index={1} label="Files indexed"  value={stats.files_count?.toLocaleString() || '0'} />
          <MiniStat index={2} label="Jobs completed" value={stats.jobs_count?.toLocaleString() || '0'} />
          <MiniStat index={3} label="Queue depth"    value={stats.pending_jobs || '0'} accent={stats.pending_jobs > 0} />

          {folders.length > 0 && (
            <>
              <Rule label="VOLUMES" />
              {folders.map(f => {
                const pct = f.total_bytes ? Math.min(100, (f.used_bytes / f.total_bytes) * 100) : 0
                return (
                  <div key={f.folder} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{f.folder}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: '2px', background: 'var(--border)', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Right: charts stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Top row: donut + savings side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <Panel label="DISK USAGE">
              <DiskDonut folders={folders} />
            </Panel>

            <Panel label="SPACE RECOVERED — 30 DAYS">
              <SavingsChart history={history} />
            </Panel>
          </div>

          {/* CF Tunnels */}
          <Panel label="CF TUNNELS · LXC 500">
            {cfTunnels === null ? (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                Loading…
              </span>
            ) : cfTunnels.length === 0 || cfTunnels[0]?.error ? (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {cfTunnels[0]?.error || 'No tunnels found'}
              </span>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cfTunnels.length, 3)}, 1fr)`, gap: '12px' }}>
                {cfTunnels.map(t => (
                  <div key={t.name} style={{
                    padding: '12px 16px', background: 'var(--bg-base)',
                    border: `1px solid ${t.running ? 'rgba(50,200,100,.2)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                      background: t.running ? 'var(--success)' : '#3a3a48',
                      boxShadow: t.running ? '0 0 5px var(--success)' : 'none',
                    }} />
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                    <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', color: t.running ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {t.running ? 'running' : (t.sub || 'stopped')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </div>
      </div>

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <Rule label="RECENT ACTIVITY" />
          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            {recent.map((j, i) => {
              const saved = j.size_before && j.size_after ? j.size_before - j.size_after : null
              const actionLabel = ACTION_LABELS[j.action] || j.action
              const statusColor = STATUS_COLOR[j.status] || 'var(--text-muted)'
              const isLast = i === recent.length - 1

              return (
                <div
                  key={j.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 90px 90px 100px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Status */}
                  <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: statusColor }}>
                    {j.status}
                  </span>

                  {/* Filename */}
                  <span style={{
                    fontSize: '13px', color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: '16px',
                  }} title={j.filename}>
                    {j.filename}
                  </span>

                  {/* Action */}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {actionLabel}
                  </span>

                  {/* Saved */}
                  <span style={{
                    fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right',
                    color: saved !== null && saved > 0 ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    {saved !== null && saved > 0 ? `-${fmtBytes(saved)}` : '—'}
                  </span>

                  {/* Date */}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>
                    {j.finished_at ? new Date(j.finished_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
