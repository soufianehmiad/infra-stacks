# cortex/api/app/services/kubernetes.py
import asyncio
import json
import os

KUBECONFIG = os.environ.get(
    "KUBECONFIG",
    "/root/server-admin/Kubernetes-Cluster/backup_manifests/kubeconfig.yaml",
)

IGNORED_NAMESPACES = {
    "default", "kube-system", "kube-public", "kube-node-lease",
    "monitoring", "portainer", "gitlab-runner",
}


def _project_name(namespace: str) -> str:
    """Derive a display name from namespace: 'microbnc-staging' -> 'MicroBNC'."""
    base = namespace.removesuffix("-staging").removesuffix("-stg").removesuffix("-prod").removesuffix("-production")
    return base.replace("-", " ").title().replace(" ", "")


async def _kubectl(args: str) -> str:
    proc = await asyncio.create_subprocess_shell(
        f"kubectl --kubeconfig={KUBECONFIG} {args}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return stdout.decode()


async def get_apps() -> list[dict]:
    raw = await _kubectl(
        "get ingress -A -o json"
    )
    data = json.loads(raw)
    apps: list[dict] = []

    for item in data.get("items", []):
        ns = item["metadata"]["namespace"]

        if ns in IGNORED_NAMESPACES:
            continue

        project = _project_name(ns)
        env = "staging" if "stag" in ns or "stg" in ns else "production"

        rules = item.get("spec", {}).get("rules", [])
        for rule in rules:
            hostname = rule.get("host", "")
            paths = rule.get("http", {}).get("paths", [])
            for p in paths:
                svc_name = p.get("backend", {}).get("service", {}).get("name", "?")
                svc_port = p.get("backend", {}).get("service", {}).get("port", {}).get("number")
                apps.append({
                    "project": project,
                    "namespace": ns,
                    "environment": env,
                    "hostname": hostname,
                    "url": f"https://{hostname}",
                    "service": svc_name,
                    "port": svc_port,
                })

    # Fetch pod status per namespace to show health
    namespaces = {a["namespace"] for a in apps}
    pod_status: dict[str, dict] = {}
    for ns in namespaces:
        raw_pods = await _kubectl(
            f"get pods -n {ns} -o json"
        )
        pods_data = json.loads(raw_pods)
        total = 0
        ready = 0
        for pod in pods_data.get("items", []):
            # Skip completed jobs
            phase = pod.get("status", {}).get("phase", "")
            if phase in ("Succeeded", "Failed"):
                continue
            total += 1
            container_statuses = pod.get("status", {}).get("containerStatuses", [])
            if container_statuses and all(cs.get("ready") for cs in container_statuses):
                ready += 1
        pod_status[ns] = {"ready": ready, "total": total}

    for app in apps:
        ps = pod_status.get(app["namespace"], {"ready": 0, "total": 0})
        app["pods_ready"] = ps["ready"]
        app["pods_total"] = ps["total"]
        app["healthy"] = ps["ready"] == ps["total"] and ps["total"] > 0

    return apps
