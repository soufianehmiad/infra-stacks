import os
import json
import time
import socket
import docker
import subprocess
from typing import List, Dict, Optional

# Define known services and their default internal ports
SERVICE_PATTERNS = {
    'sonarr': {'port': 8989, 'path': '/sonarr', 'icon': 'sonarr.png'},
    'radarr': {'port': 7878, 'path': '/radarr', 'icon': 'radarr.png'},
    'lidarr': {'port': 8686, 'path': '/lidarr', 'icon': 'lidarr.png'},
    'readarr': {'port': 8787, 'path': '/readarr', 'icon': 'readarr.png'},
    'prowlarr': {'port': 9696, 'path': '/prowlarr', 'icon': 'prowlarr.png'},
    'bazarr': {'port': 6767, 'path': '/bazarr', 'icon': 'bazarr.png'},
    'sabnzbd': {'port': 8080, 'path': '/sab', 'icon': 'sabnzbd.png'},
    'qbittorrent': {'port': 8080, 'path': '/qbit', 'icon': 'qbittorrent.png'},
    'tautulli': {'port': 8181, 'path': '/tautulli', 'icon': 'tautulli.png'},
    'plex': {'port': 32400, 'path': '/plex', 'icon': 'plex.png'},
    'jellyfin': {'port': 8096, 'path': '/jellyfin', 'icon': 'jellyfin.png'},
    'overseerr': {'port': 5055, 'path': '/overseerr', 'icon': 'overseerr.png'},
    'homarr': {'port': 7575, 'path': '/', 'icon': 'homarr.png'},
    'flaresolverr': {'port': 8191, 'path': None, 'icon': 'flaresolverr.png'}, # No UI usually
    'portainer': {'port': 9000, 'path': '/portainer', 'icon': 'portainer.png'}
}

class ServiceDiscovery:
    def __init__(self):
        self.client = None
        try:
            self.client = docker.from_env()
        except Exception as e:
            print(f"[WARN] Docker SDK not available: {e}")

    def get_services(self) -> List[Dict]:
        """Scans running containers and returns a list of identified services."""
        services = []
        
        # Try Docker SDK first
        if self.client:
            try:
                containers = self.client.containers.list()
                for container in containers:
                    service = self._identify(container)
                    if service:
                        services.append(service)
                return sorted(services, key=lambda x: x['name'])
            except Exception as e:
                print(f"[ERROR] Docker SDK Discovery failed: {e}")
        
        # Fallback to CLI
        print("[INFO] Using Docker CLI fallback")
        return self._discover_via_cli()

    def _discover_via_cli(self) -> List[Dict]:
        services = []
        try:
            # We use a specific format to parse easily
            result = subprocess.run(
                ['docker', 'ps', '--format', '{{json .}}'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                print(f"[ERROR] Docker CLI returned {result.returncode}")
                return []

            for line in result.stdout.strip().split('\n'):
                if not line: continue
                try:
                    info = json.loads(line)
                    # CLI 'Names' is usually "container_name", sometimes "name1,name2"
                    # We take the first one
                    name = info.get('Names', '').split(',')[0]
                    
                    # Construct a pseudo-container object or dictionary
                    # that mimics the structure _identify expects OR just identify here directly.
                    
                    # Let's simplify and just match here directly
                    img = info.get('Image', '').lower()
                    c_name = name.lower()
                    
                    for svc_name, config in SERVICE_PATTERNS.items():
                        if svc_name in c_name or svc_name in img:
                            # Match found
                            services.append({
                                'id': info.get('ID', '')[:12],
                                'name': svc_name.title(),
                                'container_name': name,
                                'type': svc_name,
                                'internal_port': config['port'],
                                'proxy_path': config['path'],
                                'icon': config['icon'],
                                'status': info.get('State', 'unknown'),
                                'target_url': f"http://{name}:{config['port]}"
                            })
                            break
                            
                except Exception as e:
                    print(f"[ERROR] Parsing CLI output line failed: {e}")
                    
        except Exception as e:
            print(f"[ERROR] CLI execution failed: {e}")
            
        return sorted(services, key=lambda x: x['name'])

    def _identify(self, container) -> Optional[Dict]:
        name = container.name.lower()
        image = ''
        if container.image and container.image.tags:
            image = container.image.tags[0].lower()
        
        # Try to match patterns
        for svc_name, config in SERVICE_PATTERNS.items():
            if svc_name in name or svc_name in image:
                return {
                    'id': container.id[:12],
                    'name': svc_name.title(),
                    'container_name': container.name,
                    'type': svc_name,
                    'internal_port': config['port'],
                    'proxy_path': config['path'],
                    'icon': config['icon'],
                    'status': container.status,
                    'target_url': f"http://{container.name}:{config['port]}"
                }
        return None