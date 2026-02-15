"""Thread-safe graph cache with schema versioning."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import RLock
from typing import Final

DEFAULT_TTL: Final[float] = 3600.0  # 1 hour


@dataclass(slots=True)
class CachedGraph:
    """A cached graph entry with version tracking."""

    graph_name: str
    schema_version: int
    created_at: float = field(default_factory=time.time)

    def is_expired(self, ttl: float) -> bool:
        """Check if this cache entry has expired."""
        return time.time() - self.created_at > ttl


class GraphCache:
    """Thread-safe per-org graph cache with schema versioning.

    Cache invalidation happens on schema changes (AddField, DeleteField, CreateTable).
    Each org has an independent schema version counter.
    """

    __slots__ = ("_cache", "_schema_versions", "_ttl", "_lock")

    def __init__(self, ttl_seconds: float = DEFAULT_TTL) -> None:
        self._cache: dict[int, CachedGraph] = {}
        self._schema_versions: dict[int, int] = {}
        self._ttl = ttl_seconds
        self._lock = RLock()

    def get(self, org_id: int) -> str | None:
        """Get cached graph name if valid, else None.

        A cache hit requires:
        - Entry exists for org_id
        - Entry's schema version matches current version
        - Entry hasn't expired (TTL)
        """
        with self._lock:
            cached = self._cache.get(org_id)
            if cached is None:
                return None

            current_version = self._schema_versions.get(org_id, 0)
            is_stale = cached.schema_version != current_version
            is_expired = cached.is_expired(self._ttl)

            if is_stale or is_expired:
                del self._cache[org_id]
                return None

            return cached.graph_name

    def set(self, org_id: int, graph_name: str) -> None:
        """Cache a graph for an org at current schema version."""
        with self._lock:
            version = self._schema_versions.get(org_id, 0)
            self._cache[org_id] = CachedGraph(graph_name, version)

    def invalidate(self, org_id: int) -> None:
        """Invalidate cache for org by bumping schema version.

        Call this after schema changes (AddField, DeleteField, CreateTable, etc.)
        """
        with self._lock:
            self._schema_versions[org_id] = self._schema_versions.get(org_id, 0) + 1
            self._cache.pop(org_id, None)

    def clear(self) -> None:
        """Clear all cached graphs."""
        with self._lock:
            self._cache.clear()
