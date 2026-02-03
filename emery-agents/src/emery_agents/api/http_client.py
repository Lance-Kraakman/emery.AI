"""
Shared HTTP client for DSPy tools.

This module provides thread-safe HTTP request handling for all DSPy tool functions.
Ported from tools/crud_tools.py AsyncHTTPManager.
"""

from __future__ import annotations

import asyncio
import atexit
import json
import logging
import os
import threading
import time
import uuid
from typing import Any

import httpx

from emery_agents.utils.permission_error_parser import (
    format_permission_error_for_user,
    parse_permission_error,
)

logger = logging.getLogger(__name__)


class HTTPClient:
    """
    Thread-safe HTTP client for DSPy tools.

    Uses a dedicated event loop thread for non-blocking operations.
    """

    def __init__(self, timeout: float = 30.0) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._client: httpx.AsyncClient | None = None
        self._ready = threading.Event()
        self._timeout = timeout
        self._start_event_loop_thread()

    def _start_event_loop_thread(self) -> None:
        """Start event loop in dedicated thread."""
        def run_loop() -> None:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._client = httpx.AsyncClient(timeout=self._timeout)
            self._ready.set()
            self._loop.run_forever()

        self._thread = threading.Thread(target=run_loop, daemon=True)
        self._thread.start()
        self._ready.wait()

    def cleanup(self) -> None:
        """Cleanup HTTP client resources."""
        if self._client and not self._client.is_closed:
            if self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(self._client.aclose(), self._loop)

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def request(
        self,
        endpoint: str,
        method: str,
        data: dict[str, Any] | None,
        auth_token: str,
        org_id: str,
        base_url: str | None = None,
        deadline_ms: int | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> str:
        """
        Make authenticated HTTP request.

        Returns string result (success or error message).
        DSPy tools should return strings.
        """
        if not self._loop or not self._client:
            return "ERROR: HTTP client not initialized"

        coro = self._async_request(
            endpoint=endpoint,
            method=method,
            data=data,
            auth_token=auth_token,
            org_id=org_id,
            base_url=base_url,
            deadline_ms=deadline_ms,
            extra_headers=extra_headers,
        )
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)

        timeout = self._timeout
        if deadline_ms:
            timeout = min(deadline_ms / 1000.0, self._timeout)

        try:
            return future.result(timeout=timeout)
        except Exception as e:
            return f"ERROR: Request failed: {e}"

    async def _async_request(
        self,
        endpoint: str,
        method: str,
        data: dict[str, Any] | None,
        auth_token: str,
        org_id: str,
        base_url: str | None = None,
        deadline_ms: int | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> str:
        """Core async HTTP request with deadline propagation."""
        call_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        # Default base URL from environment
        if base_url is None:
            nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
            base_url = f"{nextjs_base}/api"

        url = f"{base_url}/{endpoint.lstrip('/')}"

        logger.info(f"[DSPY-HTTP] {method} {endpoint} - call_id: {call_id}")

        # Build headers
        headers: dict[str, str] = {
            "X-Call-ID": call_id,
            "X-Source": "dspy_tool",
        }

        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        if org_id:
            headers["X-Organization-ID"] = str(org_id)

        if deadline_ms:
            headers["X-Deadline-MS"] = str(deadline_ms)

        if data is not None:
            headers["Content-Type"] = "application/json"

        # Merge extra headers (agent context, trigger info, etc.)
        if extra_headers:
            headers.update(extra_headers)

        # Calculate timeout from deadline
        timeout = 25.0
        if deadline_ms:
            timeout = min(deadline_ms / 1000 - 5, 25.0)

        try:
            if self._client is None:
                return "ERROR: HTTP client not initialized"

            response = await self._client.request(
                method=method,
                url=url,
                headers=headers,
                json=data if data else None,
                timeout=timeout,
            )

            total_time = time.time() - start_time

            # Handle HTTP errors
            if response.status_code >= 400:
                error_detail = f"HTTP {response.status_code}"
                error_body = None

                try:
                    error_body = response.json()
                    if "error" in error_body:
                        error_detail = error_body["error"]
                    elif "message" in error_body:
                        error_detail = error_body["message"]
                except (json.JSONDecodeError, KeyError, TypeError):
                    error_detail = response.text[:200] if response.text else error_detail

                logger.error(
                    f"[DSPY-HTTP] {method} {endpoint} - call_id: {call_id}, "
                    f"status: {response.status_code}, duration: {total_time:.2f}s"
                )

                # Special handling for 403 permission errors
                if response.status_code == 403:
                    perm_error = parse_permission_error(error_body or {"error": error_detail})
                    if perm_error:
                        user_message = format_permission_error_for_user(perm_error)
                        return f"PERMISSION_DENIED: {user_message}"

                return f"ERROR: {error_detail}"

            # Parse successful response
            try:
                logger.info(
                    f"[DSPY-HTTP] {method} {endpoint} - call_id: {call_id}, "
                    f"status: {response.status_code}, duration: {total_time:.2f}s"
                )
                result_data = response.json()
                return json.dumps(result_data, default=str)
            except json.JSONDecodeError:
                return response.text

        except httpx.TimeoutException:
            return f"ERROR: Request timeout after {timeout} seconds"
        except httpx.RequestError as e:
            return f"ERROR: HTTP request failed: {e}"
        except Exception as e:
            return f"ERROR: Unexpected error: {e}"


# Global singleton client
_client: HTTPClient | None = None


def get_base_url() -> str:
    """Get the base URL for API calls (without /api suffix)."""
    return os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")


def get_http_client() -> HTTPClient:
    """Get or create the global HTTP client."""
    global _client
    if _client is None:
        _client = HTTPClient()
    return _client


def unwrap_entity(result: str) -> dict[str, Any] | None:
    """Unwrap entity from API envelope {"success": true, "data": {...}}."""
    try:
        parsed = json.loads(result)
        if isinstance(parsed, dict) and "data" in parsed:
            return parsed["data"]
        return parsed
    except (json.JSONDecodeError, TypeError):
        return None


def make_request(
    endpoint: str,
    method: str,
    data: dict[str, Any] | None,
    auth_token: str,
    org_id: str,
    base_url: str | None = None,
    deadline_ms: int | None = None,
    extra_headers: dict[str, str] | None = None,
) -> str:
    """
    Make authenticated HTTP request using the global client.

    This is the main function used by DSPy tools.

    Args:
        endpoint: API endpoint path (e.g., "tables", "tables/123")
        method: HTTP method (GET, POST, PUT, DELETE)
        data: Request body for POST/PUT
        auth_token: Bearer token for authentication
        org_id: Organization ID for RLS context
        base_url: Optional base URL override
        deadline_ms: Optional deadline in milliseconds
        extra_headers: Optional headers to merge (agent context, trigger info)

    Returns:
        JSON string on success, error string on failure.
    """
    client = get_http_client()
    return client.request(
        endpoint=endpoint,
        method=method,
        data=data,
        auth_token=auth_token,
        org_id=org_id,
        base_url=base_url,
        deadline_ms=deadline_ms,
        extra_headers=extra_headers,
    )


# Cleanup on exit


def _cleanup_http_client() -> None:
    """Cleanup handler for HTTP client shutdown."""
    global _client
    if _client is not None:
        _client.cleanup()
        logger.info("DSPy HTTP client shut down")


atexit.register(_cleanup_http_client)
