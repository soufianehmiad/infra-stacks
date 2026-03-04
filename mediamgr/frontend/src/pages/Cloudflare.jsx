import { useCallback, useEffect, useRef, useState } from 'react'
import { cf, connectCfLogsWs } from '../api.js'
import LoadingDots from '../components/LoadingDots.jsx'

// ─── Shared primitives ────────────────────────────────────────────────────────

function Dot({ on }) {
  return (
    <span style={{
      display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
      background: on ? 'var(--success)' : '#3a3a48',
      boxShadow: on ? '0 0 6px var(--success)' : 'none',
      transition: 'background 0.3s',
    }} />
  )
}

function Btn({ label, onClick, disabled, variant = 'ghost' }) {
  const colors = {
    ghost:   { bg: 'transparent',              fg: 'var(--text-secondary)', border: 'var(--border)' },
    accent:  { bg: 'var(--accent-dim)',         fg: 'var(--accent-bright)',  border: 'var(--accent)'  },
    danger:  { bg: 'rgba(220,50,50,.12)',       fg: 'var(--danger)',         border: 'var(--danger)'  },
    success: { bg: 'rgba(50,200,100,.12)',      fg: 'var(--success)',        border: 'var(--success)' },
    warn:    { bg: 'rgba(220,160,20,.12)',      fg: 'var(--warn)',           border: 'var(--warn)'    },
  }
  const c = disabled ? colors.ghost : colors[variant]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '4px 12px', fontSize: '11px', fontFamily: "'Barlow', sans-serif", fontWeight: 600,
        background: c.bg, color: disabled ? 'var(--text-muted)' : c.fg,
        border: `1px solid ${disabled ? 'var(--border)' : c.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function MonoLabel({ children, style }) {
  return (
    <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', color: 'var(--text-muted)', ...style }}>
      {children}
    </span>
  )
}

const INPUT = {
  background: 'var(--bg-base)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '6px 10px',
  fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

// ─── Log viewer ───────────────────────────────────────────────────────────────

function LogViewer({ tunnelName }) {
  const [lines, setLines]   = useState([])
  const [live, setLive]     = useState(false)
  const [error, setError]   = useState(null)
  const wsRef               = useRef(null)
  const bottomRef           = useRef(null)
  const MAX = 600

  useEffect(() => {
    setLines([]); setError(null)
    cf.logs(tunnelName, 200)
      .then(ls => setLines(ls))
      .catch(e => setError(e.message))
  }, [tunnelName])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  function startLive() {
    if (wsRef.current) return
    const ws = connectCfLogsWs(
      tunnelName,
      (line) => setLines(p => { const n = [...p, line]; return n.length > MAX ? n.slice(-MAX) : n }),
      () => { setLive(false); wsRef.current = null; setError('Stream disconnected') }
    )
    ws.onopen  = () => setLive(true)
    ws.onclose = () => { setLive(false); wsRef.current = null }
    wsRef.current = ws
  }

  function stopLive() { wsRef.current?.close(); wsRef.current = null; setLive(false) }
  useEffect(() => () => wsRef.current?.close(), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MonoLabel>{lines.length} lines</MonoLabel>
        {live && <MonoLabel style={{ color: 'var(--success)' }}>● LIVE</MonoLabel>}
        <div style={{ flex: 1 }} />
        {live ? <Btn label="Stop" onClick={stopLive} />
               : <Btn label="Live tail" onClick={startLive} variant="accent" />}
      </div>
      {error && <MonoLabel style={{ color: 'var(--danger)' }}>{error}</MonoLabel>}
      <div style={{
        background: '#07070f', border: '1px solid var(--border)',
        padding: '12px 16px', height: '340px', overflowY: 'auto',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
        lineHeight: 1.65, color: '#8a9bb5',
      }}>
        {lines.length === 0
          ? <span style={{ opacity: 0.4 }}>No logs yet.</span>
          : lines.map((l, i) => <LogLine key={i} line={l} />)
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function LogLine({ line }) {
  if (/\bERR\b|error/i.test(line))    return <div style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
  if (/\bWARN\b|warning/i.test(line)) return <div style={{ color: 'var(--warn)',   whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
  if (/\bINF\b|info/i.test(line))     return <div style={{ color: '#7ec8a0',       whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
}

// ─── Ingress editor ───────────────────────────────────────────────────────────

function IngressEditor({ tunnelName, onSaved }) {
  const [rules, setRules]     = useState(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)

  useEffect(() => {
    setRules(null); setMsg(null)
    cf.config(tunnelName)
      .then(cfg => {
        setRules((cfg?.ingress || []).map((r, i) => ({
          _id: i,
          hostname: r.hostname || '',
          path:     r.path     || '',
          service:  r.service  || '',
        })))
      })
      .catch(e => setMsg({ ok: false, text: e.message }))
  }, [tunnelName])

  function set(id, field, val) {
    setRules(p => p.map(r => r._id === id ? { ...r, [field]: val } : r))
  }

  function remove(id) {
    setRules(p => p.filter(r => r._id !== id))
  }

  function add() {
    setRules(p => [...p, { _id: Date.now(), hostname: '', path: '', service: '' }])
  }

  async function save(andRestart) {
    if (!rules) return
    setSaving(true); setMsg(null)
    try {
      const clean = rules.map(({ _id, hostname, path, service }) => {
        const r = { service: service.trim() }
        if (hostname.trim()) r.hostname = hostname.trim()
        if (path.trim())     r.path     = path.trim()
        return r
      })
      await cf.updateIngress(tunnelName, clean)
      if (andRestart) {
        await cf.control(tunnelName, 'restart')
        setMsg({ ok: true, text: 'Saved & tunnel restarted' })
      } else {
        setMsg({ ok: true, text: 'Saved — restart tunnel to apply' })
      }
      onSaved?.()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (!rules && !msg) {
    return <MonoLabel>Loading config…</MonoLabel>
  }
  if (msg && !rules) {
    return <MonoLabel style={{ color: 'var(--danger)' }}>{msg.text}</MonoLabel>
  }

  const hasCatchAll = rules.some(r => !r.hostname.trim())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 1fr 28px', gap: '8px' }}>
        <MonoLabel>HOSTNAME</MonoLabel>
        <MonoLabel>PATH</MonoLabel>
        <MonoLabel>SERVICE</MonoLabel>
        <span />
      </div>

      {/* Rules */}
      {rules.map((r, i) => (
        <div key={r._id} style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 1fr 28px', gap: '8px', alignItems: 'center' }}>
          <input
            style={INPUT} value={r.hostname}
            placeholder="any (catch-all)"
            onChange={e => set(r._id, 'hostname', e.target.value)}
          />
          <input
            style={INPUT} value={r.path}
            placeholder=".*"
            onChange={e => set(r._id, 'path', e.target.value)}
          />
          <input
            style={INPUT} value={r.service}
            placeholder="http://localhost:8080"
            onChange={e => set(r._id, 'service', e.target.value)}
          />
          <button
            onClick={() => remove(r._id)}
            style={{
              width: '28px', height: '28px', background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--danger)',
              cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      ))}

      {/* Warning if no catch-all */}
      {!hasCatchAll && rules.length > 0 && (
        <MonoLabel style={{ color: 'var(--warn)' }}>
          ⚠ Last rule should be a catch-all (no hostname) e.g. service: http_status:404
        </MonoLabel>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
        <Btn label="+ Add rule" onClick={add} variant="ghost" />
        <div style={{ flex: 1 }} />
        <Btn label={saving ? 'Saving…' : 'Save'} onClick={() => save(false)} disabled={saving} variant="accent" />
        <Btn label={saving ? '…' : 'Save & Restart'} onClick={() => save(true)} disabled={saving} variant="warn" />
      </div>

      {msg && (
        <MonoLabel style={{ color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</MonoLabel>
      )}
    </div>
  )
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function TunnelDetail({ tunnelName, tunnel, onControl, busy, onRefresh }) {
  const [tab, setTab] = useState('ingress')

  function TabBtn({ id, label }) {
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: '10px 18px', fontSize: '11px', background: 'none', cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em',
          color: tab === id ? 'var(--accent-bright)' : 'var(--text-muted)',
          border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
          transition: 'color 0.15s',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tunnel header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        background: 'var(--bg-surface)',
      }}>
        <Dot on={tunnel?.running} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {tunnelName}
          </div>
          <MonoLabel>{tunnel?.description || tunnel?.service || ''}</MonoLabel>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {tunnel?.running
            ? <>
                <Btn label="Restart" onClick={() => onControl(tunnelName, 'restart')} disabled={busy} variant="accent" />
                <Btn label="Stop"    onClick={() => onControl(tunnelName, 'stop')}    disabled={busy} variant="danger" />
              </>
            : <Btn label="Start" onClick={() => onControl(tunnelName, 'start')} disabled={busy} variant="success" />
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--bg-surface)' }}>
        <TabBtn id="logs"    label="LOGS"    />
        <TabBtn id="ingress" label="INGRESS" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {tab === 'logs'    && <LogViewer    key={tunnelName} tunnelName={tunnelName} />}
        {tab === 'ingress' && <IngressEditor key={tunnelName} tunnelName={tunnelName} onSaved={onRefresh} />}
      </div>
    </div>
  )
}

// ─── Left tunnel list ─────────────────────────────────────────────────────────

function TunnelItem({ tunnel, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: `12px 16px 12px ${selected ? '13px' : '16px'}`, cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        background: selected ? 'var(--bg-elevated)' : 'transparent',
        borderLeft: `3px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-surface)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Dot on={tunnel.running} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 600,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {tunnel.name}
        </span>
      </div>
      <MonoLabel style={{ paddingLeft: '16px', display: 'block', color: tunnel.running ? 'var(--success)' : 'var(--text-muted)', opacity: 0.8 }}>
        {tunnel.running ? 'running' : (tunnel.sub || 'stopped')}
      </MonoLabel>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Cloudflare() {
  const [tunnels, setTunnels]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [fetchErr, setFetchErr] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy]         = useState(false)
  const [toast, setToast]       = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await cf.tunnels()
      setFetchErr(null)
      setTunnels(data)
      setSelected(prev => prev ?? (data[0]?.name || null))
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  async function handleControl(name, action) {
    setBusy(true)
    try {
      await cf.control(name, action)
      showToast(`${name}: ${action} OK`, true)
      await load()
    } catch (e) {
      showToast(e.message, false)
    } finally {
      setBusy(false)
    }
  }

  function showToast(msg, ok) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) return <LoadingDots />

  const runCount = tunnels.filter(t => t.running).length

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
            Cloudflare Tunnels
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            {fetchErr ? 'connection error · LXC 500' : `${runCount}/${tunnels.length} running · LXC 500`}
          </p>
        </div>
        {toast && (
          <div style={{
            padding: '8px 12px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
            background: toast.ok ? 'rgba(50,200,100,.1)' : 'rgba(220,50,50,.1)',
            border: `1px solid ${toast.ok ? 'var(--success)' : 'var(--danger)'}`,
            color: toast.ok ? 'var(--success)' : 'var(--danger)',
          }}>
            {toast.msg}
          </div>
        )}
      </div>

      {fetchErr && (
        <div style={{
          background: 'rgba(220,50,50,.08)', border: '1px solid var(--danger)',
          padding: '8px 12px', marginBottom: '12px', flexShrink: 0,
          fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--danger)',
        }}>
          Cannot reach LXC 500: {fetchErr}
        </div>
      )}

      {/* Two-column layout — fills remaining height */}
      <div style={{ display: 'flex', border: '1px solid var(--border)', flex: 1, minHeight: 0 }}>

        {/* Left: tunnel list */}
        <div style={{
          width: '260px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          background: '#0b0b10',
        }}>
          {tunnels.length === 0
            ? <MonoLabel style={{ padding: '16px', display: 'block' }}>No tunnels</MonoLabel>
            : tunnels.map(t => (
                <TunnelItem
                  key={t.name}
                  tunnel={t}
                  selected={selected === t.name}
                  onClick={() => setSelected(t.name)}
                />
              ))
          }
        </div>

        {/* Right: detail */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {selected
            ? <TunnelDetail
                key={selected}
                tunnelName={selected}
                tunnel={tunnels.find(t => t.name === selected)}
                onControl={handleControl}
                busy={busy}
                onRefresh={load}
              />
            : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MonoLabel>Select a tunnel</MonoLabel>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
