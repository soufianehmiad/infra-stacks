import logging
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import httpx
from starlette.background import BackgroundTask

from .discovery import ServiceDiscovery, SERVICE_PATTERNS

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("unidash")

app = FastAPI(title="UniDash")
discovery = ServiceDiscovery()
templates = Jinja2Templates(directory="app/templates")

# Mount static files (css, js, images)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# HTTP Client for Proxying
client = httpx.AsyncClient(timeout=60.0)

@app.on_event("shutdown")
async def shutdown_event():
    await client.aclose()

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Render the dashboard UI."""
    services = discovery.get_services()
    return templates.TemplateResponse("index.html", {"request": request, "services": services})

@app.get("/api/services")
async def get_services():
    """API endpoint to get services list."""
    return discovery.get_services()

# --- REVERSE PROXY LOGIC ---

async def proxy_request(request: Request, target_url: str, path: str):
    """
    Generic proxy handler.
    """
    url = f"{target_url}{path}"
    query = request.url.query
    if query:
        url += f"?{query}"

    logger.info(f"Proxying: {request.method} {request.url.path} -> {url}")

    try:
        # Prepare headers (filter out host to avoid confusion)
        headers = dict(request.headers)
        headers.pop("host", None)
        headers.pop("content-length", None) # Let httpx handle this
        
        # Forward X-Forwarded headers
        headers["X-Forwarded-For"] = request.client.host
        headers["X-Forwarded-Proto"] = request.url.scheme
        headers["X-Forwarded-Host"] = request.headers.get("host", "")
        headers["X-Forwarded-Prefix"] = request.headers.get("X-Forwarded-Prefix", "")

        rp_req = client.build_request(
            request.method,
            url,
            headers=headers,
            content=request.stream(),
            cookies=request.cookies
        )
        
        rp_resp = await client.send(rp_req, stream=True)
        
        return StreamingResponse(
            rp_resp.aiter_raw(),
            status_code=rp_resp.status_code,
            headers=rp_resp.headers,
            background=BackgroundTask(rp_resp.aclose),
        )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return Response(f"Proxy Error: {str(e)}", status_code=502)

# Dynamic Route Generation
# We need to capture /service_name and /service_name/*
# Since FastAPI doesn't support regex routes nicely for this in a loop,
# we will use a catch-all middleware or specific routes.

# Let's define explicit routes for known services to keep it clean.
# We create a factory function to generate endpoints.

def create_proxy_endpoint(service_key: str, config: dict):
    prefix = config['path']
    if not prefix:
        return

    # Remove trailing slash for the base path
    base_prefix = prefix.rstrip('/')
    
    # 1. Handle exact path (e.g. /sonarr) -> redirect to /sonarr/ or fetch /sonarr/
    # Usually apps expect the trailing slash if they are mounted on a subpath.
    
    @app.api_route(f"{base_prefix}/{{path:path}}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
    async def proxy_wrapper(request: Request, path: str):
        # Find the actual container at runtime to get the correct IP/Hostname
        services = discovery.get_services()
        target_service = next((s for s in services if s['type'] == service_key), None)
        
        if not target_service:
            return Response("Service not found or not running", status_code=404)
            
        target_base = target_service['target_url'] # e.g. http://sonarr:8989
        
        # Construct path for the target
        # If we request /sonarr/api/v3, path is "api/v3"
        # We generally want to forward to http://sonarr:8989/api/v3
        # BUT, if the app expects a base url, we might need to keep the prefix?
        # Usually, if we configure "Base URL" in the app, it expects the prefix.
        # If we DON'T configure Base URL, we strip it.
        # Nginx config usually passed path verbatim if base url is set.
        
        # Assuming Base URL IS set in the apps (we did it for Bazarr),
        # we pass the full path including prefix.
        
        # request.url.path contains the full path e.g. /sonarr/api/v3
        
        # We simply forward to http://sonarr:8989/sonarr/api/v3
        # Wait, target_url is http://sonarr:8989
        
        # Case A: App HAS Base URL set (e.g. /sonarr)
        # Request: /sonarr/api
        # Target: http://sonarr:8989/sonarr/api
        
        # Case B: App has NO Base URL
        # Request: /sonarr/api
        # Target: http://sonarr:8989/api
        
        # For this setup to be robust, we will assume the Apps are configured with Base URL
        # because that's how the previous Nginx setup worked.
        # So we construct target: http://sonarr:8989 + request.url.path
        
        return await proxy_request(request, target_base, request.url.path)

# Register routes
for key, conf in SERVICE_PATTERNS.items():
    create_proxy_endpoint(key, conf)

