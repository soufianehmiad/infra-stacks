// cortex/frontend/src/sections/Home.tsx
import { useEffect, useState } from 'react'
import { api, StorageSnapshot, Tunnel, JobRecord, type PveNode, type PveStorage, type PveLxc } from '../lib/api'
import { useServicesStore } from '../stores/services'
import { Activity, HardDrive, Container, Wifi, Cpu, MemoryStick, Clock, ArrowDown } from 'lucide-react'

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

function ArcGauge({ value, label, max = 100, color = 'var(--color-accent)', size = 80 }: {
  value: number; label: string; max?: number; color?: string; size?: number
}) {
  const pct = Math.min(value / max * 100, 100)
  const r = (size - 8) / 2
  const circumference = Math.PI * r
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path
          d={`M 4 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2 + 4}`}
          fill="none" stroke="var(--color-border)" strokeWidth="5" strokeLinecap="square"
        />
        <path
          d={`M 4 ${size / 2 + 4} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2 + 4}`}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="square"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" fill="var(--color-text-primary)"
              className="font-display" fontSize="14" fontWeight="600">
          {Math.round(pct)}%
        </text>
      </svg>
      <span className="label">{label}</span>
    </div>
  )
}

export function Home() {
  const { services } = useServicesStore()
  const [storage, setStorage] = useState<StorageSnapshot[] | null>(null)
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [node, setNode] = useState<PveNode | null>(null)
  const [pveStorage, setPveStorage] = useState<PveStorage[]>([])
  const [lxcs, setLxcs] = useState<PveLxc[]>([])

  useEffect(() => {
    api.storage.current().then(setStorage).catch(() => {})
    api.tunnels.list().then(setTunnels).catch(() => {})
    api.jobs.list().then(setJobs).catch(() => {})
    api.proxmox.nodes().then(setNode).catch(() => {})
    api.proxmox.storage().then(setPveStorage).catch(() => {})
    api.proxmox.lxc().then(setLxcs).catch(() => {})
  }, [])

  const running = services.filter(s => s.status === 'running').length
  const total = services.length
  const tunnelsUp = tunnels.filter(t => t.running).length
  const activeJobs = jobs.filter(j => j.status === 'running').length
  const memPct = node ? Math.round(node.mem_used / node.mem_total * 100) : 0

  const storageTotal = storage?.[0]?.total_bytes ?? 0
  const storageUsed = storage?.reduce((s, r) => s + r.used_bytes, 0) ?? 0
  const storagePct = storageTotal > 0 ? storageUsed / storageTotal * 100 : 0
  const storageSaved = storage?.[0]?.saved_bytes ?? 0

  return (
    <div className="h-full overflow-auto">
      {/* Hero */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-5">
            <Activity className="w-4 h-4 text-[var(--color-accent)]" style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.4))' }} />
            <h1 className="font-display text-sm text-[var(--color-accent)] tracking-[0.2em]">
              {node?.node?.toUpperCase() ?? 'CORTEX'} — SYSTEM STATUS
            </h1>
            {node && (
              <span className="text-[11px] text-[var(--color-text-secondary)] ml-auto flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                uptime {uptime(node.uptime)}
              </span>
            )}
          </div>

          <div className="flex items-end gap-10 flex-wrap">
            {node && (
              <>
                <ArcGauge value={node.cpu_pct} label="CPU" />
                <ArcGauge value={memPct} label="RAM" color={memPct > 85 ? 'var(--color-warn)' : 'var(--color-accent)'} />
              </>
            )}
            <ArcGauge value={storagePct} label="MEDIA" color={storagePct > 90 ? 'var(--color-down)' : 'var(--color-accent)'} />

            <div className="flex gap-8 ml-auto">
              {[
                { label: 'Services', value: `${running}/${total}`, color: 'var(--color-up)' },
                { label: 'Tunnels', value: `${tunnelsUp}/${tunnels.length}`, color: 'var(--color-accent)' },
                { label: 'Jobs', value: activeJobs > 0 ? `${activeJobs} active` : 'idle', color: activeJobs > 0 ? 'var(--color-warn)' : 'var(--color-text-muted)' },
              ].map(s => (
                <div key={s.label} className="text-right">
                  <div className="font-display text-xl font-semibold" style={{ color: s.color, textShadow: `0 0 10px ${s.color}30` }}>
                    {s.value}
                  </div>
                  <div className="label mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* LXC */}
        <div className="border-r border-[var(--color-border)] border-b lg:border-b-0">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)]">
            <Container className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="label-accent">CONTAINERS</span>
            <span className="label ml-auto">{lxcs.length}</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {lxcs.map(ct => (
              <div key={ct.vmid} className="flex items-center gap-3 px-6 py-2.5 hover:bg-[var(--color-elevated)] transition-colors">
                <span className={`dot ${ct.status === 'running' ? 'dot-up' : 'dot-down'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[var(--color-text-primary)] truncate">{ct.name}</span>
                    <span className="font-display text-[10px] text-[var(--color-text-muted)]">#{ct.vmid}</span>
                  </div>
                </div>
                <div className="flex gap-4 text-right shrink-0">
                  <span className="font-display text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" />{ct.cpu}%
                  </span>
                  <span className="font-display text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1">
                    <MemoryStick className="w-2.5 h-2.5" />{fmt(ct.mem_used)}
                  </span>
                </div>
              </div>
            ))}
            {lxcs.length === 0 && (
              <div className="px-6 py-8 text-[12px] text-[var(--color-text-muted)] text-center">
                PVE token not configured
              </div>
            )}
          </div>
        </div>

        {/* Storage */}
        <div className="border-r border-[var(--color-border)] border-b lg:border-b-0">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)]">
            <HardDrive className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="label-accent">STORAGE</span>
          </div>
          <div className="p-6 space-y-4">
            {pveStorage.map(s => (
              <div key={s.storage}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[var(--color-text-primary)]">{s.storage}</span>
                  <span className="font-display text-[11px] text-[var(--color-text-secondary)]">{fmt(s.used)} / {fmt(s.total)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${s.pct > 90 ? '!bg-[var(--color-down)]' : s.pct > 75 ? '!bg-[var(--color-warn)]' : ''}`}
                    style={{
                      width: `${s.pct}%`,
                      boxShadow: `0 0 8px ${s.pct > 90 ? 'rgba(239,68,68,0.4)' : s.pct > 75 ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'}`,
                    }}
                  />
                </div>
              </div>
            ))}

            {storage && storage.length > 0 && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <div className="label mb-3">MEDIA BREAKDOWN</div>
                {storage.map(s => (
                  <div key={s.folder} className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] text-[var(--color-text-secondary)]">{s.folder}</span>
                    <span className="font-display text-[12px] text-[var(--color-text-primary)]">{fmt(s.used_bytes)}</span>
                  </div>
                ))}
                {storageSaved > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 text-[12px] text-[var(--color-up)]">
                    <ArrowDown className="w-3 h-3" />
                    {fmt(storageSaved)} saved by encoding
                  </div>
                )}
              </div>
            )}

            {pveStorage.length === 0 && !storage && (
              <div className="py-8 text-[12px] text-[var(--color-text-muted)] text-center">loading...</div>
            )}
          </div>
        </div>

        {/* Tunnels + Jobs */}
        <div>
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)]">
            <Wifi className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="label-accent">TUNNELS</span>
            <span className="label ml-auto">{tunnelsUp}/{tunnels.length}</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {tunnels.map(t => (
              <div key={t.name} className="flex items-center gap-2.5 px-6 py-2.5">
                <span className={`dot ${t.running ? 'dot-up' : 'dot-down'}`} />
                <span className="text-[13px] text-[var(--color-text-primary)] flex-1">{t.name}</span>
                <span className="font-display text-[11px] text-[var(--color-text-secondary)]">{t.active}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-6 py-3 border-b border-t border-[var(--color-border)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="label-accent">ENCODER</span>
          </div>
          <div className="p-6">
            {jobs.find(j => j.status === 'running') ? (
              <div className="space-y-3">
                {jobs.filter(j => j.status === 'running').map(j => (
                  <div key={j.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] text-[var(--color-text-primary)]">{j.action}</span>
                      <span className="font-display text-[12px] text-[var(--color-accent)]">{Math.round(j.progress)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${j.progress}%` }} />
                    </div>
                    {j.eta_s != null && (
                      <span className="font-display text-[11px] text-[var(--color-text-muted)] mt-1.5 block">ETA {j.eta_s}s</span>
                    )}
                  </div>
                ))}
                {jobs.filter(j => j.status === 'pending').length > 0 && (
                  <span className="text-[12px] text-[var(--color-warn)]">
                    {jobs.filter(j => j.status === 'pending').length} pending
                  </span>
                )}
              </div>
            ) : (
              <span className="font-display text-lg text-[var(--color-text-muted)]">idle</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
