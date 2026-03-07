// cortex/frontend/src/components/ServiceCard.tsx
import { useState, useEffect, useRef } from 'react'
import { ExternalLink, MoreVertical, Play, Square, RotateCcw } from 'lucide-react'
import { Service, api } from '../lib/api'
import { getBundledIcon, fetchFavicon } from '../lib/icons'

function StatusDot({ status }: { status: string }) {
  const cls = status === 'running' ? 'dot dot-up'
            : status === 'exited'  ? 'dot dot-down'
            : 'dot dot-warn'
  return <span className={cls} />
}

function ServiceIcon({ type, url, name }: { type: string; url: string | null; name: string }) {
  const bundled = getBundledIcon(type)
  const [src, setSrc] = useState<string | null>(bundled)

  useEffect(() => {
    let objectUrl: string | null = null
    if (!bundled && url) {
      fetchFavicon(url).then(result => {
        objectUrl = result
        setSrc(result)
      })
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [bundled, url])

  if (src) {
    return <img src={src} alt={name} className="w-8 h-8 object-contain rounded" />
  }
  return (
    <div className="w-8 h-8 rounded bg-[var(--color-elevated)] flex items-center justify-center">
      <span className="mono text-xs text-[var(--color-text-muted)] uppercase">{name.slice(0, 2)}</span>
    </div>
  )
}

export function ServiceCard({ service }: { service: Service }) {
  const [acting, setActing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function doAction(action: string) {
    setActing(true)
    setMenuOpen(false)
    try {
      await api.services.action(service.container_id, action)
    } finally {
      setActing(false)
    }
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const isRunning = service.status === 'running'
  const targetUrl = service.public_url ?? service.url
  const displayUrl = service.public_url
    ? service.public_url.replace('https://', '').replace('http://', '')
    : service.url
    ? 'local'
    : null

  return (
    <div className={`group relative flex items-center gap-3 rounded-lg border p-3.5 glow-card
                    bg-[var(--color-surface)] transition-all cursor-pointer
                    ${isRunning
                      ? 'border-[rgba(34,197,94,0.2)]'
                      : 'border-[var(--color-border)] opacity-60'}`}
         onClick={() => targetUrl && window.open(targetUrl, '_blank')}>

      <ServiceIcon type={service.type} url={service.url} name={service.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate text-[var(--color-text-primary)]">{service.name}</p>
          <StatusDot status={service.status} />
        </div>
        {displayUrl && (
          <p className="mono text-xs text-[var(--color-text-muted)] truncate mt-0.5 flex items-center gap-1">
            <ExternalLink className="w-3 h-3 shrink-0" />
            {displayUrl}
          </p>
        )}
      </div>

      <span className="mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-elevated)] text-[var(--color-text-muted)] shrink-0">
        {service.host}
      </span>

      {/* Overflow menu */}
      <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)]
                     hover:bg-[var(--color-elevated)] transition-colors opacity-0 group-hover:opacity-100"
          disabled={acting}
        >
          {acting
            ? <RotateCcw className="w-4 h-4 animate-spin" />
            : <MoreVertical className="w-4 h-4" />}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border border-[var(--color-border)]
                          bg-[var(--color-surface)] shadow-lg shadow-black/40 py-1">
            {isRunning ? (
              <>
                <button onClick={() => doAction('restart')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-primary)]
                                   hover:bg-[var(--color-elevated)] transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Restart
                </button>
                <button onClick={() => doAction('stop')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-down)]
                                   hover:bg-[var(--color-elevated)] transition-colors">
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
              </>
            ) : (
              <button onClick={() => doAction('start')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-up)]
                                 hover:bg-[var(--color-elevated)] transition-colors">
                <Play className="w-3.5 h-3.5" /> Start
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
