# cortex/api/app/services/docker_discovery.py
import os
import asyncio
import docker
from datetime import datetime, timezone

LABEL_PREFIX = "cortex"

KNOWN_SERVICES: dict[str, dict] = {
    "sonarr":       {"type": "sonarr",       "port": 8989,  "icon": "sonarr",        "path": "/sonarr",       "category": "media"},
    "sonarr-anime": {"type": "sonarr",       "port": 8990,  "icon": "sonarr",        "path": "/sonarr-anime", "category": "media"},
    "radarr":       {"type": "radarr",       "port": 7878,  "icon": "radarr",        "path": "/radarr",       "category": "media"},
    "prowlarr":     {"type": "prowlarr",     "port": 9696,  "icon": "prowlarr",      "path": "/prowlarr",     "category": "downloads"},
    "bazarr":       {"type": "bazarr",       "port": 6767,  "icon": "bazarr",        "path": "/bazarr",       "category": "media"},
    "lidarr":       {"type": "lidarr",       "port": 8686,  "icon": "lidarr",        "path": "/lidarr",       "category": "media"},
    "plex":         {"type": "plex",         "port": 32400, "icon": "plex",          "path": "/plex",         "category": "media"},
    "tautulli":     {"type": "tautulli",     "port": 8181,  "icon": "tautulli",      "path": "/tautulli",     "category": "monitoring"},
    "qbittorrent":  {"type": "qbittorrent",  "port": 8080,  "icon": "qbittorrent",   "path": "/qbittorrent",  "category": "downloads"},
    "sabnzbd":      {"type": "sabnzbd",      "port": 6789,  "icon": "sabnzbd",       "path": "/sabnzbd",      "category": "downloads"},
    "overseerr":    {"type": "overseerr",    "port": 5055,  "icon": "overseerr",     "path": "/overseerr",    "category": "media"},
    "jellyfin":     {"type": "jellyfin",     "port": 8096,  "icon": "jellyfin",      "path": "/jellyfin",     "category": "media"},
    "grafana":      {"type": "grafana",      "port": 3000,  "icon": "grafana",       "path": "/grafana",      "category": "monitoring"},
    "tdarr":        {"type": "tdarr",        "port": 8265,  "icon": "tdarr",         "path": "/tdarr",        "category": "media"},
    "flaresolverr": {"type": "flaresolverr", "port": 8191,  "icon": "flaresolverr",                           "category": "downloads"},
    "portainer":    {"type": "portainer",    "port": 9000,  "icon": "portainer",     "path": "",              "category": "system"},
    "n8n":          {"type": "n8n",          "port": 5678,  "icon": "n8n",           "path": "",              "category": "system"},
    "watchtower":   {"type": "watchtower",   "port": None,  "icon": "watchtower",                             "category": "system"},
}

def _get_host_labels() -> dict[str, str]:
    """Map host key → display name. HOST_LABELS=local=LXC 100,10.99.0.10=LXC 110"""
    result: dict[str, str] = {}
    for entry in os.environ.get("HOST_LABELS", "").split(","):
        entry = entry.strip()
        if "=" in entry:
            k, _, v = entry.partition("=")
            result[k.strip()] = v.strip()
    return result

_HOST_LABELS = _get_host_labels()


def _get_hosts() -> list[str]:
    extra = os.environ.get("DOCKER_HOSTS", "")
    hosts = ["unix:///var/run/docker.sock"]
    for h in extra.split(","):
        h = h.strip()
        if h:
            hosts.append(h)
    return hosts

def _scan_host_sync(base_url: str) -> list[dict]:
    """Blocking Docker scan — runs in executor thread."""
    PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "")
    client = None
    try:
        client = docker.DockerClient(base_url=base_url, timeout=5)
        containers = client.containers.list()
    except Exception:
        return []
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass

    host_ip = None
    if base_url.startswith("tcp://"):
        try:
            host_ip = base_url.split("://")[1].split(":")[0]
        except Exception:
            pass

    if base_url.startswith("unix://"):
        host_label = _HOST_LABELS.get("local", "local")
    else:
        host_label = _HOST_LABELS.get(host_ip or "", host_ip or base_url)

    services = []
    for c in containers:
        labels = c.labels or {}
        cname = c.name.lstrip("/")
        cname_lower = cname.lower()

        enabled = labels.get(f"{LABEL_PREFIX}.enable", "").lower() == "true"
        known = KNOWN_SERVICES.get(cname_lower)

        if not enabled and not known:
            continue

        name = labels.get(f"{LABEL_PREFIX}.name") or cname
        svc_type = labels.get(f"{LABEL_PREFIX}.type") or (known["type"] if known else cname_lower)
        port_label = labels.get(f"{LABEL_PREFIX}.port")
        port = int(port_label) if port_label else (known.get("port") if known else None)
        path = labels.get(f"{LABEL_PREFIX}.path") or (known.get("path") if known else None)
        url = labels.get(f"{LABEL_PREFIX}.url")
        icon = known.get("icon") if known else None
        category = labels.get(f"{LABEL_PREFIX}.category") or (known.get("category") if known else "other")

        if not url:
            if host_ip and port:
                url = f"http://{host_ip}:{port}"
            elif PUBLIC_BASE and path is not None:
                url = f"{PUBLIC_BASE}{path}" if path else None

        services.append({
            "container_id": c.id[:12],
            "name": name,
            "type": svc_type,
            "status": c.status,
            "port": port,
            "path": path,
            "url": url,
            "icon": icon,
            "category": category,
            "host": host_label,
            "public_url": None,
            "last_seen": datetime.now(timezone.utc).isoformat(),
        })

    return services

async def discover_services() -> list[dict]:
    """Async parallel discovery across all Docker hosts."""
    loop = asyncio.get_running_loop()
    hosts = _get_hosts()
    tasks = [loop.run_in_executor(None, _scan_host_sync, h) for h in hosts]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    services = []
    for r in results:
        if isinstance(r, list):
            services.extend(r)
    return services
