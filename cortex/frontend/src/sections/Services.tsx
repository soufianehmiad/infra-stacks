// cortex/frontend/src/sections/Services.tsx — single table with right drawer
import { useState, useMemo, useEffect } from 'react'
import { ExternalLink, Play, Square, RotateCcw, CheckSquare, Square as SquareIcon } from 'lucide-react'
import { Service, api } from '../lib/api'
import { useServicesStore } from '../stores/services'
import { getBundledIcon, fetchFavicon } from '../lib/icons'
import { Drawer } from '../components/Drawer'

type Filter = 'all' | 'running' | 'stopped'

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

  if (src) return <img src={src} alt={name} className="w-5 h-5 object-contain rounded" />
  return (
    <div className="w-5 h-5 rounded bg-[var(--color-elevated)] flex items-center justify-center">
      <span className="mono text-[8px] text-[var(--color-text-muted)] uppercase">{name.slice(0, 2)}</span>
    </div>
  )
}

export function Services() {
  const { services, loading, error } = useServicesStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drawerService, setDrawerService] = useState<Service | null>(null)
  const [acting, setActing] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'running') return services.filter(s => s.status === 'running')
    if (filter === 'stopped') return services.filter(s => s.status !== 'running')
    return services
  }, [services, filter])

  const running = services.filter(s => s.status === 'running').length
  const stopped = services.length - running

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.container_id)))
  }

  async function bulkAction(action: string) {
    setActing(true)
    try {
      await Promise.allSettled(
        Array.from(selected).map(id => api.services.action(id, action))
      )
      setSelected(new Set())
    } finally { setActing(false) }
  }

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
            <button key={f.key} onClick={() => { setFilter(f.key); setSelected(new Set()) }}
                    className={`mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border transition-colors
                      ${filter === f.key
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {f.label} <span className="opacity-60">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Bulk actions — show when items selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="mono text-[10px] text-[var(--color-text-muted)]">{selected.size} selected</span>
            <button onClick={() => bulkAction('restart')} disabled={acting}
                    className="mono text-[10px] px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 transition-colors">
              Restart
            </button>
            <button onClick={() => bulkAction('stop')} disabled={acting}
                    className="mono text-[10px] px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-down)] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-40 transition-colors">
              Stop
            </button>
            <button onClick={() => bulkAction('start')} disabled={acting}
                    className="mono text-[10px] px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-up)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 transition-colors">
              Start
            </button>
            <button onClick={() => setSelected(new Set())}
                    className="mono text-[10px] px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              Clear
            </button>
          </div>
        )}

        {error && <span className="text-[10px] text-[var(--color-down)] ml-auto">{error}</span>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-5 space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 rounded bg-[var(--color-surface)] animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-void)] border-b border-[var(--color-border)]">
                <th className="w-10 px-3 py-2">
                  <button onClick={toggleAll}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare className="w-3.5 h-3.5" />
                      : <SquareIcon className="w-3.5 h-3.5" />}
                  </button>
                </th>
                <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2">STATUS</th>
                <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2">SERVICE</th>
                <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 hidden md:table-cell">URL</th>
                <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 hidden lg:table-cell">HOST</th>
                <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 hidden lg:table-cell">CATEGORY</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isRunning = s.status === 'running'
                const isSelected = selected.has(s.container_id)
                const targetUrl = s.public_url ?? s.url
                const displayUrl = s.public_url ? s.public_url.replace(/^https?:\/\//, '') : s.url ? 'local' : '—'

                return (
                  <tr key={s.container_id}
                      onClick={() => setDrawerService(s)}
                      className={`border-b border-[var(--color-border)] cursor-pointer transition-colors
                        ${isSelected ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-[var(--color-elevated)]'}
                        ${!isRunning ? 'opacity-50' : ''}`}>
                    <td className="w-10 px-3 py-2" onClick={e => { e.stopPropagation(); toggleSelect(s.container_id) }}>
                      <button className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                        {isSelected
                          ? <CheckSquare className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                          : <SquareIcon className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`dot ${isRunning ? 'dot-up' : s.status === 'exited' ? 'dot-down' : 'dot-warn'}`} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ServiceIcon type={s.type} url={s.url} name={s.name} />
                        <span className="text-sm text-[var(--color-text-primary)]">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {targetUrl ? (
                        <a href={targetUrl} target="_blank" rel="noopener"
                           className="mono text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 w-fit"
                           onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          {displayUrl}
                        </a>
                      ) : (
                        <span className="mono text-xs text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <span className="mono text-[10px] text-[var(--color-text-muted)]">{s.host}</span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <span className="mono text-[10px] px-2 py-0.5 rounded bg-[var(--color-elevated)] text-[var(--color-text-muted)]">
                        {s.category}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <span className="mono text-xs text-[var(--color-text-muted)]">
                      {services.length === 0 ? 'No services discovered' : 'No matching services'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
