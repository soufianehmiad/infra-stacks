// cortex/frontend/src/sections/Services.tsx — card grid grouped by category or host
import { useState, useMemo, useEffect } from 'react'
import { ExternalLink, Play, Square, RotateCcw, MoreVertical, Layers, Server } from 'lucide-react'
import { Service, api } from '../lib/api'
import { useServicesStore } from '../stores/services'
import { getBundledIcon, fetchFavicon } from '../lib/icons'
import { Drawer } from '../components/Drawer'

type Filter = 'all' | 'running' | 'stopped'
type GroupBy = 'category' | 'host'

const LS_GROUP_KEY = 'cortex:services:groupBy'

function loadGroupBy(): GroupBy {
  const v = localStorage.getItem(LS_GROUP_KEY)
  return v === 'host' ? 'host' : 'category'
}

function ServiceIcon({ type, url, name }: { type: string; url: string | null; name: string }) {
  const bundled = getBundledIcon(type)
  const [src, setSrc] = useState<string | null>(bundled)
  useEffect(() => {
    let objectUrl: string | null = null
    if (!bundled && url) {
      fetchFavicon(url).then(r => { objectUrl = r; setSrc(r) })
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [bundled, url])

  if (src) return <img src={src} alt={name} className="w-8 h-8 object-contain rounded" />
  return (
    <div className="w-8 h-8 rounded bg-[var(--color-elevated)] flex items-center justify-center">
      <span className="mono text-xs text-[var(--color-text-muted)] uppercase">{name.slice(0, 2)}</span>
    </div>
  )
}

function ServiceCard({ service, onSelect }: { service: Service; onSelect: (s: Service) => void }) {
  const [acting, setActing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  async function doAction(e: React.MouseEvent, action: string) {
    e.stopPropagation()
    setActing(true)
    setMenuOpen(false)
    try { await api.services.action(service.container_id, action) }
    finally { setActing(false) }
  }

  const isRunning = service.status === 'running'
  const targetUrl = service.public_url ?? service.url

  return (
    <div
      onClick={() => onSelect(service)}
      className={`group relative flex items-center gap-3 rounded-lg border p-3.5
                  bg-[var(--color-surface)] transition-all cursor-pointer hover:bg-[var(--color-elevated)]
                  ${isRunning
                    ? 'border-[rgba(34,197,94,0.15)]'
                    : 'border-[var(--color-border)] opacity-50'}`}
    >
      <ServiceIcon type={service.type} url={service.url} name={service.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate text-[var(--color-text-primary)]">{service.name}</p>
          <span className={`dot ${isRunning ? 'dot-up' : service.status === 'exited' ? 'dot-down' : 'dot-warn'}`} />
        </div>
        {targetUrl && (
          <a href={targetUrl} target="_blank" rel="noopener"
             onClick={e => e.stopPropagation()}
             className="mono text-[11px] text-[var(--color-text-muted)] truncate mt-0.5 flex items-center gap-1 hover:text-[var(--color-accent)]">
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            {(service.public_url ?? service.url ?? '').replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      {/* Quick actions */}
      <div className="relative" onClick={e => e.stopPropagation()}>
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
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border border-[var(--color-border)]
                            bg-[var(--color-surface)] shadow-lg shadow-black/40 py-1">
              {isRunning ? (
                <>
                  <button onClick={e => doAction(e, 'restart')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-primary)]
                                     hover:bg-[var(--color-elevated)] transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                  </button>
                  <button onClick={e => doAction(e, 'stop')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-down)]
                                     hover:bg-[var(--color-elevated)] transition-colors">
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                </>
              ) : (
                <button onClick={e => doAction(e, 'start')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-up)]
                                   hover:bg-[var(--color-elevated)] transition-colors">
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Services() {
  const { services, loading, error } = useServicesStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>(loadGroupBy)
  const [drawerService, setDrawerService] = useState<Service | null>(null)
  const [acting, setActing] = useState(false)

  function changeGroupBy(g: GroupBy) {
    setGroupBy(g)
    localStorage.setItem(LS_GROUP_KEY, g)
  }

  const filtered = useMemo(() => {
    if (filter === 'running') return services.filter(s => s.status === 'running')
    if (filter === 'stopped') return services.filter(s => s.status !== 'running')
    return services
  }, [services, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const s of filtered) {
      const key = groupBy === 'category' ? (s.category || 'other') : (s.host || 'unknown')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    // Sort groups alphabetically, but put 'other'/'unknown' last
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'other' || a === 'unknown') return 1
      if (b === 'other' || b === 'unknown') return -1
      return a.localeCompare(b)
    })
  }, [filtered, groupBy])

  const running = services.filter(s => s.status === 'running').length
  const stopped = services.length - running

  async function singleAction(service: Service, action: string) {
    setActing(true)
    try { await api.services.action(service.container_id, action) }
    finally { setActing(false) }
  }

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: services.length },
    { key: 'running', label: 'Running', count: running },
    { key: 'stopped', label: 'Stopped', count: stopped },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface)] flex-wrap">
        {/* Filters */}
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors
                      ${filter === f.key
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {f.label} <span className="opacity-60">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => changeGroupBy('category')}
                  className={`flex items-center gap-1.5 mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors
                    ${groupBy === 'category'
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
            <Layers className="w-3 h-3" /> Category
          </button>
          <button onClick={() => changeGroupBy('host')}
                  className={`flex items-center gap-1.5 mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors
                    ${groupBy === 'host'
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
            <Server className="w-3 h-3" /> Host
          </button>
        </div>

        {error && <span className="text-[10px] text-[var(--color-down)]">{error}</span>}
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-auto p-5 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-lg bg-[var(--color-surface)] animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center">
            <span className="mono text-xs text-[var(--color-text-muted)]">
              {services.length === 0 ? 'No services discovered' : 'No matching services'}
            </span>
          </div>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group}>
              <h2 className="mono text-[10px] tracking-[0.2em] text-[var(--color-text-muted)] uppercase mb-3 px-1">
                {group}
                <span className="opacity-50 ml-2">{items.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map(s => (
                  <ServiceCard key={s.container_id} service={s} onSelect={setDrawerService} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail drawer */}
      <Drawer open={!!drawerService} onClose={() => setDrawerService(null)} title="SERVICE DETAILS">
        {drawerService && (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <ServiceIcon type={drawerService.type} url={drawerService.url} name={drawerService.name} />
              <div>
                <h3 className="text-sm text-[var(--color-text-primary)] font-medium">{drawerService.name}</h3>
                <span className="mono text-[10px] text-[var(--color-text-muted)]">{drawerService.type}</span>
              </div>
              <span className={`dot ml-auto ${drawerService.status === 'running' ? 'dot-up' : 'dot-down'}`} />
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {([
                ['Status', drawerService.status],
                ['Host', drawerService.host],
                ['Category', drawerService.category],
                ['Port', drawerService.port?.toString() ?? '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-0.5">{k.toUpperCase()}</div>
                  <div className="text-xs text-[var(--color-text-primary)]">{v}</div>
                </div>
              ))}
            </div>

            {/* URLs */}
            {(drawerService.url || drawerService.public_url) && (
              <div className="space-y-2">
                <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider">URLS</div>
                {drawerService.url && (
                  <a href={drawerService.url} target="_blank" rel="noopener"
                     className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline">
                    <ExternalLink className="w-3 h-3" /> {drawerService.url}
                  </a>
                )}
                {drawerService.public_url && drawerService.public_url !== drawerService.url && (
                  <a href={drawerService.public_url} target="_blank" rel="noopener"
                     className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline">
                    <ExternalLink className="w-3 h-3" /> {drawerService.public_url}
                  </a>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider">ACTIONS</div>
              <div className="flex gap-2">
                {drawerService.status === 'running' ? (
                  <>
                    <button onClick={() => singleAction(drawerService, 'restart')} disabled={acting}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                                       text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> Restart
                    </button>
                    <button onClick={() => singleAction(drawerService, 'stop')} disabled={acting}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-down)]/30
                                       text-xs text-[var(--color-down)] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-40 transition-colors">
                      <Square className="w-3.5 h-3.5" /> Stop
                    </button>
                  </>
                ) : (
                  <button onClick={() => singleAction(drawerService, 'start')} disabled={acting}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                                     text-xs text-[var(--color-up)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 transition-colors">
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                )}
              </div>
            </div>

            {/* Open URL button */}
            {(drawerService.public_url ?? drawerService.url) && (
              <button onClick={() => window.open(drawerService.public_url ?? drawerService.url!, '_blank')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg
                                 bg-[var(--color-accent)] text-[var(--color-void)] text-xs font-bold mono tracking-wider
                                 hover:opacity-90 transition-opacity"
                      style={{ boxShadow: '0 0 16px rgba(34, 197, 94, 0.3)' }}>
                <ExternalLink className="w-3.5 h-3.5" /> OPEN SERVICE
              </button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
