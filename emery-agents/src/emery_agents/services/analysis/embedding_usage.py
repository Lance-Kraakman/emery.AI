"""
Embedding Usage Tracker — Accumulates embedding API usage for billing.

The tracker records estimated token counts for each embedding call.
Usage is accumulated per execution and should be reset between tasks.

The get_embedding() function in embeddings.py calls record() on cache misses.
The executor extracts accumulated usage via get_totals() and merges it
into the task's token usage before reporting via gRPC.
"""

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
    """Thread-safe accumulator for embedding usage within a single execution."""

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
        """Clear accumulated records. Call between task executions."""
        with self._lock:
            self._records.clear()

    @property
    def call_count(self) -> int:
        with self._lock:
            return len(self._records)


# Module-level singleton — shared across the process
_tracker = EmbeddingUsageTracker()


def get_embedding_tracker() -> EmbeddingUsageTracker:
    """Get the global embedding usage tracker instance."""
    return _tracker


def get_embedding_usage() -> tuple[int, str]:
    """Get accumulated embedding usage (total_tokens, model_name)."""
    return _tracker.get_totals()


def reset_embedding_usage() -> None:
    """Reset accumulated embedding usage. Call between task executions."""
    _tracker.reset()
