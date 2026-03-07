// cortex/frontend/src/sections/Kubernetes.tsx
import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { api, type K8sApp } from '../lib/api'

export function Kubernetes() {
  const [apps, setApps] = useState<K8sApp[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setApps(await api.kubernetes.apps()) } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const grouped = new Map<string, K8sApp[]>()
  for (const app of apps) {
    const list = grouped.get(app.project) ?? []
    list.push(app)
    grouped.set(app.project, list)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">KUBERNETES</h1>
          <p className="page-subtitle">Work apps on K3s cluster</p>
        </div>
        <button onClick={load} disabled={loading}
                className="btn flex items-center gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && apps.length === 0 && (
          <div className="py-16 text-center font-display text-[12px] text-[var(--color-text-muted)]">Loading...</div>
        )}

        {[...grouped.entries()].map(([project, items]) => {
          const sorted = [...items].sort((a, b) => {
            if (a.environment !== b.environment) return a.environment === 'production' ? -1 : 1
            return a.hostname.localeCompare(b.hostname)
          })

          return (
            <div key={project} className="mb-8">
              <h2 className="label-accent mb-3">{project.toUpperCase()}</h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map(app => (
                  <a key={app.hostname}
                     href={app.url}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="tile glow-card group p-4 flex flex-col gap-3 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`dot ${app.healthy ? 'dot-up' : 'dot-down'}`} />
                        <span className="text-[13px] text-[var(--color-text-primary)]">{app.service}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="font-display text-[12px] text-[var(--color-accent)] truncate">{app.hostname}</div>

                    <div className="flex items-center justify-between">
                      <span className={`font-display text-[10px] px-2 py-0.5 border tracking-wider
                        ${app.environment === 'production'
                          ? 'border-[var(--color-accent)]/25 text-[var(--color-accent)]'
                          : 'border-[var(--color-warn)]/25 text-[var(--color-warn)]'}`}>
                        {app.environment.toUpperCase()}
                      </span>
                      <span className={`font-display text-[11px] ${app.healthy ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                        {app.pods_ready}/{app.pods_total} pods
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        })}

        {!loading && apps.length === 0 && (
          <div className="py-16 text-center font-display text-[12px] text-[var(--color-text-muted)]">No apps found</div>
        )}
      </div>
    </div>
  )
}
