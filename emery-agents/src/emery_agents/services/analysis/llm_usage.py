"""
LLM Usage Tracking Service

This module provides a thread-safe tracker for accumulating LLM token usage
and a function to extract usage data from DSPy's Language Model history.
"""
from __future__ import annotations
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import dspy

logger = logging.getLogger(__name__)


@dataclass
class LlmUsageRecord:
    """Represents a single record of LLM token usage."""
    model_name: str
    input_tokens: int
    output_tokens: int
    timestamp: datetime = field(default_factory=datetime.now)


class LlmUsageTracker:
    """Thread-safe accumulator for LLM token usage within a single request."""

    def __init__(self) -> None:
        self._records: list[LlmUsageRecord] = []
        self._lock = threading.Lock()

    def record(self, model_name: str, input_tokens: int, output_tokens: int) -> None:
        """Record an LLM call's token usage."""
        with self._lock:
            self._records.append(
                LlmUsageRecord(
                    model_name=model_name,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            )

    def get_totals(self) -> tuple[int, int, str]:
        """Return (total_input_tokens, total_output_tokens, model_name)."""
        with self._lock:
            if not self._records:
                return 0, 0, ""
            total_input = sum(r.input_tokens for r in self._records)
            total_output = sum(r.output_tokens for r in self._records)
            # Assume all calls in a request use the same primary model
            model = self._records[0].model_name
            return total_input, total_output, model

    def reset(self) -> None:
        """Clear all accumulated records."""
        with self._lock:
            self._records.clear()


def record_from_lm(lm: "dspy.LM", tracker: LlmUsageTracker) -> None:
    """
    Extract token usage from dspy.LM.history and record it.

    This function should be called after a `dspy.context` block completes.
    It reads `lm.history`, accumulates usage, records it to the provided
    tracker, and then clears the history to prevent double-counting.
    """
    history = getattr(lm, "history", None)
    if not history:
        return

    model_name = getattr(lm, "model", "") or ""
    # Strip provider prefix (e.g., "openai/gpt-4o-mini" -> "gpt-4o-mini")
    if "/" in model_name:
        parts = model_name.split("/", 1)
        if len(parts) > 1 and parts[0] in ("huggingface", "openai", "gemini"):
            model_name = parts[1]

    total_input = 0
    total_output = 0

    for entry in history:
        usage = entry.get("usage") if isinstance(entry, dict) else None
        if usage:
            total_input += usage.get("prompt_tokens", 0) or 0
            total_output += usage.get("completion_tokens", 0) or 0

    if total_input > 0 or total_output > 0:
        tracker.record(model_name, total_input, total_output)
        logger.info(
            f"Recorded LLM usage: {total_input} input + {total_output} output tokens, model={model_name}"
        )

    # Clear history after processing to avoid double-counting in subsequent calls
    history.clear()
