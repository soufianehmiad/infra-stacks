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
    <div className="flex h-screen w-screen items-center justify-center bg-void">
      <div className="w-80 tile p-8">
        <div className="mono text-xs text-[var(--color-accent)] tracking-[0.2em] mb-1">CORTEX</div>
        <div className="mono text-[10px] text-[var(--color-text-muted)] mb-8">control plane · authenticate</div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="mono text-sm bg-void border border-[var(--color-border)] text-[var(--color-text-primary)]
                       px-3 py-2 outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mono text-sm bg-void border border-[var(--color-border)] text-[var(--color-text-primary)]
                       px-3 py-2 outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          {error && <span className="mono text-[10px] text-[var(--color-down)]">{error}</span>}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="mono text-xs tracking-[0.15em] py-2 bg-[var(--color-accent)] text-void
                       font-bold disabled:opacity-40 disabled:cursor-default cursor-pointer
                       hover:opacity-90 transition-opacity"
          >
            {busy ? 'VERIFYING...' : 'AUTHENTICATE'}
          </button>
        </form>
      </div>
    </div>
  )
}
