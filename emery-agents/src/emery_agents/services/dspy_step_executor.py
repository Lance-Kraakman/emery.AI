"""
DSPy Step Executor

DSPy-based step execution for inline steps. This module provides an alternative
to the smolagents-based step execution using DSPy's ReAct pattern.

AIDEV-NOTE: This is the DSPy-based replacement for inline step execution.
It uses dspy.ReAct instead of smolagents ToolCallingAgent.

Benefits:
- Typed outputs via Pydantic
- Automatic prompt optimization with DSPy optimizers
- ChainOfThought reasoning built-in
- Cleaner tool integration
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, Optional

from emery_agents.dspy_modules.config import configure_dspy
from emery_agents.dspy_modules.modules.executor import ExecutorModule

if TYPE_CHECKING:
    from emery_agents.services.tool_loader import UnifiedToolLoader

logger = logging.getLogger(__name__)


class DSPyStepExecutor:
    """
    Execute inline steps using DSPy ReAct pattern.

    This class provides an alternative to the AgentFactory-based step execution,
    using DSPy's ReAct module for agentic tool use.

    Usage:
        executor = DSPyStepExecutor(tool_loader=tool_loader)
        result = await executor.execute_inline_step(
            instruction="Create a table for customers",
            step_inputs={"table_name": "customers"},
            step_context={"workspace": {...}},
            tools=["table_crud", "field_crud"],
            org_model="google/gemini-2.0-flash",
        )
    """

    def __init__(
        self,
        tool_loader: Optional[UnifiedToolLoader] = None,
    ) -> None:
        """
        Initialize DSPy step executor.

        Args:
            tool_loader: Tool loader for getting tools by name
        """
        self.tool_loader = tool_loader
        self._executor_cache: dict[str, ExecutorModule] = {}

    def _get_executor(
        self,
        tools: list[Any],
        org_model: Optional[str] = None,
        max_iters: int = 10,
    ) -> ExecutorModule:
        """
        Get or create an executor module with the specified tools.

        Args:
            tools: List of tools for the executor
            org_model: Model to use for execution
            max_iters: Maximum ReAct iterations

        Returns:
            Configured ExecutorModule
        """
        # Configure DSPy with the appropriate model
        configure_dspy(org_model=org_model)

        # Create executor with tools
        return ExecutorModule(
            execution_tools=tools,
            max_iters=max_iters,
        )

    async def execute_inline_step(
        self,
        instruction: str,
        step_inputs: dict[str, Any],
        step_context: dict[str, Any],
        tools: list[str],
        org_model: Optional[str] = None,
        step_name: str = "inline_step",
        output_defs: Optional[list[dict[str, str]]] = None,
    ) -> Any:
        """
        Execute an inline step using DSPy ReAct.

        Args:
            instruction: Step instruction/description
            step_inputs: Resolved input values for the step
            step_context: Full execution context (previous results, workspace state)
            tools: List of tool names to load
            org_model: Model to use for execution
            step_name: Name of the step for logging
            output_defs: Expected output definitions (for structured output)

        Returns:
            Step execution result (dict if output_defs, else string)
        """
        logger.info(f"📋 DSPy executing inline step: {step_name}")
        logger.info(f"📝 Instruction: {instruction[:100]}...")

        # Load tools
        step_tools: list[Any] = []
        if tools and self.tool_loader:
            try:
                from emery_agents.grpc.generated.agent_worker_pb2 import ToolConfig
                tool_configs = [ToolConfig(name=name) for name in tools]
                step_tools = self.tool_loader.load_tools_from_configs(
                    tool_configs=tool_configs,
                    api_key=None,
                    api_key_mode="user"
                )
                logger.info(f"🔧 Loaded {len(step_tools)} tools for DSPy step")
            except Exception as e:
                logger.warning(f"Failed to load some step tools: {e}")

        # Build task description
        task_parts = [instruction]
        if step_inputs:
            task_parts.append("\n\nInputs:")
            for key, value in step_inputs.items():
                task_parts.append(f"- {key}: {value}")

        # Add output instructions if we have output definitions
        if output_defs:
            task_parts.append("\n\nExpected Outputs:")
            for output in output_defs:
                task_parts.append(f"- {output['name']}: {output.get('type', 'text')}")
            task_parts.append(
                "\nAfter completing the task, provide the values for these outputs."
            )

        task = "\n".join(task_parts)

        # Prepare context as JSON
        context_str = json.dumps(step_context, indent=2, default=str)

        # Get executor with tools
        executor = self._get_executor(
            tools=step_tools,
            org_model=org_model,
            max_iters=10,
        )

        # Execute using DSPy ReAct
        try:
            result = executor(
                step_description=task,
                context=context_str,
            )
            logger.info(f"✅ DSPy step {step_name} completed")

            # If we have output_defs, try to parse structured output
            if output_defs:
                return self._parse_structured_output(result, output_defs)

            return result

        except Exception as e:
            logger.error(f"❌ DSPy step {step_name} failed: {e}")
            raise

    def _parse_structured_output(
        self,
        result: Any,
        output_defs: list[dict[str, str]],
    ) -> dict[str, Any]:
        """
        Parse structured output from DSPy result.

        If the result is already a dict, return it.
        If it's a string, try to extract the expected outputs.

        Args:
            result: Raw result from DSPy
            output_defs: Expected output definitions

        Returns:
            Dict of output name -> value
        """
        # If already a dict, return as-is
        if isinstance(result, dict):
            return result

        # Try to parse as JSON
        try:
            parsed = json.loads(str(result))
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

        # Fall back to returning the result as a single value
        # Use the first output name as the key
        if output_defs:
            first_output = output_defs[0]["name"]
            return {first_output: str(result)}

        return {"result": str(result)}


def create_dspy_step_executor(
    tool_loader: Optional[UnifiedToolLoader] = None,
) -> DSPyStepExecutor:
    """
    Factory function to create a DSPy step executor.

    Args:
        tool_loader: Tool loader for getting tools

    Returns:
        Configured DSPyStepExecutor
    """
    return DSPyStepExecutor(tool_loader=tool_loader)
