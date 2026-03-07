import { useEffect, useState } from 'react'
import { api, type PveNode, type PveStorage, type PveLxc } from '../../../lib/api'

function fmt(bytes: number) {
  if (bytes > 1e12) return `${(bytes / 1e12).toFixed(1)}T`
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)}G`
  return `${(bytes / 1e6).toFixed(0)}M`
}

function uptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

export function InfraTile() {
  const [node, setNode] = useState<PveNode | null>(null)
  const [storages, setStorages] = useState<PveStorage[]>([])
  const [lxcs, setLxcs] = useState<PveLxc[]>([])
  const [err, setErr] = useState(false)

  useEffect(() => {
    Promise.all([
      api.proxmox.nodes().then(setNode),
      api.proxmox.storage().then(setStorages),
      api.proxmox.lxc().then(setLxcs),
    ]).catch(() => setErr(true))
  }, [])

  if (err) return (
    <div className="p-5 text-xs text-[var(--color-text-muted)]">
      Proxmox unavailable — check PVE token
    </div>
  )

  return (
    <div className="p-5 h-full flex flex-col gap-3 overflow-hidden">
      <div className="mono text-xs text-[var(--color-accent)] tracking-[0.2em]">INFRASTRUCTURE</div>

      {/* Node gauges */}
      {node && (
        <div className="flex items-center gap-4">
          <span className="mono text-sm text-[var(--color-text-primary)] font-semibold"
                style={{ textShadow: '0 0 8px rgba(34, 197, 94, 0.3)' }}>{node.node}</span>
          <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
            <span>CPU <span className="text-[var(--color-text-primary)]">{node.cpu_pct}%</span></span>
            <span>RAM <span className="text-[var(--color-text-primary)]">{fmt(node.mem_used)}/{fmt(node.mem_total)}</span></span>
            <span>UP <span className="text-[var(--color-text-primary)]">{uptime(node.uptime)}</span></span>
          </div>
        </div>
      )}

      {/* Storage bars */}
      {storages.length > 0 && (
        <div className="space-y-1.5">
          {storages.map(s => (
            <div key={s.storage} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] w-20 truncate">{s.storage}</span>
              <div className="flex-1 h-2 bg-[var(--color-void)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <div className={`h-full rounded-full transition-all ${s.pct > 90 ? 'bg-[var(--color-down)]' : 'bg-[var(--color-accent)]'}`}
                     style={{ width: `${s.pct}%`, boxShadow: `0 0 8px ${s.pct > 90 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}` }} />
              </div>
              <span className="text-xs text-[var(--color-text-primary)] w-20 text-right">
                {fmt(s.used)}/{fmt(s.total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* LXC grid */}
      {lxcs.length > 0 && (
        <div className="flex-1 overflow-auto mt-1">
          <div className="flex gap-2 mono text-xs text-[var(--color-text-muted)] tracking-wider mb-1.5 px-1">
            <span className="w-10">ID</span>
            <span className="flex-1">NAME</span>
            <span className="w-12 text-right">CPU</span>
            <span className="w-14 text-right">MEM</span>
          </div>
          <div className="space-y-0.5">
            {lxcs.map(ct => (
              <div key={ct.vmid} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[var(--color-elevated)] transition-colors">
                <span className="mono text-xs text-[var(--color-text-muted)] w-10">{ct.vmid}</span>
                <span className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`dot ${ct.status === 'running' ? 'dot-up' : 'dot-down'}`} />
                  <span className="text-xs text-[var(--color-text-primary)] truncate">{ct.name}</span>
                </span>
                <span className="mono text-xs text-[var(--color-text-muted)] w-12 text-right">{ct.cpu}%</span>
                <span className="mono text-xs text-[var(--color-text-muted)] w-14 text-right">{fmt(ct.mem_used)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!node && !err && (
        <div className="text-xs text-[var(--color-text-muted)]">loading...</div>
      )}
    </div>
  )
}
