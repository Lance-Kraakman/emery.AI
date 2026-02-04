"""
Token Usage Extraction Utility

Consolidates token usage extraction functionality.
Supports DSPy TrackedStep types for token tracking.

Provides consistent token tracking and cost calculation.
"""

import logging
from typing import Any, Optional

from ...reasoning.modules.step_tracker import TrackedStep, TokenUsage as DSPyTokenUsage
from ..models.provider import TokenUsage
from ..models.registry import calculate_token_cost
from .embedding_usage import get_embedding_usage
from .llm_usage import get_llm_usage

logger = logging.getLogger(__name__)


class TokenUsageExtractor:
    """Utility class for extracting and converting token usage data."""

    @staticmethod
    def extract_from_result(result: Any) -> Optional[TokenUsage]:
        """
        Extract token usage from agent execution result.

        Used by agent_executor.py for task execution.

        Args:
            result: Result object from DSPy module or legacy agent

        Returns:
            TokenUsage entity if token usage data exists, None otherwise
        """
        if not hasattr(result, 'token_usage') or not result.token_usage:
            logger.debug("No token_usage found in result")
            return None

        tu = result.token_usage
        logger.info(f"Extracted token usage: {getattr(tu, 'total_tokens', 0)} tokens, ${getattr(tu, 'cost_usd', 0.0):.6f}")

        return TokenUsage(
            model_name=getattr(tu, 'model_name', ''),
            input_tokens=getattr(tu, 'input_tokens', 0),
            output_tokens=getattr(tu, 'output_tokens', 0),
            total_tokens=getattr(tu, 'total_tokens', 0),
            cost_usd=getattr(tu, 'cost_usd', 0.0),
        )

    @staticmethod
    def extract_from_tracked_steps(
        steps: list[TrackedStep],
        default_model_name: str = ''
    ) -> Optional[TokenUsage]:
        """
        Extract accumulated token usage from DSPy TrackedStep list.

        Args:
            steps: List of TrackedStep from StepTracker
            default_model_name: Default model name to use if not found

        Returns:
            TokenUsage object if data exists, None otherwise
        """
        try:
            if not steps:
                logger.warning("No steps provided for token extraction")
                return None

            logger.info(f"📊 Extracting tokens from {len(steps)} tracked steps")

            # Aggregate token usage from all steps
            total_input = 0
            total_output = 0
            model_name = ""

            for i, step in enumerate(steps):
                if step.token_usage:
                    total_input += step.token_usage.input_tokens
                    total_output += step.token_usage.output_tokens
                    if not model_name:
                        model_name = step.token_usage.model_name or ""
                    logger.info(
                        f"✅ Step {i} ({step.step_type.value}): "
                        f"input={step.token_usage.input_tokens}, "
                        f"output={step.token_usage.output_tokens}"
                    )
                else:
                    logger.info(f"ℹ️ Step {i}: {step.step_type.value} (no token tracking)")

            if total_input == 0 and total_output == 0:
                logger.info(f"📊 Token usage is zero (may be valid for free models)")

            # Calculate cost using model registry
            cost = calculate_token_cost(
                model_name or default_model_name,
                total_input,
                total_output
            )

            return TokenUsage(
                input_tokens=total_input,
                output_tokens=total_output,
                total_tokens=total_input + total_output,
                cost_usd=cost,
                model_name=model_name or default_model_name
            )

        except Exception as e:
            logger.error(f"Failed to extract token usage from tracked steps: {e}")
            return None

    @staticmethod
    def extract_embedding_usage() -> Optional[TokenUsage]:
        """
        Extract accumulated embedding usage for the current request.

        Returns a TokenUsage object representing all embedding API calls
        made during this request. The tracker is scoped per async context
        via contextvars, so no explicit reset is needed.

        Returns:
            TokenUsage if any embedding calls were made, None otherwise
        """
        total_tokens, model_name = get_embedding_usage()
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
    def extract_llm_usage() -> Optional[TokenUsage]:
        """
        Extract accumulated LLM usage for the current request.

        Returns a TokenUsage object representing all LLM API calls
        made during this request. The tracker is scoped per async context
        via contextvars.

        Returns:
            TokenUsage if any LLM calls were made, None otherwise
        """
        input_tokens, output_tokens, model_name = get_llm_usage()
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

    @staticmethod
    def merge_usage(
        base: Optional[TokenUsage],
        additional: Optional[TokenUsage],
    ) -> Optional[TokenUsage]:
        """
        Merge two TokenUsage objects by summing their values.

        Used to combine LLM token usage with embedding token usage
        into a single record before reporting via gRPC.
        """
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

    @staticmethod
    def extract_from_agent_memory(
        agent: Any,
        default_model_name: str = ''
    ) -> Optional[TokenUsage]:
        """
        Extract accumulated token usage from agent's memory.

        Supports both DSPy StepTracker and ChatAgent with TrackedSteps.

        Args:
            agent: Agent with memory/steps containing token usage
            default_model_name: Default model name to use if not found in steps

        Returns:
            TokenUsage object if data exists, None otherwise
        """
        try:
            # Check for DSPy-style tracked steps
            if hasattr(agent, 'step_tracker') and agent.step_tracker:
                steps = agent.step_tracker.steps
                return TokenUsageExtractor.extract_from_tracked_steps(
                    steps, default_model_name
                )

            # Check for ChatAgent with memory.steps (TrackedStep list)
            if hasattr(agent, 'memory') and hasattr(agent.memory, 'steps'):
                steps = agent.memory.steps
                if steps and isinstance(steps[0], TrackedStep):
                    return TokenUsageExtractor.extract_from_tracked_steps(
                        steps, default_model_name
                    )

            logger.warning("No compatible memory structure found in agent")
            return None

        except Exception as e:
            logger.error(f"Failed to extract token usage from agent memory: {e}")
            return None

