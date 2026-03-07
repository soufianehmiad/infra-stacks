// cortex/frontend/src/sections/Services.tsx
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

  if (src) return <img src={src} alt={name} className="w-7 h-7 object-contain" />
  return (
    <div className="w-7 h-7 bg-[var(--color-elevated)] flex items-center justify-center">
      <span className="font-display text-[10px] text-[var(--color-text-muted)] uppercase">{name.slice(0, 2)}</span>
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
      className={`group relative tile glow-card flex items-center gap-3 p-3.5
                  cursor-pointer transition-all
                  ${isRunning ? 'border-[var(--color-border)]' : 'border-[var(--color-border)] opacity-45'}`}
    >
      <ServiceIcon type={service.type} url={service.url} name={service.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium truncate text-[var(--color-text-primary)]">{service.name}</p>
          <span className={`dot ${isRunning ? 'dot-up' : service.status === 'exited' ? 'dot-down' : 'dot-warn'}`} />
        </div>
        {targetUrl && (
          <a href={targetUrl} target="_blank" rel="noopener"
             onClick={e => e.stopPropagation()}
             className="font-display text-[11px] text-[var(--color-text-muted)] truncate mt-0.5 flex items-center gap-1 hover:text-[var(--color-accent)]">
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            {(service.public_url ?? service.url ?? '').replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      <div className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]
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
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] border border-[var(--color-border)]
                            bg-[var(--color-surface)] shadow-lg shadow-black/50 py-1">
              {isRunning ? (
                <>
                  <button onClick={e => doAction(e, 'restart')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-primary)]
                                     hover:bg-[var(--color-elevated)] transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                  </button>
                  <button onClick={e => doAction(e, 'stop')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-down)]
                                     hover:bg-[var(--color-elevated)] transition-colors">
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                </>
              ) : (
                <button onClick={e => doAction(e, 'start')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-up)]
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
      <div className="toolbar">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`pill ${filter === f.key ? 'pill-active' : ''}`}>
              {f.label} <span className="opacity-50">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => changeGroupBy('category')}
                  className={`pill flex items-center gap-1.5 ${groupBy === 'category' ? 'pill-active' : ''}`}>
            <Layers className="w-3 h-3" /> Category
          </button>
          <button onClick={() => changeGroupBy('host')}
                  className={`pill flex items-center gap-1.5 ${groupBy === 'host' ? 'pill-active' : ''}`}>
            <Server className="w-3 h-3" /> Host
          </button>
        </div>

        {error && <span className="text-[11px] text-[var(--color-down)]">{error}</span>}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[68px] bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-16 text-center">
            <span className="font-display text-[12px] text-[var(--color-text-muted)]">
              {services.length === 0 ? 'No services discovered' : 'No matching services'}
            </span>
          </div>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group}>
              <h2 className="label-accent mb-3 px-1">
                {group}
                <span className="text-[var(--color-text-muted)] ml-2">{items.length}</span>
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

      {/* Drawer */}
      <Drawer open={!!drawerService} onClose={() => setDrawerService(null)} title="SERVICE DETAILS">
        {drawerService && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <ServiceIcon type={drawerService.type} url={drawerService.url} name={drawerService.name} />
              <div>
                <h3 className="text-[14px] text-[var(--color-text-primary)] font-medium">{drawerService.name}</h3>
                <span className="font-display text-[11px] text-[var(--color-text-muted)]">{drawerService.type}</span>
              </div>
              <span className={`dot ml-auto ${drawerService.status === 'running' ? 'dot-up' : 'dot-down'}`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {([
                ['Status', drawerService.status],
                ['Host', drawerService.host],
                ['Category', drawerService.category],
                ['Port', drawerService.port?.toString() ?? '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="label mb-1">{k.toUpperCase()}</div>
                  <div className="text-[13px] text-[var(--color-text-primary)]">{v}</div>
                </div>
              ))}
            </div>

            {(drawerService.url || drawerService.public_url) && (
              <div className="space-y-2">
                <div className="label">URLS</div>
                {drawerService.url && (
                  <a href={drawerService.url} target="_blank" rel="noopener"
                     className="flex items-center gap-2 text-[12px] text-[var(--color-accent)] hover:underline">
                    <ExternalLink className="w-3 h-3" /> {drawerService.url}
                  </a>
                )}
                {drawerService.public_url && drawerService.public_url !== drawerService.url && (
                  <a href={drawerService.public_url} target="_blank" rel="noopener"
                     className="flex items-center gap-2 text-[12px] text-[var(--color-accent)] hover:underline">
                    <ExternalLink className="w-3 h-3" /> {drawerService.public_url}
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="label">ACTIONS</div>
              <div className="flex gap-2">
                {drawerService.status === 'running' ? (
                  <>
                    <button onClick={() => singleAction(drawerService, 'restart')} disabled={acting}
                            className="btn btn-accent flex-1 flex items-center justify-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5" /> Restart
                    </button>
                    <button onClick={() => singleAction(drawerService, 'stop')} disabled={acting}
                            className="btn btn-danger flex-1 flex items-center justify-center gap-2">
                      <Square className="w-3.5 h-3.5" /> Stop
                    </button>
                  </>
                ) : (
                  <button onClick={() => singleAction(drawerService, 'start')} disabled={acting}
                          className="btn btn-accent flex-1 flex items-center justify-center gap-2">
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                )}
              </div>
            </div>

            {(drawerService.public_url ?? drawerService.url) && (
              <button onClick={() => window.open(drawerService.public_url ?? drawerService.url!, '_blank')}
                      className="w-full flex items-center justify-center gap-2 py-3
                                 bg-[var(--color-accent)] text-[var(--color-void)] text-[12px] font-bold font-display tracking-wider
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
