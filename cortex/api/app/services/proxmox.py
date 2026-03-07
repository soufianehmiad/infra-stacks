# cortex/api/app/services/proxmox.py
import httpx
from app.core.config import settings

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=f"https://{settings.pve_host}:8006",
            verify=False,
            headers={"Authorization": f"PVEAPIToken={settings.pve_token_id}={settings.pve_token_secret}"},
            timeout=10,
        )
    return _client


async def get_node_status(node: str = "pascal") -> dict:
    r = await _get_client().get(f"/api2/json/nodes/{node}/status")
    r.raise_for_status()
    data = r.json()["data"]
    cpu = data.get("cpu", 0)
    mem = data.get("memory", {})
    return {
        "node": node,
        "cpu_pct": round(cpu * 100, 1),
        "mem_used": mem.get("used", 0),
        "mem_total": mem.get("total", 0),
        "uptime": data.get("uptime", 0),
    }


async def get_storage(node: str = "pascal") -> list[dict]:
    r = await _get_client().get(f"/api2/json/nodes/{node}/storage", params={"content": "rootdir,images"})
    r.raise_for_status()
    items = r.json()["data"]
    return [
        {
            "storage": s["storage"],
            "type": s.get("type", ""),
            "used": s.get("used", 0),
            "total": s.get("total", 0),
            "avail": s.get("avail", 0),
            "pct": round(s["used"] / s["total"] * 100, 1) if s.get("total") else 0,
        }
        for s in items if s.get("enabled", 1) and s.get("active", 1)
    ]


async def get_lxc_list(node: str = "pascal") -> list[dict]:
    r = await _get_client().get(f"/api2/json/nodes/{node}/lxc")
    r.raise_for_status()
    items = r.json()["data"]
    return sorted([
        {
            "vmid": ct["vmid"],
            "name": ct.get("name", ""),
            "status": ct.get("status", "unknown"),
            "mem_used": ct.get("mem", 0),
            "mem_total": ct.get("maxmem", 0),
            "disk_used": ct.get("disk", 0),
            "disk_total": ct.get("maxdisk", 0),
            "uptime": ct.get("uptime", 0),
            "cpu": round(ct.get("cpu", 0) * 100, 1),
        }
        for ct in items
    ], key=lambda c: c["vmid"])
