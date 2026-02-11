"""
Authenticated HTTP Client - Proxy for authenticated requests without exposing credentials.

AIDEV-NOTE: This client provides HTTP request capabilities with authentication
baked in, preventing credential exposure to skills/agents:

1. API key is stored privately (self._api_key)
2. No property exposes the raw key
3. All requests automatically include auth headers
4. Headers property exposes formatted headers only (not raw key)

Usage:
    # In ToolProvider
    http_client = AuthenticatedHttpClient(api_key, org_id)

    # Tools use it for requests
    response = await http_client.get("/api/rows", params={"table_id": 1})
    response = await http_client.post("/api/rows", json={"data": {...}})
"""

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class AuthenticatedHttpClient:
    """
    HTTP client proxy that provides authenticated requests without exposing credentials.

    The API key is stored privately and never exposed through any property.
    All HTTP methods automatically include authentication headers.
    """

    def __init__(
        self,
        api_key: str,
        organization_id: int,
        base_url: str | None = None,
        timeout: float = 30.0,
    ):
        self._api_key = api_key  # PRIVATE: Never expose this
        self._organization_id = organization_id
        self._base_url = base_url or os.getenv(
            "NEXTJS_BASE_URL", "http://localhost:3000"
        )
        self._timeout = timeout

    @property
    def organization_id(self) -> int:
        """Get the organization ID."""
        return self._organization_id

    @property
    def base_url(self) -> str:
        """Get the base URL."""
        return self._base_url

    def _build_headers(
        self, extra_headers: dict[str, str] | None = None
    ) -> dict[str, str]:
        """
        Build request headers with authentication.

        Returns headers dict with auth token and organization ID.
        NOTE: This returns formatted headers, not the raw API key.
        """
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "X-Organization-ID": str(self._organization_id),
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self._base_url.rstrip('/')}/{path.lstrip('/')}"

    async def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an authenticated GET request."""
        url = self._build_url(path)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                params=params,
                headers=self._build_headers(headers),
                **kwargs,
            )
            return response

    async def post(
        self,
        path: str,
        json: dict[str, Any] | None = None,
        data: Any | None = None,
        headers: dict[str, str] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an authenticated POST request."""
        url = self._build_url(path)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                json=json,
                data=data,
                headers=self._build_headers(headers),
                **kwargs,
            )
            return response

    async def put(
        self,
        path: str,
        json: dict[str, Any] | None = None,
        data: Any | None = None,
        headers: dict[str, str] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an authenticated PUT request."""
        url = self._build_url(path)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(
                url,
                json=json,
                data=data,
                headers=self._build_headers(headers),
                **kwargs,
            )
            return response

    async def patch(
        self,
        path: str,
        json: dict[str, Any] | None = None,
        data: Any | None = None,
        headers: dict[str, str] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an authenticated PATCH request."""
        url = self._build_url(path)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.patch(
                url,
                json=json,
                data=data,
                headers=self._build_headers(headers),
                **kwargs,
            )
            return response

    async def delete(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an authenticated DELETE request."""
        url = self._build_url(path)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(
                url,
                params=params,
                headers=self._build_headers(headers),
                **kwargs,
            )
            return response
