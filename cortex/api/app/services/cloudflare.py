# cortex/api/app/services/cloudflare.py
import asyncio
from typing import Optional

import asyncssh
import yaml

from app.core.config import settings

CONFIG_DIR = "/etc/cloudflared/tunnels"

# ─── Persistent connection pool ───────────────────────────────────────────────

_conn: Optional[asyncssh.SSHClientConnection] = None
_conn_lock = asyncio.Lock()


def _conn_opts() -> dict:
    import os
    opts = dict(
        username=settings.cf_user,
        known_hosts=None,
        keepalive_interval=30,
        keepalive_count_max=5,
    )
    if os.path.exists(settings.cf_key):
        opts["client_keys"] = [settings.cf_key]
    return opts


async def _ensure_conn() -> asyncssh.SSHClientConnection:
    global _conn
    if _conn is not None:
        return _conn
    async with _conn_lock:
        if _conn is None:
            _conn = await asyncio.wait_for(
                asyncssh.connect(settings.cf_host, **_conn_opts()),
                timeout=10,
            )
    return _conn


async def _run(cmd: str) -> tuple[int, str, str]:
    """Run a shell command on the CF host, auto-reconnecting on stale connection."""
    global _conn
    for attempt in range(2):
        try:
            conn = await _ensure_conn()
            r = await asyncio.wait_for(conn.run(cmd), timeout=20)
            return r.returncode or 0, r.stdout or "", r.stderr or ""
        except (asyncssh.DisconnectError, asyncssh.ConnectionLost, OSError):
            async with _conn_lock:
                _conn = None
            if attempt == 0:
                continue
            return 1, "", "SSH connection lost"
        except asyncio.TimeoutError:
            return 1, "", "Command timed out"
        except Exception as e:
            return 1, "", str(e)
    return 1, "", "max retries exceeded"


# ─── API ─────────────────────────────────────────────────────────────────────


async def list_tunnels() -> list[dict]:
    """List all cloudflared-* services with status."""
    rc, out, err = await _run(
        "systemctl list-unit-files 'cloudflared-*.service' --no-legend --no-pager 2>/dev/null"
    )
    if rc != 0:
        return []

    services = []
    for line in out.strip().splitlines():
        parts = line.split()
        if parts:
            services.append(parts[0].removesuffix(".service"))

    if not services:
        return []

    svc_list = " ".join(f"{s}.service" for s in sorted(services))
    _, out2, _ = await _run(
        f"systemctl show {svc_list} --no-pager "
        "--property=Id,ActiveState,SubState,Description 2>/dev/null"
    )

    tunnels: list[dict] = []
    current: dict[str, str] = {}
    for line in out2.strip().splitlines():
        if line.strip() == "":
            if current:
                svc_id = current.get("Id", "")
                svc_name = svc_id.removesuffix(".service")
                name = svc_name.removeprefix("cloudflared-")
                active = current.get("ActiveState", "unknown")
                sub = current.get("SubState", "unknown")
                tunnels.append({
                    "service": svc_name,
                    "name": name,
                    "active": active,
                    "sub": sub,
                    "running": active == "active" and sub == "running",
                    "description": current.get("Description", ""),
                })
                current = {}
        else:
            k, _, v = line.partition("=")
            current[k] = v

    if current:
        svc_id = current.get("Id", "")
        svc_name = svc_id.removesuffix(".service")
        name = svc_name.removeprefix("cloudflared-")
        active = current.get("ActiveState", "unknown")
        sub = current.get("SubState", "unknown")
        tunnels.append({
            "service": svc_name,
            "name": name,
            "active": active,
            "sub": sub,
            "running": active == "active" and sub == "running",
            "description": current.get("Description", ""),
        })

    return sorted(tunnels, key=lambda t: t["name"])


async def control_tunnel(name: str, action: str) -> dict:
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": "Invalid action"}
    rc, _, stderr = await _run(f"systemctl {action} cloudflared-{name}.service")
    return {"ok": rc == 0, "error": stderr.strip() if rc != 0 else None}


async def get_logs(name: str, lines: int = 150) -> list[str]:
    _, out, _ = await _run(
        f"journalctl -u cloudflared-{name}.service -n {lines} "
        "--no-pager --output=short-iso 2>/dev/null"
    )
    return out.splitlines()


async def get_config(name: str) -> dict | None:
    rc, out, _ = await _run(f"cat {CONFIG_DIR}/{name}.yaml")
    if rc != 0:
        return None
    try:
        return yaml.safe_load(out) or {}
    except Exception:
        return None


async def update_ingress(name: str, rules: list[dict]) -> dict:
    path = f"{CONFIG_DIR}/{name}.yaml"
    rc, out, _ = await _run(f"cat {path}")
    if rc != 0:
        return {"ok": False, "error": f"Config not found: {path}"}

    try:
        cfg = yaml.safe_load(out) or {}
    except Exception as e:
        return {"ok": False, "error": f"YAML parse error: {e}"}

    cfg["ingress"] = rules
    new_yaml = yaml.dump(cfg, default_flow_style=False, allow_unicode=True)

    try:
        conn = await _ensure_conn()
        async with conn.start_sftp_client() as sftp:
            async with sftp.open(path, "wb") as f:
                await f.write(new_yaml.encode())
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def expose_service(tunnel_name: str, hostname: str, internal_url: str) -> dict:
    """Add an ingress rule for hostname → internal_url, keep catch-all last, restart tunnel."""
    cfg = await get_config(tunnel_name)
    if cfg is None:
        return {"ok": False, "error": "Tunnel config not found"}

    rules: list[dict] = cfg.get("ingress", [])

    # Remove existing rule for same hostname (idempotent)
    rules = [r for r in rules if r.get("hostname") != hostname]

    # Separate catch-all (no hostname) from normal rules
    catch_all = [r for r in rules if not r.get("hostname")]
    normal = [r for r in rules if r.get("hostname")]

    # Ensure a catch-all exists (cloudflared requires it as the last rule)
    if not catch_all:
        catch_all = [{"service": "http_status:404"}]

    # Insert new rule before catch-all
    normal.append({"hostname": hostname, "service": internal_url})
    new_rules = normal + catch_all

    result = await update_ingress(tunnel_name, new_rules)
    if not result["ok"]:
        return result

    return await control_tunnel(tunnel_name, "restart")


async def unexpose_service(tunnel_name: str, hostname: str) -> dict:
    """Remove an ingress rule by hostname and restart tunnel."""
    cfg = await get_config(tunnel_name)
    if cfg is None:
        return {"ok": False, "error": "Tunnel config not found"}

    rules: list[dict] = cfg.get("ingress", [])
    new_rules = [r for r in rules if r.get("hostname") != hostname]

    # Guard: if nothing was removed, hostname didn't exist
    if len(new_rules) == len(rules):
        return {"ok": False, "error": f"No ingress rule found for hostname: {hostname}"}

    result = await update_ingress(tunnel_name, new_rules)
    if not result["ok"]:
        return result

    return await control_tunnel(tunnel_name, "restart")


async def stream_logs(websocket, name: str) -> None:
    """Tail -f logs and forward each line to the WebSocket."""
    try:
        conn = await _ensure_conn()
        async with conn.create_process(
            f"journalctl -f -u cloudflared-{name}.service "
            "--output=short-iso --no-pager"
        ) as proc:
            async for line in proc.stdout:
                stripped = line.rstrip("\n")
                if stripped:
                    try:
                        await websocket.send_text(stripped)
                    except Exception:
                        return
    except Exception as e:
        try:
            await websocket.send_text(f"[stream error] {e}")
        except Exception:
            pass
