# Cortex Deployment Runbook

## Phase 9.1 — Provision new LXC (on Proxmox host)

```bash
# Create LXC (choose a free CTID, e.g. 120)
pct create 120 /var/lib/vz/template/cache/debian-12-standard_*.tar.zst \
  --hostname cortex --memory 4096 --cores 4 --rootfs local-lvm:20 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1

# Bind mount /media from LXC 110 (read-only)
echo "mp0: /var/lib/lxc/110/rootfs/media,mp=/media,ro=1" >> /etc/pve/lxc/120.conf

# Start and bootstrap
pct start 120
pct exec 120 -- bash -c "apt update && apt install -y curl docker.io docker-compose-v2"
```

## Phase 9.2 — Deploy

```bash
# Push code to new LXC
NEW_LXC_IP=<fill in after pct start>
rsync -av /root/server-admin/cortex/ root@${NEW_LXC_IP}:/opt/cortex/

# On new LXC
ssh root@${NEW_LXC_IP}
cd /opt/cortex

# Configure environment
cp .env.example .env
# Edit .env — fill in real POSTGRES_HOST, REDIS_HOST, SECRET_KEY, ADMIN_PASSWORD, etc.
# openssl rand -hex 32   ← use this for SECRET_KEY

mkdir -p secrets
cp ~/.ssh/cf_key secrets/cf_key   # or copy from wherever your CF key lives

# Run DB migrations (api container builds first)
docker compose build api
docker compose run --rm api alembic upgrade head

# Seed admin user
docker compose run --rm api python scripts/seed_admin.py

# Start everything
docker compose up -d

# Verify
docker compose ps
docker compose logs -f --tail=50
```

## Phase 9.3 — Cloudflare tunnel

Edit `/etc/cloudflared/tunnels/mgmt-tools.yaml` on LXC 500, add:

```yaml
- hostname: cortex.cirrolink.com
  service: http://<NEW_LXC_IP>:9999
```

Then:
```bash
ssh root@10.99.0.50 "systemctl reload-or-restart cloudflared-mgmt-tools"
cloudflared tunnel route dns 9bdb7adf cortex.cirrolink.com
```

## Phase 9.4 — Smoke test

```bash
NEW_LXC_IP=<fill in>

# Health
curl http://${NEW_LXC_IP}:9999/api/health      # {"status":"ok"}
curl http://${NEW_LXC_IP}:9999/encoder/health  # {"status":"ok"}

# Login
curl -c /tmp/cortex-jar -X POST http://${NEW_LXC_IP}:9999/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your password>"}'

# Services
curl -b /tmp/cortex-jar http://${NEW_LXC_IP}:9999/api/services/

# Trigger media scan
curl -b /tmp/cortex-jar -X POST http://${NEW_LXC_IP}:9999/encoder/scan
curl -b /tmp/cortex-jar http://${NEW_LXC_IP}:9999/encoder/scan/status
```

## Phase 10.1 — Parallel run validation checklist

- [ ] All services from LXC 110 appear in Cortex Services section
- [ ] Cloudflare tunnels visible + controllable
- [ ] Media library scans successfully
- [ ] Encoding job runs and shows live progress
- [ ] Storage charts display history
- [ ] Bento tiles resize correctly when job is active
- [ ] Cmd+K palette navigates correctly
- [ ] Heartbeat ticker updates in real time
- [ ] Portainer agent visible in Portainer UI

## Phase 10.2 — Retire old apps (after validation)

```bash
# On LXC 110
pct exec 110 -- docker stop mediamgr unidash-frontend unidash-backend
pct exec 110 -- docker rm   mediamgr unidash-frontend unidash-backend
```

Remove old ingress routes from mgmt-tools tunnel:
- `arr.cirrolink.com/mediamgr`  ← remove
- Keep `arr.cirrolink.com` (arr stack via nginx still needed)
