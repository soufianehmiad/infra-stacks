// cortex/frontend/src/sections/Home.tsx
import { useEffect, useState } from 'react'
import { api, type Service, type JobRecord, type StorageSnapshot, type Tunnel } from '../lib/api'
import { ServicesTile } from '../components/bento/tiles/ServicesTile'
import { JobsTile } from '../components/bento/tiles/JobsTile'
import { StorageTile } from '../components/bento/tiles/StorageTile'
import { TunnelsTile } from '../components/bento/tiles/TunnelsTile'
import { QuickAccessTile } from '../components/bento/tiles/QuickAccessTile'

export function Home() {
  const [services, setServices] = useState<Service[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [storage, setStorage] = useState<StorageSnapshot[] | null>(null)
  const [tunnels, setTunnels] = useState<Tunnel[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [s, j, st, t] = await Promise.all([
          api.services.list(), api.jobs.list(),
          api.storage.current(), api.tunnels.list()
        ])
        setServices(s); setJobs(j); setStorage(st); setTunnels(t)
      } catch { /* silent */ }
    }
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  const hasDownTunnel = tunnels.some(t => !t.running)

  return (
    <div className="flex gap-3 p-5 h-full overflow-hidden">

      {/* ── Left: status column ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 shrink-0" style={{ width: '230px' }}>
        <div className="tile" style={{ flex: '3' }}>
          <ServicesTile services={services} />
        </div>
        <div className="tile" style={{ flex: '1' }}>
          <JobsTile jobs={jobs} />
        </div>
        <div className="tile" style={{ flex: '1.5' }}>
          <StorageTile storage={storage} />
        </div>
        <div className={`tile ${hasDownTunnel ? 'border-[var(--color-down)]' : ''}`} style={{ flex: '1' }}>
          <TunnelsTile tunnels={tunnels} />
        </div>
      </div>

      {/* ── Right: quick access ──────────────────────────────────── */}
      <div className="tile flex-1 min-w-0">
        <QuickAccessTile services={services} />
      </div>

    </div>
  )
}
