// cortex/frontend/src/components/LoginScreen.tsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../stores/auth'

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
      setError('Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-void)]">
      <div className="w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8"
           style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.08)' }}>
        <div className="mono text-sm text-[var(--color-accent)] tracking-[0.25em] mb-1"
             style={{ textShadow: '0 0 10px rgba(34, 197, 94, 0.4)' }}>CORTEX</div>
        <div className="text-xs text-[var(--color-text-muted)] mb-8">control plane · authenticate</div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="text-sm bg-[var(--color-void)] border border-[var(--color-border)] text-[var(--color-text-primary)]
                       rounded px-3 py-2.5 outline-none focus:border-[var(--color-accent)] transition-colors
                       placeholder:text-[var(--color-text-muted)]"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="text-sm bg-[var(--color-void)] border border-[var(--color-border)] text-[var(--color-text-primary)]
                       rounded px-3 py-2.5 outline-none focus:border-[var(--color-accent)] transition-colors
                       placeholder:text-[var(--color-text-muted)]"
          />
          {error && <span className="text-xs text-[var(--color-down)]">{error}</span>}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="mono text-xs tracking-[0.2em] py-2.5 bg-[var(--color-accent)] text-[var(--color-void)]
                       font-bold disabled:opacity-40 disabled:cursor-default cursor-pointer rounded
                       hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 16px rgba(34, 197, 94, 0.3)' }}
          >
            {busy ? 'VERIFYING...' : 'AUTHENTICATE'}
          </button>
        </form>
      </div>
    </div>
  )
}
