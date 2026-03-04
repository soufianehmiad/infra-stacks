"""
UniDash FastAPI Application.

Modern TypeScript-first architecture with enterprise-grade security.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from .api.routes import auth_router, services_router
from .api.websocket import websocket_router
from .db import Base, engine
from .models.health import HealthCheck


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.

    Runs on startup and shutdown.
    """
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📝 Environment: {settings.ENV}")
    print(f"🔒 JWT Algorithm: {settings.JWT_ALGORITHM}")

    # Create database tables if they don't exist
    print("📊 Initializing database...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database ready")

    yield

    # Shutdown
    print(f"👋 Shutting down {settings.APP_NAME}")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Unified dashboard for server management",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS middleware (must be first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(services_router, prefix="/api")
app.include_router(websocket_router, prefix="/api")


@app.get("/health", response_model=HealthCheck)
async def health_check():
    """
    Health check endpoint.

    Returns application status and basic metrics.
    """
    return HealthCheck(
        status="healthy",
        version=settings.APP_VERSION,
        environment=settings.ENV,
    )


@app.get("/api/health", response_model=HealthCheck)
async def api_health_check():
    """
    API health check endpoint.

    Same as /health but under /api prefix.
    """
    return HealthCheck(
        status="healthy",
        version=settings.APP_VERSION,
        environment=settings.ENV,
    )


@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Custom 404 handler."""
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"},
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Custom 500 handler."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
