"""
LLM Usage Tracker — Accumulates LLM API token usage for billing.

The tracker records prompt_tokens and completion_tokens from dspy.LM.history
after each dspy.context() block completes. Usage is isolated per async context
(gRPC request) via contextvars, so concurrent requests never mix their LLM usage.

The orchestrator nodes call record_from_lm(lm) after each dspy.context() block.
The chat_processing_service extracts accumulated usage via get_llm_usage() and
merges it into the request's token usage before reporting via gRPC.
"""

import contextvars
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class LlmUsageRecord:
    model_name: str
    input_tokens: int
    output_tokens: int
    timestamp: datetime = field(default_factory=datetime.now)


class LlmUsageTracker:
    """Thread-safe accumulator for LLM usage within a single request.

    Each gRPC request gets its own tracker instance via contextvars.
    The threading.Lock is needed because DSPy may execute LM calls
    from different threads (e.g. asyncio.to_thread).
    """

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
        """Returns (total_input_tokens, total_output_tokens, model_name)."""
        with self._lock:
            if not self._records:
                return 0, 0, ""
            total_input = sum(r.input_tokens for r in self._records)
            total_output = sum(r.output_tokens for r in self._records)
            model = self._records[0].model_name
            return total_input, total_output, model

    def reset(self) -> None:
        """Clear accumulated records."""
        with self._lock:
            self._records.clear()

    @property
    def call_count(self) -> int:
        with self._lock:
            return len(self._records)


# Per-request tracker via contextvars — each async context gets its own instance.
_tracker_var: contextvars.ContextVar[LlmUsageTracker] = contextvars.ContextVar(
    'llm_tracker'
)


def get_llm_tracker() -> LlmUsageTracker:
    """Get the LLM usage tracker for the current request context.

    Creates a new tracker on first access within each async context,
    so each gRPC RPC handler accumulates its own usage independently.
    """
    try:
        return _tracker_var.get()
    except LookupError:
        tracker = LlmUsageTracker()
        _tracker_var.set(tracker)
        return tracker


def get_llm_usage() -> tuple[int, int, str]:
    """Get accumulated LLM usage (input_tokens, output_tokens, model_name) for this request."""
    return get_llm_tracker().get_totals()


def reset_llm_usage() -> None:
    """Reset accumulated LLM usage for this request."""
    get_llm_tracker().reset()


def record_from_lm(lm: object) -> None:
    """Extract token usage from dspy.LM.history and record it.

    Call this AFTER each `with dspy.context(lm=lm):` block completes.
    Reads the lm.history list and accumulates usage from all entries,
    then clears history to prevent double-counting on subsequent calls.

    dspy.LM.history format (dspy >= 2.5):
        [{"prompt": ..., "response": ..., "kwargs": {...},
          "usage": {"prompt_tokens": int, "completion_tokens": int}}, ...]
    """
    history = getattr(lm, 'history', None)
    if not history:
        return

    tracker = get_llm_tracker()

    # Extract model name from lm.model (e.g., "huggingface/Qwen/..." or "openai/gemini-...")
    model_name = getattr(lm, 'model', '') or ''
    # Strip provider prefix for registry lookup
    if '/' in model_name:
        parts = model_name.split('/', 1)
        if parts[0] in ('huggingface', 'openai'):
            model_name = parts[1]

    total_input = 0
    total_output = 0

    for entry in history:
        usage = entry.get('usage') if isinstance(entry, dict) else None
        if usage:
            total_input += usage.get('prompt_tokens', 0) or 0
            total_output += usage.get('completion_tokens', 0) or 0

    if total_input == 0 and total_output == 0 and history:
        # Diagnostic logging for missing usage
        logger.warning(f"⚠️ No token usage found for model {model_name}. Inspecting history entry...")
        try:
            first_entry = history[0]
            logger.info(f"Entry keys: {list(first_entry.keys())}")
            
            # Inspect 'usage' field
            usage_data = first_entry.get('usage')
            logger.info(f"Usage field: {usage_data} (type: {type(usage_data)})")
            
            # Inspect raw response if available
            response = first_entry.get('response')
            if response:
                logger.info(f"Response object type: {type(response)}")
                # Try to dump response to see structure
                if hasattr(response, 'model_dump'):
                    logger.info(f"Response dump: {response.model_dump()}")
                elif hasattr(response, '__dict__'):
                    logger.info(f"Response dict: {response.__dict__}")
                else:
                    logger.info(f"Response dir: {dir(response)}")
                    
        except Exception as e:
            logger.error(f"Failed to inspect history entry: {e}")

    if total_input > 0 or total_output > 0:
        tracker.record(model_name, total_input, total_output)
        logger.info(
            f"Recorded LLM usage: {total_input} input + {total_output} output tokens, "
            f"model={model_name}"
        )

    # Clear history after extraction to prevent double-counting
    history.clear()
