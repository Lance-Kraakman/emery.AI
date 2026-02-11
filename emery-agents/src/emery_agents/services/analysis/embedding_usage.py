"""
Embedding Usage Tracker — Accumulates embedding API usage for billing.

The tracker records estimated token counts for each embedding call.
Usage is isolated per async context (gRPC request) via contextvars,
so concurrent requests never mix their embedding usage.

The get_embedding() function in embeddings.py calls record() on cache misses.
The executor extracts accumulated usage via get_totals() and merges it
into the task's token usage before reporting via gRPC.

For cached retrievers (which persist across requests), use set_current_tracker()
context manager so embed functions can access the current request's tracker
via get_current_tracker().
"""

from __future__ import annotations

import contextvars
import logging
import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Generator

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from typing import Self


@dataclass
class EmbeddingUsageRecord:
    model_name: str
    input_tokens: int
    text_length: int
    timestamp: datetime = field(default_factory=datetime.now)


class EmbeddingUsageTracker:
    """Thread-safe accumulator for embedding usage within a single request."""

    def __init__(self) -> None:
        self._records: list[EmbeddingUsageRecord] = []
        self._lock = threading.Lock()

    def record(self, text: str, model_name: str) -> None:
        """Record an embedding API call. Estimates tokens from text length."""
        # Rough heuristic: ~4 chars per token for English text
        estimated_tokens = max(1, len(text) // 4)
        with self._lock:
            self._records.append(
                EmbeddingUsageRecord(
                    model_name=model_name,
                    input_tokens=estimated_tokens,
                    text_length=len(text),
                )
            )

    def get_totals(self) -> tuple[int, str]:
        """Returns (total_input_tokens, model_name) for all recorded calls."""
        with self._lock:
            if not self._records:
                return 0, ""
            total = sum(r.input_tokens for r in self._records)
            model = self._records[0].model_name
            return total, model

    def reset(self) -> None:
        """Clear accumulated records."""
        with self._lock:
            self._records.clear()

    @property
    def call_count(self) -> int:
        with self._lock:
            return len(self._records)


# Contextvar for current request's embedding tracker.
# Used by cached retrievers to access the per-request tracker.
_current_tracker: contextvars.ContextVar[EmbeddingUsageTracker | None] = (
    contextvars.ContextVar("_current_tracker", default=None)
)


@contextmanager
def set_current_tracker(
    tracker: EmbeddingUsageTracker | None,
) -> Generator[None, None, None]:
    """Set the current embedding tracker for this async context.

    Use this context manager around code that calls cached retrievers,
    so embed functions can access the current request's tracker via
    get_current_tracker().

    Example:
        with set_current_tracker(token_accumulator.get_embedding_tracker()):
            results = retriever(query)  # Query embedding tracked to this request
    """
    token = _current_tracker.set(tracker)
    try:
        yield
    finally:
        _current_tracker.reset(token)


def get_current_tracker() -> EmbeddingUsageTracker | None:
    """Get the current embedding tracker from contextvar.

    Returns None if no tracker is set (e.g., during startup corpus embedding).
    """
    return _current_tracker.get()
