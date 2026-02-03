"""
Redis Client for Delta Lake Write Buffer

Singleton Redis connection for the Python gRPC worker.
Returns None if Redis is unavailable (graceful degradation).
"""

import logging
import os
from typing import Optional

import redis

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None
_initialized = False


def get_redis_client() -> Optional[redis.Redis]:
    """Get singleton Redis client. Returns None if Redis unavailable."""
    global _redis_client, _initialized

    if _initialized:
        return _redis_client

    _initialized = True
    redis_url = os.getenv("REDIS_URL")

    if not redis_url:
        logger.info("[RedisClient] REDIS_URL not set, write buffer disabled")
        return None

    try:
        _redis_client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
        _redis_client.ping()
        logger.info(f"[RedisClient] Connected to Redis at {redis_url}")
        return _redis_client
    except Exception as e:
        logger.warning(f"[RedisClient] Redis unavailable ({e}), write buffer disabled")
        _redis_client = None
        return None
