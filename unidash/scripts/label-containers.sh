#!/bin/bash
# Label existing containers for UniDash discovery

set -e

echo "==================================="
echo "UniDash Container Labeling Script"
echo "==================================="
echo

# Service definitions: name|type|port|path
SERVICES=(
  "sonarr|sonarr|8989|/sonarr"
  "radarr|radarr|7878|/radarr"
  "prowlarr|prowlarr|9696|/prowlarr"
  "lidarr|lidarr|8686|/lidarr"
  "readarr|readarr|8787|/readarr"
  "bazarr|bazarr|6767|/bazarr"
  "qbittorrent|qbittorrent|8080|/qbit"
  "sabnzbd|sabnzbd|8080|/sabnzbd"
  "tautulli|tautulli|8181|/tautulli"
  "overseerr|overseerr|5055|/overseerr"
  "plex|plex|32400|/plex"
  "jellyfin|jellyfin|8096|/jellyfin"
  "portainer|portainer|9000|/portainer"
  "homarr|homarr|7575|/homarr"
)

label_container() {
  local container_name=$1
  local service_type=$2
  local service_port=$3
  local proxy_path=$4
  local display_name="${service_type^}"

  if ! docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    echo "⊘ Container '${container_name}' not found, skipping..."
    return
  fi

  echo "→ Labeling ${container_name}..."

  docker update \
    --label "unidash.enable=true" \
    --label "unidash.name=${display_name}" \
    --label "unidash.type=${service_type}" \
    --label "unidash.port=${service_port}" \
    --label "unidash.path=${proxy_path}" \
    "${container_name}" > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "✓ Successfully labeled ${container_name}"
  else
    echo "✗ Failed to label ${container_name}"
  fi
}

echo "Labeling containers for UniDash discovery..."
echo

for service in "${SERVICES[@]}"; do
  IFS='|' read -r name type port path <<< "$service"
  label_container "$name" "$type" "$port" "$path"
done

echo
echo "==================================="
echo "Labeling complete!"
echo "==================================="
