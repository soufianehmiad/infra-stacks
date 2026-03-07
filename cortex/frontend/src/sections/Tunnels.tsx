// cortex/frontend/src/sections/Tunnels.tsx
import { useEffect, useState } from 'react'
import { Play, Square, RotateCcw, Plus, Pencil, Trash2 } from 'lucide-react'
import { api, type Tunnel } from '../lib/api'

interface IngressRule {
  hostname?: string
  service: string
  path?: string
}

interface EditState {
  index: number | null  // null = adding new
  hostname: string
  service: string
}

export function Tunnels() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [ingress, setIngress] = useState<Record<string, IngressRule[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [activeTunnel, setActiveTunnel] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'ingress' | 'logs'>('ingress')
  const [editing, setEditing] = useState<EditState | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = async () => {
    try {
      const ts = await api.tunnels.list()
      setTunnels(ts)
      if (!activeTunnel && ts.length > 0) setActiveTunnel(ts[0].name)
      for (const t of ts) {
        api.tunnels.getConfig(t.name).then((cfg: any) => {
          if (cfg?.ingress) setIngress(prev => ({ ...prev, [t.name]: cfg.ingress }))
        }).catch(() => {})
      }
    } catch { /* silent */ }
  }

  useEffect(() => { load() }, [])

  const loadLogs = async (name: string) => {
    try {
      const lines = await api.tunnels.getLogs(name, 80)
      setLogs(l => ({ ...l, [name]: lines }))
    } catch { /* silent */ }
  }

  const doControl = async (name: string, action: string) => {
    setBusy(`${name}:${action}`)
    try { await api.tunnels.control(name, action); await load() } finally { setBusy(null) }
  }

  const doExpose = async (tunnel: string) => {
    if (!editing || !editing.hostname.trim() || !editing.service.trim()) return
    setBusy('expose')
    setErrorMsg(null)
    try {
      await api.tunnels.expose(tunnel, editing.hostname.trim(), editing.service.trim())
      setEditing(null)
      await load()
    } catch (e: any) {
      setErrorMsg(`Failed: ${e.message ?? e}`)
    } finally { setBusy(null) }
  }

  const doUnexpose = async (tunnel: string, hostname: string) => {
    if (!confirm(`Remove ingress rule for ${hostname}?`)) return
    setBusy(`del:${hostname}`)
    setErrorMsg(null)
    try {
      await api.tunnels.unexpose(tunnel, hostname)
      await load()
    } catch (e: any) {
      setErrorMsg(`Failed to remove ${hostname}: ${e.message ?? e}`)
    } finally { setBusy(null) }
  }

  const current = tunnels.find(t => t.name === activeTunnel)
  const rules = activeTunnel ? (ingress[activeTunnel] ?? []) : []

  const inputClass = "w-full bg-[var(--color-void)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
  const btnClass = "px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-40 transition-colors"

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <h1 className="mono text-lg text-[var(--color-text-primary)] tracking-wide">CLOUDFLARED</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Tunnel ingress & diagnostics</p>
      </div>

      {/* Tunnel tabs */}
      <div className="flex border-b border-[var(--color-border)] px-4 shrink-0">
        {tunnels.map(t => (
          <button
            key={t.name}
            onClick={() => { setActiveTunnel(t.name); setEditing(null) }}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors
              ${activeTunnel === t.name
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            <span className={`dot ${t.running ? 'dot-up' : 'dot-down'}`} />
            {t.name}
          </button>
        ))}
        {tunnels.length === 0 && (
          <span className="px-4 py-3 text-xs text-[var(--color-text-muted)]">No tunnels — check SSH connection</span>
        )}
      </div>

      {current && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tunnel controls + sub-tabs */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-center gap-4">
              <span className={`text-sm ${current.running ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                {current.active} · {current.sub}
              </span>
              <div className="flex gap-1">
                {([
                  { action: 'start', icon: Play, color: 'var(--color-up)' },
                  { action: 'stop', icon: Square, color: 'var(--color-down)' },
                  { action: 'restart', icon: RotateCcw, color: 'var(--color-accent)' },
                ] as const).map(({ action, icon: Icon, color }) => (
                  <button key={action} disabled={!!busy}
                          onClick={() => doControl(current.name, action)}
                          className="p-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-elevated)]
                                     disabled:opacity-40 transition-colors"
                          title={action}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              {(['ingress', 'logs'] as const).map(tab => (
                <button key={tab}
                        onClick={() => { setSubTab(tab); if (tab === 'logs') loadLogs(current.name) }}
                        className={`px-4 py-1.5 text-xs transition-colors
                          ${subTab === tab
                            ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Error bar */}
          {errorMsg && (
            <div className="px-6 py-2 bg-[rgba(239,68,68,0.08)] border-b border-[var(--color-down)]/30 flex items-center justify-between">
              <span className="mono text-[11px] text-[var(--color-down)]">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="mono text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">dismiss</button>
            </div>
          )}

          {/* Ingress table */}
          {subTab === 'ingress' && (
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="mono text-xs text-[var(--color-text-muted)] text-left py-2 px-3 tracking-wider">HOSTNAME</th>
                    <th className="mono text-xs text-[var(--color-text-muted)] text-left py-2 px-3 tracking-wider">SERVICE</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => {
                    const isEditing = editing?.index === i
                    if (isEditing) {
                      return (
                        <tr key={i} className="border-b border-[var(--color-border)] bg-[var(--color-elevated)]">
                          <td className="px-3 py-2">
                            <input value={editing!.hostname} onChange={e => setEditing({ ...editing!, hostname: e.target.value })}
                                   className={inputClass} placeholder="hostname" autoFocus />
                          </td>
                          <td className="px-3 py-2">
                            <input value={editing!.service} onChange={e => setEditing({ ...editing!, service: e.target.value })}
                                   className={inputClass} placeholder="http://host:port" />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => doExpose(current.name)} disabled={!!busy} className={btnClass}>Save</button>
                              <button onClick={() => setEditing(null)} className={btnClass}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i} className={`group border-b border-[var(--color-border)] hover:bg-[var(--color-elevated)] transition-colors
                                    ${!rule.hostname ? 'opacity-40' : ''}`}>
                        <td className="text-sm text-[var(--color-accent)] px-3 py-2.5">
                          {rule.hostname ?? <span className="italic text-[var(--color-text-muted)]">catch-all</span>}
                        </td>
                        <td className="text-sm text-[var(--color-text-muted)] px-3 py-2.5">{rule.service}</td>
                        <td className="px-3 py-2.5">
                          {rule.hostname && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditing({ index: i, hostname: rule.hostname ?? '', service: rule.service })}
                                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => doUnexpose(current.name, rule.hostname!)}
                                      disabled={!!busy}
                                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-down)] transition-colors disabled:opacity-40">
                                {busy === `del:${rule.hostname}` ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Add rule */}
              {editing?.index === null ? (
                <div className="mt-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] space-y-3">
                  <input value={editing.hostname} onChange={e => setEditing({ ...editing, hostname: e.target.value })}
                         placeholder="hostname (e.g. app.cirrolink.com)" className={inputClass} autoFocus />
                  <input value={editing.service} onChange={e => setEditing({ ...editing, service: e.target.value })}
                         placeholder="service URL (e.g. http://10.99.0.1:8080)" className={inputClass} />
                  <div className="flex gap-2">
                    <button onClick={() => doExpose(current.name)}
                            disabled={!!busy || !editing.hostname.trim() || !editing.service.trim()}
                            className={btnClass}>{busy === 'expose' ? 'Adding...' : 'Add Rule'}</button>
                    <button onClick={() => setEditing(null)} className={btnClass}>Cancel</button>
                  </div>
                </div>
              ) : !editing && (
                <button onClick={() => setEditing({ index: null, hostname: '', service: '' })}
                        disabled={!!busy}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--color-border)]
                                   text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]
                                   hover:border-[var(--color-accent)] transition-colors">
                  <Plus className="w-4 h-4" /> Add ingress rule
                </button>
              )}

              {!ingress[current.name] && (
                <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Loading ingress...</div>
              )}
            </div>
          )}

          {/* Logs */}
          {subTab === 'logs' && (
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="mono text-xs text-[var(--color-text-muted)] tracking-wider">LOG OUTPUT</span>
                <button onClick={() => loadLogs(current.name)} className={btnClass}>Refresh</button>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-void)] p-4 overflow-auto max-h-[calc(100vh-300px)]">
                {(logs[current.name] ?? []).map((line, i) => (
                  <div key={i} className="mono text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre">{line}</div>
                ))}
                {!logs[current.name] && (
                  <div className="text-xs text-[var(--color-text-muted)]">Click refresh to load logs</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
