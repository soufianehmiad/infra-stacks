"""
Rate limiting middleware.

Implements token bucket algorithm for rate limiting API requests.
Uses in-memory storage (consider Redis for production clustering).
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from ..config import settings


class RateLimiter:
    """
    Token bucket rate limiter.

    Allows burst requests up to bucket size, then refills at constant rate.
    """

    def __init__(self, rate: int = 60, window: int = 60):
        """
        Initialize rate limiter.

        Args:
            rate: Maximum requests allowed per window
            window: Time window in seconds
        """
        self.rate = rate
        self.window = window
        self.buckets: dict[str, dict] = defaultdict(
            lambda: {"tokens": rate, "last_update": datetime.utcnow()}
        )

    def is_allowed(self, key: str) -> tuple[bool, dict]:
        """
        Check if request is allowed.

        Args:
            key: Identifier for rate limit bucket (e.g., IP address)

        Returns:
            (allowed, headers) tuple with rate limit headers
        """
        now = datetime.utcnow()
        bucket = self.buckets[key]

        # Calculate tokens to add based on time elapsed
        time_elapsed = (now - bucket["last_update"]).total_seconds()
        tokens_to_add = time_elapsed * (self.rate / self.window)

        # Update bucket
        bucket["tokens"] = min(self.rate, bucket["tokens"] + tokens_to_add)
        bucket["last_update"] = now

        # Check if request allowed
        allowed = bucket["tokens"] >= 1
        if allowed:
            bucket["tokens"] -= 1

        # Rate limit headers
        headers = {
            "X-RateLimit-Limit": str(self.rate),
            "X-RateLimit-Remaining": str(int(bucket["tokens"])),
            "X-RateLimit-Reset": str(
                int((now + timedelta(seconds=self.window)).timestamp())
            ),
        }

        return allowed, headers

    def cleanup_old_buckets(self):
        """Remove buckets not accessed in 2x window period."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=self.window * 2)

        keys_to_remove = [
            key
            for key, bucket in self.buckets.items()
            if bucket["last_update"] < cutoff
        ]

        for key in keys_to_remove:
            del self.buckets[key]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.

    Applies rate limits based on client IP address.
    """

    def __init__(self, app, rate: int = None, window: int = 60):
        """
        Initialize middleware.

        Args:
            app: FastAPI application
            rate: Requests per window (default from settings)
            window: Window size in seconds (default 60)
        """
        super().__init__(app)
        self.limiter = RateLimiter(
            rate=rate or settings.RATE_LIMIT_PER_MINUTE, window=window
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/api/health"]:
            return await call_next(request)

        # Get client identifier (IP address)
        client_ip = request.client.host if request.client else "unknown"

        # Check rate limit
        allowed, headers = self.limiter.is_allowed(client_ip)

        if not allowed:
            # Return 429 Too Many Requests
            return Response(
                content='{"detail":"Rate limit exceeded. Please try again later."}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={
                    **headers,
                    "Content-Type": "application/json",
                    "Retry-After": str(self.limiter.window),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        for key, value in headers.items():
            response.headers[key] = value

        return response
