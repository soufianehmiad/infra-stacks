"""
Docker service discovery.

Discovers services from Docker containers with labels.
"""
import docker
from typing import List, Dict, Optional
from ..models.service import ServiceResponse
from ..models.base import StatusEnum
from ..config import settings


class DockerServiceDiscovery:
    """
    Discover and manage services from Docker containers.

    Uses Docker labels to identify services and their configuration.
    """

    def __init__(self):
        """Initialize Docker client."""
        try:
            self.client = docker.DockerClient(base_url=settings.DOCKER_HOST)
            self.client.ping()
            print("✓ Docker client connected")
        except Exception as e:
            print(f"✗ Docker client connection failed: {e}")
            self.client = None

    def discover_services(self) -> List[ServiceResponse]:
        """
        Discover services from Docker containers.

        Looks for containers with labels:
        - unidash.enable=true
        - unidash.name=<service_name>
        - unidash.type=<service_type>
        - unidash.port=<port>
        - unidash.path=<proxy_path>

        Returns:
            List of discovered services
        """
        if not self.client:
            return []

        services = []

        try:
            # Get all containers
            containers = self.client.containers.list(all=True)

            for container in containers:
                # Check if container is a UniDash service
                labels = container.labels
                has_label = labels.get("unidash.enable") == "true"

                # Auto-discover common services by name
                auto_discovered = False
                service_config = self._auto_discover_service(container.name)
                if service_config and not has_label:
                    auto_discovered = True

                if not has_label and not auto_discovered:
                    continue

                # Extract service information
                service_id = container.short_id
                if auto_discovered:
                    service_name = service_config["name"]
                    service_type = service_config["type"]
                    service_port = service_config["port"]
                    proxy_path = service_config.get("path", f"/{service_type}")
                else:
                    service_name = labels.get("unidash.name", container.name)
                    service_type = labels.get("unidash.type", "unknown")
                    service_port = int(labels.get("unidash.port", "80"))
                    proxy_path = labels.get("unidash.path", f"/{service_type}")

                # Map container status to StatusEnum
                status = self._map_status(container.status)

                # Get container stats if running
                cpu_usage = None
                memory_usage = None
                if status == StatusEnum.RUNNING:
                    try:
                        stats = container.stats(stream=False)
                        cpu_usage = self._calculate_cpu_percent(stats)
                        memory_usage = self._calculate_memory_percent(stats)
                    except Exception:
                        pass

                # Create service response
                service = ServiceResponse(
                    id=service_id,
                    name=service_name,
                    container_name=container.name,
                    type=service_type,
                    internal_port=service_port,
                    proxy_path=proxy_path,
                    status=status,
                    target_url=proxy_path,
                    health_status=self._get_health_status(container),
                    uptime_seconds=self._get_uptime(container),
                    cpu_usage=cpu_usage,
                    memory_usage=memory_usage,
                )

                services.append(service)

        except Exception as e:
            print(f"Error discovering services: {e}")

        return services

    def get_service_by_id(self, service_id: str) -> Optional[ServiceResponse]:
        """
        Get a specific service by ID.

        Args:
            service_id: Container short ID

        Returns:
            Service if found, None otherwise
        """
        services = self.discover_services()
        for service in services:
            if service.id == service_id:
                return service
        return None

    def control_service(self, service_id: str, action: str) -> bool:
        """
        Control a service (start, stop, restart).

        Args:
            service_id: Container short ID
            action: Action to perform (start, stop, restart)

        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False

        try:
            container = self.client.containers.get(service_id)

            if action == "start":
                container.start()
            elif action == "stop":
                container.stop()
            elif action == "restart":
                container.restart()
            else:
                return False

            return True

        except Exception as e:
            print(f"Error controlling service {service_id}: {e}")
            return False

    def _auto_discover_service(self, container_name: str) -> Optional[Dict]:
        """
        Auto-discover service configuration based on container name.

        Args:
            container_name: Name of the container

        Returns:
            Service configuration dict or None
        """
        # Known service mappings
        service_map = {
            "sonarr": {"name": "Sonarr", "type": "sonarr", "port": 8989, "path": "/sonarr"},
            "sonarr-anime": {"name": "Sonarr Anime", "type": "sonarr", "port": 8990, "path": "/sonarr-anime"},
            "radarr": {"name": "Radarr", "type": "radarr", "port": 7878, "path": "/radarr"},
            "prowlarr": {"name": "Prowlarr", "type": "prowlarr", "port": 9696, "path": "/prowlarr"},
            "bazarr": {"name": "Bazarr", "type": "bazarr", "port": 6767, "path": "/bazarr"},
            "lidarr": {"name": "Lidarr", "type": "lidarr", "port": 8686, "path": "/lidarr"},
            "readarr": {"name": "Readarr", "type": "readarr", "port": 8787, "path": "/readarr"},
            "qbittorrent": {"name": "qBittorrent", "type": "qbittorrent", "port": 8080, "path": "/qbittorrent"},
            "sabnzbd": {"name": "SABnzbd", "type": "sabnzbd", "port": 8080, "path": "/sabnzbd"},
            "tautulli": {"name": "Tautulli", "type": "tautulli", "port": 8181, "path": "/tautulli"},
            "plex": {"name": "Plex", "type": "plex", "port": 32400, "path": "/web"},
            "jellyfin": {"name": "Jellyfin", "type": "jellyfin", "port": 8096, "path": "/jellyfin"},
            "overseerr": {"name": "Overseerr", "type": "overseerr", "port": 5055, "path": "/overseerr"},
            "portainer": {"name": "Portainer", "type": "portainer", "port": 9000, "path": "/portainer"},
            "homarr": {"name": "Homarr", "type": "homarr", "port": 7575, "path": "/homarr"},
            "flaresolverr": {"name": "FlareSolverr", "type": "flaresolverr", "port": 8191, "path": "/flaresolverr"},
        }

        # Check if container name matches any known service
        container_name_lower = container_name.lower()
        for service_key, config in service_map.items():
            if service_key in container_name_lower:
                return config

        return None

    def _map_status(self, docker_status: str) -> StatusEnum:
        """Map Docker status to StatusEnum."""
        status_map = {
            "running": StatusEnum.RUNNING,
            "exited": StatusEnum.STOPPED,
            "paused": StatusEnum.PAUSED,
            "restarting": StatusEnum.RESTARTING,
        }
        return status_map.get(docker_status.lower(), StatusEnum.UNKNOWN)

    def _get_health_status(self, container) -> Optional[str]:
        """Get container health status."""
        health = container.attrs.get("State", {}).get("Health", {})
        if health:
            status = health.get("Status", "").lower()
            if status == "healthy":
                return "healthy"
            elif status == "unhealthy":
                return "unhealthy"
            else:
                return "degraded"
        return None

    def _get_uptime(self, container) -> Optional[float]:
        """Get container uptime in seconds."""
        try:
            state = container.attrs.get("State", {})
            if state.get("Running"):
                from datetime import datetime
                started_at = state.get("StartedAt", "")
                if started_at:
                    # Parse ISO 8601 timestamp
                    started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    now = datetime.now(started.tzinfo)
                    uptime = (now - started).total_seconds()
                    return uptime
        except Exception:
            pass
        return None

    def _calculate_cpu_percent(self, stats: dict) -> Optional[float]:
        """Calculate CPU usage percentage from stats."""
        try:
            cpu_stats = stats["cpu_stats"]
            precpu_stats = stats["precpu_stats"]

            cpu_delta = cpu_stats["cpu_usage"]["total_usage"] - precpu_stats["cpu_usage"]["total_usage"]
            system_delta = cpu_stats["system_cpu_usage"] - precpu_stats["system_cpu_usage"]

            if system_delta > 0 and cpu_delta > 0:
                cpu_count = cpu_stats.get("online_cpus", 1)
                cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0
                return round(cpu_percent, 2)
        except Exception:
            pass
        return None

    def _calculate_memory_percent(self, stats: dict) -> Optional[float]:
        """Calculate memory usage percentage from stats."""
        try:
            memory_stats = stats["memory_stats"]
            usage = memory_stats["usage"]
            limit = memory_stats["limit"]

            if limit > 0:
                memory_percent = (usage / limit) * 100.0
                return round(memory_percent, 2)
        except Exception:
            pass
        return None


# Global instance
docker_discovery = DockerServiceDiscovery()
