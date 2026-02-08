"""
Token Accumulator - Centralized request-scoped usage tracking.

A single instance of this class is created per gRPC request and passed through
the execution pipeline (orchestrator, nodes, services). It replaces the
previous contextvars-based approach, which was less reliable across different
async/threading contexts created by DSPy.

- Explicitly passed, so no reliance on contextvars propagation.
- Holds instances of LlmUsageTracker and EmbeddingUsageTracker.
- Provides a single point for extracting and merging usage data.
"""

from __future__ import annotations

import logging

from ..models.provider import TokenUsage
from ..models.registry import calculate_token_cost
from .embedding_usage import EmbeddingUsageTracker
from .llm_usage import LlmUsageTracker

logger = logging.getLogger(__name__)


class TokenAccumulator:
    """Centralized, request-scoped token usage accumulator."""

    def __init__(self) -> None:
        """Initialize trackers for a new request."""
        self.llm_tracker = LlmUsageTracker()
        self.embedding_tracker = EmbeddingUsageTracker()
        logger.debug("TokenAccumulator created for new request")

    def get_llm_tracker(self) -> LlmUsageTracker:
        """Get the LLM usage tracker for the current request."""
        return self.llm_tracker

    def get_embedding_tracker(self) -> EmbeddingUsageTracker:
        """Get the embedding usage tracker for the current request."""
        return self.embedding_tracker

    def extract_llm_usage(self) -> TokenUsage | None:
        """Extract accumulated LLM usage for the current request."""
        input_tokens, output_tokens, model_name = self.llm_tracker.get_totals()
        if input_tokens == 0 and output_tokens == 0:
            return None

        cost = calculate_token_cost(model_name, input_tokens, output_tokens)
        logger.info(
            f"Extracted LLM usage: {input_tokens} input + {output_tokens} output tokens, "
            f"model={model_name}, cost=${cost:.6f}"
        )
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=cost,
            model_name=model_name,
        )

    def extract_embedding_usage(self) -> TokenUsage | None:
        """Extract accumulated embedding usage for the current request."""
        total_tokens, model_name = self.embedding_tracker.get_totals()
        if total_tokens == 0:
            return None

        cost = calculate_token_cost(model_name, total_tokens, 0)
        logger.info(
            f"Extracted embedding usage: {total_tokens} tokens, "
            f"model={model_name}, cost=${cost:.6f}"
        )
        return TokenUsage(
            input_tokens=total_tokens,
            output_tokens=0,
            total_tokens=total_tokens,
            cost_usd=cost,
            model_name=model_name,
        )

    @staticmethod
    def merge_usage(
        base: TokenUsage | None,
        additional: TokenUsage | None,
    ) -> TokenUsage | None:
        """Merge two TokenUsage objects by summing their values."""
        if base is None:
            return additional
        if additional is None:
            return base

        return TokenUsage(
            input_tokens=base.input_tokens + additional.input_tokens,
            output_tokens=base.output_tokens + additional.output_tokens,
            total_tokens=base.total_tokens + additional.total_tokens,
            cost_usd=base.cost_usd + additional.cost_usd,
            model_name=base.model_name,  # Keep the primary model name
        )
