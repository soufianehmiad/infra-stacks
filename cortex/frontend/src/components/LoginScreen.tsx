// cortex/frontend/src/components/LoginScreen.tsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../stores/auth'

const TERMINAL_LINES = [
  '> establishing secure channel...',
  '> handshake protocol: TLS 1.3',
  '> cipher: AES-256-GCM',
  '> verifying server identity...',
  '> certificate chain: valid',
  '> session key exchanged',
  '> encrypted tunnel: active',
  '> awaiting credentials_',
]

function TerminalBoot() {
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < TERMINAL_LINES.length) {
        setLines(prev => [...prev, TERMINAL_LINES[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 180)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="font-display text-[11px] text-[var(--color-accent)] opacity-50 space-y-1.5">
      {lines.map((line, i) => (
        <div key={i} className={i === lines.length - 1 ? 'animate-pulse' : ''}>{line}</div>
      ))}
    </div>
  )
}

export function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(username, password)
    } catch {
      setError('ACCESS DENIED')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--color-void)]">
      {/* Left panel */}
      <div className="hidden md:flex flex-col flex-1 relative overflow-hidden border-r border-[var(--color-border)]">
        <img
          src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnV6NnR6dWJrOHRlMmd3c3Fkd295YW51ajJ0N2d2eXl2OHdubTRqbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tn33aiTi1jkl6H6/giphy.gif"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-[0.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-void)] via-transparent to-[var(--color-void)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-void)] via-transparent to-[var(--color-void)]" />

        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          <div>
            <div className="font-display text-[var(--color-accent)] text-2xl tracking-[0.3em] font-semibold mb-2"
                 style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.5)' }}>
              CORTEX
            </div>
            <div className="font-display text-[11px] text-[var(--color-text-muted)] tracking-[0.15em]">
              INFRASTRUCTURE CONTROL PLANE
            </div>
          </div>

          <TerminalBoot />

          <div className="font-display text-[10px] text-[var(--color-text-muted)] opacity-35 tracking-wider">
            v2.0 // SECURE GATEWAY
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center w-full md:w-[420px] md:min-w-[420px] shrink-0 p-8">
        <div className="w-full max-w-[320px]">
          {/* Mobile logo */}
          <div className="md:hidden mb-10">
            <div className="font-display text-[var(--color-accent)] text-lg tracking-[0.3em] font-semibold"
                 style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.5)' }}>
              CORTEX
            </div>
            <div className="font-display text-[10px] text-[var(--color-text-muted)] tracking-[0.15em]">
              INFRASTRUCTURE CONTROL PLANE
            </div>
          </div>

          <div className="label mb-6">// AUTHENTICATE</div>

          <form onSubmit={submit} action="/api/auth/login" method="POST" className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="label block mb-2">USER</label>
              <input
                ref={inputRef}
                id="username"
                type="text"
                name="username"
                autoComplete="username"
                placeholder="root"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="password" className="label block mb-2">PASS</label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
              />
            </div>

            {error && (
              <div className="font-display text-[11px] text-[var(--color-down)] tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[var(--color-down)] inline-block" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="font-display text-[11px] tracking-[0.25em] py-3 mt-2 border border-[var(--color-accent)] text-[var(--color-accent)]
                         bg-[var(--color-accent-dim)] font-semibold disabled:opacity-25 disabled:cursor-default cursor-pointer
                         hover:bg-[var(--color-accent)] hover:text-[var(--color-void)] transition-all"
            >
              {busy ? '> VERIFYING...' : '> LOGIN'}
            </button>
          </form>

          <div className="font-display text-[9px] text-[var(--color-text-muted)] opacity-25 mt-8 tracking-wider">
            ENCRYPTED SESSION // AES-256
          </div>
        </div>
      </div>
    </div>
  )
}
