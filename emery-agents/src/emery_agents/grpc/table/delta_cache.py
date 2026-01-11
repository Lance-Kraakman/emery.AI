"""
DeltaTable Cache Manager

Caches DeltaTable instances to reduce S3 metadata reads.
Each operation that creates a DeltaTable() hits S3 to read the _delta_log,
which adds ~50-100ms latency per call in cloud environments.

This cache stores DeltaTable instances with TTL-based invalidation:
- Reads use cached instances (fast)
- Writes invalidate the cache for that table
- TTL ensures stale data is eventually refreshed
"""

import logging
import threading
import time
from typing import Dict, Optional, Tuple, Any

from deltalake import DeltaTable

logger = logging.getLogger(__name__)


class DeltaTableCache:
    """
    Thread-safe cache for DeltaTable instances.

    Reduces S3 round trips by caching DeltaTable metadata.
    Write operations should call invalidate() to ensure consistency.
    """

    def __init__(self, ttl_seconds: int = 30, max_size: int = 100):
        """
        Initialize the cache.

        Args:
            ttl_seconds: Time-to-live for cached entries (default: 30s)
            max_size: Maximum number of cached tables (default: 100)
        """
        self._cache: Dict[str, Tuple[DeltaTable, float]] = {}
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

    def get(self, s3_uri: str, storage_options: Dict[str, str]) -> DeltaTable:
        """
        Get a DeltaTable, using cache if available and not expired.

        Args:
            s3_uri: S3 URI for the Delta table
            storage_options: S3 storage configuration

        Returns:
            DeltaTable instance (cached or fresh)
        """
        now = time.time()

        with self._lock:
            if s3_uri in self._cache:
                table, cached_at = self._cache[s3_uri]
                if now - cached_at < self._ttl:
                    self._hits += 1
                    logger.debug(f"[DeltaCache] HIT for {s3_uri} (age: {now - cached_at:.1f}s)")
                    return table
                else:
                    # Expired - remove and reload
                    logger.debug(f"[DeltaCache] EXPIRED for {s3_uri} (age: {now - cached_at:.1f}s)")
                    del self._cache[s3_uri]

            # Cache miss - load from S3
            self._misses += 1
            logger.debug(f"[DeltaCache] MISS for {s3_uri}, loading from S3")

            start = time.time()
            table = DeltaTable(s3_uri, storage_options=storage_options)
            load_time = (time.time() - start) * 1000
            logger.debug(f"[DeltaCache] Loaded {s3_uri} in {load_time:.1f}ms")

            # Evict oldest if at capacity
            if len(self._cache) >= self._max_size:
                self._evict_oldest()

            self._cache[s3_uri] = (table, now)
            return table

    def get_fresh(self, s3_uri: str, storage_options: Dict[str, str]) -> DeltaTable:
        """
        Get a fresh DeltaTable, bypassing and updating the cache.

        Use this after writes when you need the latest state immediately.

        Args:
            s3_uri: S3 URI for the Delta table
            storage_options: S3 storage configuration

        Returns:
            Fresh DeltaTable instance
        """
        now = time.time()

        with self._lock:
            logger.debug(f"[DeltaCache] REFRESH for {s3_uri}")
            table = DeltaTable(s3_uri, storage_options=storage_options)
            self._cache[s3_uri] = (table, now)
            return table

    def invalidate(self, s3_uri: str) -> None:
        """
        Invalidate cache entry for a specific table.

        Call this after write operations to ensure consistency.

        Args:
            s3_uri: S3 URI of the table to invalidate
        """
        with self._lock:
            if s3_uri in self._cache:
                del self._cache[s3_uri]
                logger.debug(f"[DeltaCache] INVALIDATED {s3_uri}")

    def invalidate_all(self) -> None:
        """Clear the entire cache."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.debug(f"[DeltaCache] CLEARED all {count} entries")

    def _evict_oldest(self) -> None:
        """Evict the oldest entry from the cache."""
        if not self._cache:
            return

        oldest_uri = min(self._cache.keys(), key=lambda k: self._cache[k][1])
        del self._cache[oldest_uri]
        logger.debug(f"[DeltaCache] EVICTED oldest: {oldest_uri}")

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "ttl_seconds": self._ttl,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_percent": round(hit_rate, 1),
            }


# Global singleton instance
# TTL of 300 seconds (5 min) reduces S3 metadata reads by ~10x for read-heavy workloads
# Writes always call invalidate_delta_cache() so subsequent reads get fresh data
_delta_cache = DeltaTableCache(ttl_seconds=300, max_size=100)


def get_delta_table_cached(s3_uri: str, storage_options: Dict[str, str]) -> DeltaTable:
    """
    Get a DeltaTable using the global cache.

    Args:
        s3_uri: S3 URI for the Delta table
        storage_options: S3 storage configuration

    Returns:
        DeltaTable instance (cached or fresh)
    """
    return _delta_cache.get(s3_uri, storage_options)


def get_delta_table_fresh(s3_uri: str, storage_options: Dict[str, str]) -> DeltaTable:
    """
    Get a fresh DeltaTable, bypassing and updating the cache.

    Args:
        s3_uri: S3 URI for the Delta table
        storage_options: S3 storage configuration

    Returns:
        Fresh DeltaTable instance
    """
    return _delta_cache.get_fresh(s3_uri, storage_options)


def invalidate_delta_cache(s3_uri: str) -> None:
    """
    Invalidate cache entry for a specific table.

    Call this after write operations.

    Args:
        s3_uri: S3 URI of the table to invalidate
    """
    _delta_cache.invalidate(s3_uri)


def invalidate_all_delta_cache() -> None:
    """Clear the entire Delta table cache."""
    _delta_cache.invalidate_all()


def get_delta_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return _delta_cache.stats()
