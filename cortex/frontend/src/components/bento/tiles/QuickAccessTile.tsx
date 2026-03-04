// cortex/frontend/src/components/bento/tiles/QuickAccessTile.tsx
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Service } from '../../../lib/api'

// Display name overrides
const LABELS: Record<string, string> = {
  radarr: 'Radarr', sonarr: 'Sonarr', prowlarr: 'Prowlarr',
  bazarr: 'Bazarr', lidarr: 'Lidarr', qbittorrent: 'qBittorrent',
  sabnzbd: 'SABnzbd', tautulli: 'Tautulli', plex: 'Plex',
  tdarr: 'Tdarr', flaresolverr: 'Flaresolverr', grafana: 'Grafana',
  jellyfin: 'Jellyfin', overseerr: 'Overseerr',
}

const PRIORITY = [
  'radarr','sonarr','prowlarr','bazarr','lidarr',
  'qbittorrent','sabnzbd','tautulli','plex','tdarr',
  'flaresolverr','grafana','jellyfin','overseerr',
]

function priorityOf(s: Service): number {
  if (s.name === 'sonarr-anime') return 1.5
  const idx = PRIORITY.indexOf(s.type.toLowerCase())
  return idx === -1 ? 999 : idx
}

// ── Favicon with fallback ─────────────────────────────────────────────────────

function ServiceIcon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  // Try the service's own favicon through the proxy
  const faviconUrl = url.replace(/\/$/, '') + '/favicon.ico'

  if (failed) {
    return (
      <div className="w-8 h-8 flex items-center justify-center
                      text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]
                      transition-colors duration-150">
        <ExternalLink size={20} strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <img
      src={faviconUrl}
      alt={name}
      width={28}
      height={28}
      className="w-7 h-7 object-contain"
      style={{ imageRendering: 'auto' }}
      onError={() => setFailed(true)}
    />
  )
}

// ── Tile ─────────────────────────────────────────────────────────────────────

export function QuickAccessTile({ services }: { services: Service[] }) {
  const accessible = services
    .filter(s => s.url && !s.name.startsWith('cortex-'))
    .sort((a, b) => priorityOf(a) - priorityOf(b))

  return (
    <div className="p-4 h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <span className="mono text-[11px] text-[var(--color-text-muted)] tracking-widest">QUICK ACCESS</span>
        <span className="mono text-[10px] text-[var(--color-text-muted)]">{accessible.length} services</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid gap-2" style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridAutoRows: '80px',
        }}>
          {accessible.map(s => {
            const label = s.name === 'sonarr-anime' ? 'Anime'
              : LABELS[s.type.toLowerCase()] ?? s.name
            const isUp = s.status === 'running'
            return (
              <a
                key={s.container_id}
                href={s.url!}
                target="_blank"
                rel="noreferrer"
                className="qa-card group relative flex flex-col items-center justify-center gap-1.5
                           border border-[var(--color-border)] bg-[var(--color-surface)]
                           transition-colors duration-150 cursor-pointer select-none
                           hover:border-[var(--color-accent)] hover:bg-[var(--color-elevated)]"
              >
                <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full
                  ${isUp ? 'bg-[var(--color-up)]' : 'bg-[var(--color-down)]'}`}
                  style={isUp ? { boxShadow: '0 0 4px var(--color-up)' } : {}}
                />
                <ServiceIcon url={s.url!} name={label} />
                <span className="mono text-[9px] text-[var(--color-text-muted)]
                                 group-hover:text-[var(--color-text-primary)]
                                 transition-colors duration-150 tracking-widest uppercase">
                  {label}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
