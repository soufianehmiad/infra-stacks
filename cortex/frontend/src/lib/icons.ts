// cortex/frontend/src/lib/icons.ts

// Maps service type → bundled icon path (served from public/icons/)
const BUNDLED: Record<string, string> = {
  sonarr:       '/icons/sonarr.svg',
  radarr:       '/icons/radarr.svg',
  prowlarr:     '/icons/prowlarr.svg',
  bazarr:       '/icons/bazarr.svg',
  lidarr:       '/icons/lidarr.svg',
  plex:         '/icons/plex.svg',
  tautulli:     '/icons/tautulli.svg',
  qbittorrent:  '/icons/qbittorrent.svg',
  sabnzbd:      '/icons/sabnzbd.svg',
  overseerr:    '/icons/overseerr.svg',
  jellyfin:     '/icons/jellyfin.svg',
  grafana:      '/icons/grafana.svg',
  flaresolverr: '/icons/flaresolverr.svg',
  portainer:    '/icons/portainer.svg',
  n8n:          '/icons/n8n.svg',
  watchtower:   '/icons/watchtower.svg',
}

/** Returns the bundled SVG path for a known service type, or null. */
export function getBundledIcon(type: string): string | null {
  return BUNDLED[type?.toLowerCase()] ?? null
}

/** Fetch favicon from a service URL with 2s timeout. Returns data URL or null. */
export async function fetchFavicon(serviceUrl: string): Promise<string | null> {
  if (!serviceUrl) return null
  const url = serviceUrl.replace(/\/$/, '') + '/favicon.ico'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.size) return null
    return URL.createObjectURL(blob)
  } catch {
    clearTimeout(timer)
    return null
  }
}
