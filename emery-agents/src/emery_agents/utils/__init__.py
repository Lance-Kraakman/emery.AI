"""
Shared utilities for emery-agents.

Modules:
- error_classifier: Classify and handle agent errors
- error_messages: Error message templates
- mention_parser: Parse @agent:name mentions from messages
- session_logger: Debug logging for agent prompt flows
"""

import asyncio
import atexit
import concurrent.futures
import logging
from typing import Any, Coroutine, TypeVar

_logger = logging.getLogger(__name__)

T = TypeVar('T')

_async_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=10,
    thread_name_prefix="async-bridge"
)


def _cleanup_thread_pool() -> None:
    """Cleanup handler for graceful thread pool shutdown."""
    _async_thread_pool.shutdown(wait=True, cancel_futures=False)
    _logger.debug("Async bridge thread pool shut down")


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
        _logger.error(f"Async operation timed out after {timeout} seconds")
        raise TimeoutError(f"Operation exceeded {timeout} second timeout")
    except Exception as e:
        _logger.error(f"Async operation failed: {e}")
        raise


from .mention_parser import (
    parse_agent_mention,
    has_agent_mention,
    extract_all_agent_mentions,
    parse_skill_mention,
    parse_skill_invocation,
    has_skill_mention,
    SkillInvocation,
)
from .session_logger import (
    SessionLogger,
    get_session_logger,
)

__all__ = [
    "run_async_in_thread",
    "parse_agent_mention",
    "has_agent_mention",
    "extract_all_agent_mentions",
    "parse_skill_mention",
    "parse_skill_invocation",
    "has_skill_mention",
    "SkillInvocation",
    "SessionLogger",
    "get_session_logger",
]
