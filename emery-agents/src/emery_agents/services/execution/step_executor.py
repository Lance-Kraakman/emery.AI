"""
Step Executor

Executes individual plan steps using PlanStepExecutor with DSPy ReAct routing.

Extracted from ExecutionCoordinator for maintainability.
"""

import asyncio
import logging
from typing import Any, List, Optional

from ...entities.models.plan import Plan, PlanStep
from ...reasoning.utils import StepOutcome
from .plan_step_executor import PlanStepExecutor
from ...utils.session_logger import SessionLogger

logger = logging.getLogger(__name__)


class StepExecutor:
    """
    Executes individual plan steps.

    Uses PlanStepExecutor for DSPy ReAct-based routing, or falls back
    to direct tool execution if no executor is configured.
    """

    def __init__(
        self,
        plan_step_executor: Optional[PlanStepExecutor] = None,
        session_logger: Optional[SessionLogger] = None,
    ):
        self.plan_step_executor = plan_step_executor
        self.session_logger = session_logger

    async def execute_step(
        self,
        current_plan: Plan,
        step: PlanStep,
        tools: List[Any],
        managed_agents: Optional[List[Any]] = None,
    ) -> StepOutcome:
        """Execute a single plan step, returning structured outcome."""
        logger.info(f"Executing step {step.step_id}: {step.description[:100]}...")

        # Use PlanStepExecutor - pass Plan object, executor generates prompt from it
        # Wrap in asyncio.to_thread since execute() is synchronous (calls blocking LLM APIs)
        if self.plan_step_executor and current_plan:
            outcome = await asyncio.to_thread(
                self.plan_step_executor.execute,
                plan=current_plan,
                current_step=step,
            )
            return outcome

        # Fallback: If there's a tool_call specified, use it directly
        if step.tool_call:
            result_str = await self._execute_tool_directly(step, tools)
            return StepOutcome(summary=result_str, success=True, tool_calls=[])

        # No executor and no tool_call - just mark as done
        logger.warning("No plan_step_executor configured, step not actually executed")
        return StepOutcome(
            summary=f"Step completed (no executor): {step.description}",
            success=True,
            tool_calls=[],
        )

    async def _execute_tool_directly(
        self,
        step: PlanStep,
        tools: List[Any],
    ) -> str:
        """Execute a tool directly (fallback when no PlanStepExecutor configured)."""
        tool = None
        # Extract base tool name (before ':' if present, e.g., "tool:action" -> "tool")
        tool_call_parts = step.tool_call.lower().split(':') if step.tool_call else []
        target_tool_name = tool_call_parts[0] if tool_call_parts else (step.tool_call or "").lower()

        for t in tools:
            tool_name = getattr(t, 'name', str(t))
            if tool_name.lower() == target_tool_name:
                tool = t
                break

        if not tool:
            raise ValueError(f"Tool not found: {step.tool_call}")

        logger.info(f"Executing tool {step.tool_call} with params: {step.parameters}")
        try:
            # Wrap blocking tool call in thread
            result = await asyncio.to_thread(tool.forward, **(step.parameters or {}))
            return f"Executed {step.tool_call}: {result}"
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            raise
