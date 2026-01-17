"""
Token Usage Extraction Utility

Consolidates token usage extraction functionality used across:
- agent_executor.py (extract from RunResult)
- chat_processing_service.py (extract from agent.memory.steps)

Provides consistent token tracking and cost calculation.
"""

import logging
from typing import Optional, Any

from ..grpc.generated import agent_worker_pb2
from .model_provider import TokenUsage, calculate_token_cost

logger = logging.getLogger(__name__)


class TokenUsageExtractor:
    """Utility class for extracting and converting token usage data."""

    @staticmethod
    def extract_from_result(result) -> Optional[agent_worker_pb2.TokenUsage]:
        """
        Extract token usage from agent execution result.

        Used by agent_executor.py for task execution.

        Args:
            result: RunResult object from smolagents agent.run()

        Returns:
            TokenUsage protobuf if token usage data exists, None otherwise
        """
        if not hasattr(result, 'token_usage') or not result.token_usage:
            logger.debug("No token_usage found in result")
            return None

        tu = result.token_usage
        logger.info(f"Extracted token usage: {getattr(tu, 'total_tokens', 0)} tokens, ${getattr(tu, 'cost_usd', 0.0):.6f}")

        return agent_worker_pb2.TokenUsage(
            model_name=getattr(tu, 'model_name', ''),
            input_tokens=getattr(tu, 'input_tokens', 0),
            output_tokens=getattr(tu, 'output_tokens', 0),
            total_tokens=getattr(tu, 'total_tokens', 0),
            cost_usd=getattr(tu, 'cost_usd', 0.0)
        )

    @staticmethod
    def extract_from_agent_memory(agent, default_model_name: str = '') -> Optional[TokenUsage]:
        """
        Extract accumulated token usage from agent's memory steps.

        Used by chat_processing_service.py for streaming chat.

        Args:
            agent: ToolCallingAgent with memory.steps containing token usage
            default_model_name: Default model name to use if not found in steps

        Returns:
            TokenUsage object if data exists, None otherwise
        """
        try:
            # Use agent.memory.steps instead of deprecated agent.logs
            if not hasattr(agent, 'memory') or not agent.memory.steps:
                logger.warning("No memory steps found in agent")
                return None

            logger.info(f"📊 Agent has {len(agent.memory.steps)} memory steps")

            # Import step types from smolagents
            from smolagents.memory import ActionStep, PlanningStep

            # Aggregate token usage from all steps
            total_input = 0
            total_output = 0
            model_name = ""

            for i, step in enumerate(agent.memory.steps):
                # Only ActionStep and PlanningStep have token_usage
                if isinstance(step, (ActionStep, PlanningStep)):
                    if step.token_usage:
                        total_input += step.token_usage.input_tokens
                        total_output += step.token_usage.output_tokens
                        if not model_name:
                            model_name = getattr(step.token_usage, 'model_name', '')
                        logger.info(f"✅ Step {i} ({type(step).__name__}): input={step.token_usage.input_tokens}, output={step.token_usage.output_tokens}")
                    else:
                        logger.info(f"⚠️ Step {i} ({type(step).__name__}) has no token usage")
                else:
                    logger.info(f"ℹ️ Step {i}: {type(step).__name__} (no token tracking)")

            # If step-based extraction found nothing, try agent.monitor
            # This is needed for OpenAIModel (Google/Gemini) which tracks tokens in monitor
            # instead of on individual steps
            if total_input == 0 and total_output == 0:
                if hasattr(agent, 'monitor') and agent.monitor:
                    try:
                        token_counts = agent.monitor.get_total_token_counts()
                        if token_counts:
                            total_input = token_counts.get('input_tokens', 0)
                            total_output = token_counts.get('output_tokens', 0)
                            logger.info(f"📊 Extracted from agent.monitor: input={total_input}, output={total_output}")
                    except Exception as e:
                        logger.warning(f"⚠️ BILLING: Failed to get token counts from monitor: {e}")
                else:
                    logger.warning(f"⚠️ BILLING: No token usage in steps and no monitor available")

            # Try to get model name from agent.model if not found in steps
            # OpenAIModel stores model_id, CustomInferenceModel stores model_name
            if not model_name:
                if hasattr(agent, 'model'):
                    model_name = getattr(agent.model, 'model_id', '') or getattr(agent.model, 'model_name', '')
                    if model_name:
                        logger.info(f"📊 Got model name from agent.model: {model_name}")
                    else:
                        logger.warning(f"⚠️ BILLING: Could not get model name from agent.model (no model_id or model_name)")
                else:
                    logger.warning(f"⚠️ BILLING: Agent has no model attribute, cannot determine model name")

            # Note: 0 tokens is valid (future free models) - only log, don't fail
            if total_input == 0 and total_output == 0:
                logger.info(f"📊 Token usage is zero (may be valid for free models)")

            # Calculate cost using model registry
            cost = calculate_token_cost(model_name or default_model_name, total_input, total_output)

            return TokenUsage(
                input_tokens=total_input,
                output_tokens=total_output,
                total_tokens=total_input + total_output,
                cost_usd=cost,
                model_name=model_name or default_model_name
            )

        except Exception as e:
            logger.error(f"Failed to extract token usage from agent memory: {e}")
            return None

    @staticmethod
    def to_proto(token_usage: Optional[Any]) -> Optional[agent_worker_pb2.TokenUsage]:
        """
        Convert token usage object to protobuf TokenUsage message.

        Args:
            token_usage: TokenUsage object or similar structure

        Returns:
            TokenUsage protobuf message or None
        """
        if not token_usage:
            return None

        return agent_worker_pb2.TokenUsage(
            model_name=getattr(token_usage, 'model_name', ''),
            input_tokens=getattr(token_usage, 'input_tokens', 0),
            output_tokens=getattr(token_usage, 'output_tokens', 0),
            total_tokens=getattr(token_usage, 'total_tokens', 0),
            cost_usd=getattr(token_usage, 'cost_usd', 0.0)
        )
