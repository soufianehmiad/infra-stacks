"""
Security middleware.

Adds security headers and CSRF protection.
"""
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from ..config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.

    Implements OWASP recommended security headers.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to response."""
        response = await call_next(request)

        # Security headers
        security_headers = {
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            # XSS protection (legacy but harmless)
            "X-XSS-Protection": "1; mode=block",
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            # Referrer policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            # Permissions policy (restrict features)
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        }

        # Content Security Policy (CSP)
        # Allow same-origin content, inline styles for React, and WebSocket
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",  # React needs inline scripts
            "style-src 'self' 'unsafe-inline'",   # Tailwind needs inline styles
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",        # WebSocket connections
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        security_headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # HSTS (only in production with HTTPS)
        if settings.ENV == "production":
            security_headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # Add all headers
        for key, value in security_headers.items():
            response.headers[key] = value

        return response


class CORSHeadersMiddleware(BaseHTTPMiddleware):
    """
    Custom CORS middleware with security considerations.

    Note: FastAPI has built-in CORS middleware, use this for additional control.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle CORS with credentials."""
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization, X-Requested-With"
            )
            response.headers["Access-Control-Max-Age"] = "3600"
            return response

        # Process request
        response = await call_next(request)

        # Add CORS headers
        origin = request.headers.get("origin")
        if origin in settings.CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"

        return response
