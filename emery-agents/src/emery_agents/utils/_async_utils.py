"""Run async coroutines from sync contexts using a shared thread pool."""

import asyncio
import atexit
import concurrent.futures
import logging
from typing import Any, Coroutine, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')

_async_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=10,
    thread_name_prefix="async-bridge"
)


def _cleanup_thread_pool() -> None:
    """Cleanup handler for graceful thread pool shutdown."""
    _async_thread_pool.shutdown(wait=True, cancel_futures=False)
    logger.debug("Async bridge thread pool shut down")


atexit.register(_cleanup_thread_pool)


def run_async_in_thread(
    coro: Coroutine[Any, Any, T],
    timeout: float = 60.0
) -> T:
    """Run coroutine in thread pool. Timeout defaults to 60s."""
    try:
        future = _async_thread_pool.submit(asyncio.run, coro)
        return future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        logger.error(f"Async operation timed out after {timeout} seconds")
        raise TimeoutError(f"Operation exceeded {timeout} second timeout")
    except Exception as e:
        logger.error(f"Async operation failed: {e}")
        raise
