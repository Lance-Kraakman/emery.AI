"""
Embedding Usage Tracker — Accumulates embedding API usage for billing.

The tracker records estimated token counts for each embedding call.
Usage is isolated per async context (gRPC request) via contextvars,
so concurrent requests never mix their embedding usage.

The get_embedding() function in embeddings.py calls record() on cache misses.
The executor extracts accumulated usage via get_totals() and merges it
into the task's token usage before reporting via gRPC.
"""

import contextvars
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingUsageRecord:
    model_name: str
    input_tokens: int
    text_length: int
    timestamp: datetime = field(default_factory=datetime.now)


class EmbeddingUsageTracker:
    """Thread-safe accumulator for embedding usage within a single request.

    Each gRPC request gets its own tracker instance via contextvars.
    The threading.Lock is still needed because the @lru_cache in
    embeddings.py is shared across contexts and may call record()
    from different threads.
    """

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


# Per-request tracker via contextvars — each async context gets its own instance.
# This prevents concurrent gRPC requests from mixing embedding usage.
_tracker_var: contextvars.ContextVar[EmbeddingUsageTracker] = contextvars.ContextVar(
    'embedding_tracker'
)


def get_embedding_tracker() -> EmbeddingUsageTracker:
    """Get the embedding usage tracker for the current request context.

    Creates a new tracker on first access within each async context,
    so each gRPC RPC handler accumulates its own usage independently.
    """
    try:
        return _tracker_var.get()
    except LookupError:
        tracker = EmbeddingUsageTracker()
        _tracker_var.set(tracker)
        return tracker


def get_embedding_usage() -> tuple[int, str]:
    """Get accumulated embedding usage (total_tokens, model_name) for this request."""
    return get_embedding_tracker().get_totals()


def reset_embedding_usage() -> None:
    """Reset accumulated embedding usage for this request."""
    get_embedding_tracker().reset()
