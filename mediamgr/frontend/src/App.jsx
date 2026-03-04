import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { apiFetch } from './api.js'
import Dashboard from './pages/Dashboard.jsx'
import Library from './pages/Library.jsx'
import Jobs from './pages/Jobs.jsx'
import Cloudflare from './pages/Cloudflare.jsx'

// ─── Auth ────────────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      if (res.ok) { onSuccess() }
      else { setError('Invalid token') }
    } catch { setError('Connection error') }
    finally { setBusy(false) }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: 'var(--bg-base)',
    }}>
      <div style={{ width: '320px' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: '4px' }}>
          MediaMgr
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '24px' }}>
          Enter access token to continue
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={inputRef}
            type="password"
            placeholder="Access token"
            value={token}
            onChange={e => setToken(e.target.value)}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '10px 12px',
              fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
          {error && (
            <span style={{ fontSize: '11px', color: 'var(--danger)', fontFamily: "'JetBrains Mono', monospace" }}>
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            style={{
              background: busy || !token.trim() ? 'var(--border)' : 'var(--accent)',
              color: 'var(--bg-base)', border: 'none', padding: '10px 16px',
              fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.08em', cursor: busy || !token.trim() ? 'default' : 'pointer',
              fontWeight: 700,
            }}
          >
            {busy ? 'Verifying…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  )
}

function LoginGate({ children }) {
  const [state, setState] = useState('checking') // checking | ok | login

  async function check() {
    try {
      await apiFetch('/api/scan/status')
      setState('ok')
    } catch (e) {
      if (String(e.message).startsWith('401')) setState('login')
      else setState('ok') // non-auth error — let the app show it
    }
  }

  useEffect(() => { check() }, [])

  if (state === 'checking') return null
  if (state === 'login') return <LoginScreen onSuccess={() => setState('ok')} />
  return children
}

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        margin: '1px 8px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--accent-bright)' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-dim)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
        fontFamily: "'Barlow', sans-serif",
      })}
    >
      {label}
    </NavLink>
  )
}

function Sidebar() {
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let mounted = true
    async function ping() {
      try {
        await apiFetch('/api/scan/status')
        if (mounted) setConnected(true)
      } catch {
        if (mounted) setConnected(false)
      }
    }
    ping()
    const id = setInterval(ping, 10000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  return (
    <aside className="sidebar-bg" style={{
      width: '200px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          MediaMgr
        </div>
        <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Media Library Manager
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        <NavItem to="/" end label="Dashboard" />
        <NavItem to="/library" label="Library" />
        <NavItem to="/jobs" label="Jobs" />
        <NavItem to="/cloudflare" label="Cloudflare" />
      </nav>

      {/* Online indicator */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          className={connected ? 'pulse-dot' : ''}
          style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--accent)' : 'var(--danger)', flexShrink: 0 }}
        />
        <span style={{ fontSize: '12px', color: connected ? 'var(--text-muted)' : 'var(--danger)', fontFamily: "'Barlow', sans-serif" }}>
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <LoginGate>
    <BrowserRouter basename="/mediamgr">
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        position: 'fixed',
        top: 0,
        left: 0,
      }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'var(--bg-base)',
          height: '100%',
        }}>
          <div style={{ padding: '32px 40px', minHeight: '100%' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/cloudflare" element={<Cloudflare />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
    </LoginGate>
  )
}
