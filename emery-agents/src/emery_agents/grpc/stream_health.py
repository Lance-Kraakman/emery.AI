"""Stream health monitoring with heartbeat injection.

Wraps async generators to emit periodic heartbeat events when the inner
generator is silent for too long. Prevents gRPC stream timeouts during
long-running operations like DSPy ReAct tool execution.
"""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable

from .response_types import StepProgressDict, StreamResponseDict

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SECONDS = 15


def _create_heartbeat_event(last_step_name: str) -> StepProgressDict:
    """Create a context-aware heartbeat event."""
    base = last_step_name.rstrip(".").lower()
    return StepProgressDict(
        type="step_progress",
        step_type="INFO",
        step_name=f"Still {base}...",
        step_index=-1,
        content="",
        metadata={},  # Empty metadata - no custom fields needed
    )


async def stream_with_heartbeat(
    inner: AsyncIterator[StreamResponseDict],
    interval: float = HEARTBEAT_INTERVAL_SECONDS,
    is_cancelled: Callable[[], bool] | None = None,
) -> AsyncIterator[StreamResponseDict]:
    """
    Wrap an async generator with heartbeat injection and cancellation support.

    Emits a context-aware heartbeat if the inner generator is silent
    for `interval` seconds. Also checks for cancellation each interval.

    Args:
        inner: The async generator to wrap
        interval: Seconds of silence before emitting heartbeat (default 15)
        is_cancelled: Optional callback to check if execution was cancelled

    Yields:
        Events from inner generator, plus heartbeat events during silence
    """
    queue: asyncio.Queue[StreamResponseDict | BaseException | None] = asyncio.Queue()
    done = asyncio.Event()
    last_step_name = "thinking"

    async def producer() -> None:
        nonlocal last_step_name
        try:
            async for item in inner:
                # Track step name for context-aware heartbeat
                if item.get("type") == "step_progress":
                    step_name = item.get("step_name")
                    if isinstance(step_name, str):
                        last_step_name = step_name
                await queue.put(item)
        except Exception as e:
            await queue.put(e)
        finally:
            done.set()
            await queue.put(None)

    # Create producer task first so heartbeat can reference it
    producer_task: asyncio.Task[None] | None = None

    async def heartbeat() -> None:
        while not done.is_set():
            try:
                await asyncio.wait_for(done.wait(), timeout=interval)
            except asyncio.TimeoutError:
                # Check for cancellation
                if is_cancelled and is_cancelled():
                    logger.info("Cancellation detected, stopping execution")
                    done.set()
                    if producer_task:
                        producer_task.cancel()
                    await queue.put(None)
                    return

                if not done.is_set():
                    logger.debug("Heartbeat: still %s", last_step_name)
                    await queue.put(_create_heartbeat_event(last_step_name))

    producer_task = asyncio.create_task(producer())
    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, BaseException):
                raise item
            yield item
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await producer_task
