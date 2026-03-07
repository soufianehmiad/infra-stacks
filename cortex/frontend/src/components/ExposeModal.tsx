// cortex/frontend/src/components/ExposeModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { Service, api } from '../lib/api'
import { useServicesStore } from '../stores/services'

const BASE_DOMAIN = 'cirrolink.com'
const DEFAULT_TUNNEL = 'user-apps'

interface Props {
  service: Service
  onClose: () => void
}

export function ExposeModal({ service, onClose }: Props) {
  const defaultHostname = `${service.type}.${BASE_DOMAIN}`
  const defaultInternal = service.url ?? `http://10.99.0.10:${service.port ?? 80}`
  const isExposed = Boolean(service.public_url)

  const exposedHostname = service.public_url ? service.public_url.replace(/^https?:\/\//, '') : defaultHostname
  const [hostname, setHostname] = useState(exposedHostname)
  const [internalUrl, setInternalUrl] = useState(defaultInternal)
  const [tunnel, setTunnel] = useState(DEFAULT_TUNNEL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExpose() {
    setSaving(true)
    setError(null)
    try {
      await api.tunnels.expose(tunnel, hostname, internalUrl)
      await useServicesStore.getState().refresh()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnexpose() {
    setSaving(true)
    setError(null)
    try {
      // Always use the actual exposed hostname, not the editable field
      const currentHostname = service.public_url
        ? service.public_url.replace(/^https?:\/\//, '')
        : hostname
      await api.tunnels.unexpose(tunnel, currentHostname)
      await useServicesStore.getState().refresh()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full rounded border border-[var(--color-border)] bg-[var(--color-void)]
                    px-3 py-2 mono text-sm text-[var(--color-text-primary)]
                    focus:outline-none focus:border-[var(--color-accent)]
                    transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-void)]/60 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-medium text-[var(--color-text-primary)]">
              {isExposed ? 'Manage public URL' : 'Expose service'}
            </h2>
            <p className="mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{service.name}</p>
          </div>
          <button onClick={onClose}
                  className="p-1.5 rounded border border-transparent hover:border-[var(--color-border)]
                             hover:bg-[var(--color-elevated)] transition-colors">
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">Tunnel</span>
            <input value={tunnel} onChange={e => setTunnel(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">Public hostname</span>
            <input value={hostname} onChange={e => setHostname(e.target.value)}
                   placeholder={defaultHostname} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">Internal URL</span>
            <input value={internalUrl} onChange={e => setInternalUrl(e.target.value)} className={inputCls} />
          </label>

          {error && (
            <p className="mono text-[11px] text-[var(--color-down)] border border-[var(--color-down)]/30
                          bg-[var(--color-down)]/10 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 mt-1">
            {isExposed && (
              <button onClick={handleUnexpose} disabled={saving}
                      className="flex-1 py-2 rounded border border-[var(--color-down)]/40
                                 text-[var(--color-down)] mono text-sm
                                 hover:bg-[var(--color-down)]/10 disabled:opacity-40 transition-colors">
                {saving ? 'Removing…' : 'Remove'}
              </button>
            )}
            <button onClick={handleExpose} disabled={saving || !hostname || !internalUrl}
                    className="flex-1 py-2 rounded border border-[var(--color-accent)]/50
                               bg-[var(--color-accent-dim)] text-[var(--color-accent)] mono text-sm
                               hover:bg-[var(--color-accent)]/20 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : isExposed ? 'Update' : 'Expose'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
