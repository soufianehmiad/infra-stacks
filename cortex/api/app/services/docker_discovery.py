# cortex/api/app/services/docker_discovery.py
import os
import docker
from datetime import datetime, timezone

LABEL_PREFIX = "cortex"

PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "")  # e.g. https://cortex.cirrolink.com

KNOWN_SERVICES: dict[str, dict] = {
    "sonarr":       {"type": "sonarr",       "port": 8989,  "icon": "tv",          "path": "/sonarr"},
    "sonarr-anime": {"type": "sonarr",       "port": 8990,  "icon": "tv",          "path": "/sonarr-anime"},
    "radarr":       {"type": "radarr",       "port": 7878,  "icon": "film",        "path": "/radarr"},
    "prowlarr":     {"type": "prowlarr",     "port": 9696,  "icon": "search",      "path": "/prowlarr"},
    "bazarr":       {"type": "bazarr",       "port": 6767,  "icon": "subtitles",   "path": "/bazarr"},
    "lidarr":       {"type": "lidarr",       "port": 8686,  "icon": "music",       "path": "/lidarr"},
    "plex":         {"type": "plex",         "port": 32400, "icon": "play",        "path": "/plex"},
    "tautulli":     {"type": "tautulli",     "port": 8181,  "icon": "bar-chart",   "path": "/tautulli"},
    "qbittorrent":  {"type": "qbittorrent",  "port": 8080,  "icon": "download",    "path": "/qbittorrent"},
    "sabnzbd":      {"type": "sabnzbd",      "port": 6789,  "icon": "archive",     "path": "/sabnzbd"},
    "overseerr":    {"type": "overseerr",    "port": 5055,  "icon": "bell",        "path": "/overseerr"},
    "jellyfin":     {"type": "jellyfin",     "port": 8096,  "icon": "play-circle", "path": "/jellyfin"},
    "grafana":      {"type": "grafana",      "port": 3000,  "icon": "activity",    "path": "/grafana"},
    "tdarr":        {"type": "tdarr",        "port": 8265,  "icon": "cpu",         "path": "/tdarr"},
    "flaresolverr": {"type": "flaresolverr", "port": 8191,  "icon": "shield"},
}

# Hosts to scan: local socket + any configured remotes
def _get_hosts() -> list[str]:
    extra = os.environ.get("DOCKER_HOSTS", "")
    hosts = ["unix:///var/run/docker.sock"]
    for h in extra.split(","):
        h = h.strip()
        if h:
            hosts.append(h)
    return hosts


def _scan_host(base_url: str) -> list[dict]:
    try:
        if base_url.startswith("unix://"):
            client = docker.DockerClient(base_url=base_url)
        else:
            client = docker.DockerClient(base_url=base_url)
        containers = client.containers.list()
    except Exception:
        return []

    # Derive host IP from base_url for building URLs (e.g. tcp://10.99.0.10:2375 → 10.99.0.10)
    host_ip = None
    if base_url.startswith("tcp://"):
        try:
            host_ip = base_url.split("://")[1].split(":")[0]
        except Exception:
            pass

    services = []
    for c in containers:
        labels = c.labels or {}
        cname = c.name.lstrip("/")
        cname_lower = cname.lower()

        enabled = labels.get(f"{LABEL_PREFIX}.enable", "").lower() == "true"
        known = KNOWN_SERVICES.get(cname_lower)

        if not enabled and not known:
            continue

        # Label values take priority over auto-detected values
        name = labels.get(f"{LABEL_PREFIX}.name") or cname
        svc_type = labels.get(f"{LABEL_PREFIX}.type") or (known["type"] if known else cname_lower)
        port_label = labels.get(f"{LABEL_PREFIX}.port")
        port = int(port_label) if port_label else (known["port"] if known else None)
        path = labels.get(f"{LABEL_PREFIX}.path") or (known.get("path") if known else None)
        url = labels.get(f"{LABEL_PREFIX}.url")
        icon = known["icon"] if known else None

        # Build URL: prefer public proxy path, fall back to direct internal URL
        if not url:
            if PUBLIC_BASE and path:
                url = f"{PUBLIC_BASE}{path}"
            elif host_ip and port:
                url = f"http://{host_ip}:{port}"

        services.append({
            "container_id": c.id[:12],
            "name": name,
            "type": svc_type,
            "status": c.status,
            "port": port,
            "path": path,
            "url": url,
            "icon": icon,
            "last_seen": datetime.now(timezone.utc).isoformat(),
        })

    return services


def discover_services() -> list[dict]:
    results = []
    for host in _get_hosts():
        results.extend(_scan_host(host))
    return results
