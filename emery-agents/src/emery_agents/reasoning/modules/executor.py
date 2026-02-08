"""
DSPy Executor Module.

This module handles step execution using DSPy's ReAct strategy.
It replaces smolagents ToolCallingAgent.
"""

from __future__ import annotations

from typing import Any

import dspy
from dspy.adapters.types.image import Image as DspyImage
from dspy.primitives.prediction import Prediction


class ExecutorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for executing plan steps using ReAct.

    This module uses the ReAct (Reasoning + Acting) pattern to execute
    steps, calling tools as needed and reasoning about results.
    """

    def __init__(
        self,
        execution_tools: list[Any] | None = None,
        max_iters: int = 10,
    ) -> None:
        """
        Initialize the executor module.

        Args:
            execution_tools: List of tools available for execution
            max_iters: Maximum iterations for ReAct loop
        """
        super().__init__()
        self.execution_tools = execution_tools or []
        self.max_iters = max_iters
        self.last_trajectory: dict[str, Any] | None = None

        # Create ReAct module with tools
        self.react = dspy.ReAct(
            "step_description, context -> result",
            tools=self.execution_tools,
            max_iters=max_iters,
        )

    def forward(self, step_description: str, context: str) -> str:
        """
        Execute a single plan step.

        Args:
            step_description: Description of what the step should accomplish
            context: JSON string of execution context (previous results, workspace state)

        Returns:
            Result string from step execution
        """
        result = self.react(
            step_description=step_description,
            context=context,
        )
        self.last_trajectory = getattr(result, "trajectory", None)
        return result.result  # type: ignore[no-any-return]


def _format_trajectory_evidence(trajectory: dict[str, Any]) -> str:
    """Extract tool call evidence from a ReAct trajectory for the judge."""
    evidence_parts: list[str] = []
    idx = 0
    while f"tool_name_{idx}" in trajectory:
        name = trajectory[f"tool_name_{idx}"]
        obs = str(trajectory.get(f"observation_{idx}", ""))[:200]
        evidence_parts.append(f"{name}: {obs}")
        idx += 1
    return "\n".join(evidence_parts) if evidence_parts else ""


def direct_execution_reward(kwargs: dict[str, Any], pred: Prediction) -> float:
    """LLM-as-judge reward function for DIRECT execution quality.

    Uses a small dspy.ChainOfThought(JudgeDirectExecution) to score
    whether the result actually addresses the task. Fast-paths obvious
    failures (empty result, all tool errors) to avoid unnecessary LLM calls.
    """
    from ..signatures.evaluation import JudgeDirectExecution

    result_text = str(getattr(pred, "result", ""))
    trajectory: dict[str, Any] = getattr(pred, "trajectory", None) or {}
    task = kwargs.get("step_description", "")

    # Fast-path: empty result is always bad
    if not result_text.strip():
        return 0.0

    # Fast-path: all tool calls failed
    tool_count = 0
    tool_failures = 0
    idx = 0
    while f"tool_name_{idx}" in trajectory:
        tool_count += 1
        obs = str(trajectory.get(f"observation_{idx}", ""))
        if obs.startswith(("ERROR:", "Execution error", "BLOCKED:")):
            tool_failures += 1
        idx += 1
    if tool_count > 0 and tool_failures == tool_count:
        return 0.0

    # LLM judge
    tool_evidence = _format_trajectory_evidence(trajectory)
    judge = dspy.ChainOfThought(JudgeDirectExecution)
    judgement_result = judge(
        task=task,
        result=result_text[:1000],
        tool_evidence=tool_evidence[:500],
    )
    return float(judgement_result.judgement.score)


class DirectExecution(dspy.Signature):  # type: ignore[misc]
    """Execute the user's task using the provided tools.

    After a tool call succeeds and the task is addressed, call finish().
    Do not continue with additional operations after the task is complete.
    If you need to discover a resource first (e.g., find an ID before acting),
    that discovery step is fine — discovery + action + finish is normal.
    If the user has uploaded images, analyze them visually to answer the query.
    """

    step_description: str = dspy.InputField(desc="The user's task to execute.")
    context: str = dspy.InputField(desc="Workspace state and conversation history.")
    images: list[DspyImage] = dspy.InputField(
        desc="User-uploaded images for visual analysis.",
        default=[],
    )
    result: str = dspy.OutputField(desc="What was accomplished and the outcome.")


class DirectExecutorModule(dspy.Module):  # type: ignore[misc]
    """Executor for DIRECT mode that returns raw Prediction.

    Unlike ExecutorModule (which returns a string), this returns the full
    Prediction object from ReAct. Required for dspy.Refine compatibility
    since Refine calls dict(outputs) on the return value.

    Uses DirectExecution signature which provides ReAct with completion
    instructions via its docstring (DSPy prepends signature.instructions
    before the agent loop prompt).
    """

    def __init__(
        self,
        execution_tools: list[Any] | None = None,
        max_iters: int = 10,
    ) -> None:
        super().__init__()
        self.execution_tools = execution_tools or []
        self.max_iters = max_iters

        self.react = dspy.ReAct(
            DirectExecution,
            tools=self.execution_tools,
            max_iters=max_iters,
        )

    def forward(
        self, step_description: str, context: str, images: list[DspyImage] | None = None
    ) -> Prediction:
        """Execute and return full Prediction (required for dspy.Refine)."""
        return self.react(  # type: ignore[no-any-return]
            step_description=step_description,
            context=context,
            images=images or [],
        )


class SimpleExecutorModule(dspy.Module):  # type: ignore[misc]
    """
    Simple executor for steps that don't need agentic tool use.

    Use this for straightforward operations that can be done in a single
    LLM call without iterative tool use.
    """

    def __init__(self) -> None:
        """Initialize the simple executor module."""
        super().__init__()
        self.executor = dspy.ChainOfThought("step_description, context -> result")

    def forward(self, step_description: str, context: str) -> str:
        """
        Execute a simple step without tool use.

        Args:
            step_description: Description of what the step should accomplish
            context: JSON string of execution context

        Returns:
            Result string from step execution
        """
        result = self.executor(
            step_description=step_description,
            context=context,
        )
        return result.result  # type: ignore[no-any-return]


class DelegatingExecutorModule(dspy.Module):  # type: ignore[misc]
    """
    Executor that can delegate to specialized agent modules.

    Use this when steps specify a target_agent - it routes execution
    to the appropriate specialized module.
    """

    def __init__(
        self,
        agent_modules: dict[str, dspy.Module] | None = None,
        default_executor: ExecutorModule | None = None,
    ) -> None:
        """
        Initialize the delegating executor.

        Args:
            agent_modules: Mapping of agent name to DSPy module
            default_executor: Fallback executor for unspecified agents
        """
        super().__init__()
        self.agent_modules = agent_modules or {}
        self.default_executor = default_executor or SimpleExecutorModule()

    def forward(
        self,
        step_description: str,
        context: str,
        target_agent: str | None = None,
    ) -> str:
        """
        Execute a step, delegating to specialized agents if specified.

        Args:
            step_description: Description of what the step should accomplish
            context: JSON string of execution context
            target_agent: Optional name of specialized agent to use

        Returns:
            Result string from step execution
        """
        if target_agent and target_agent in self.agent_modules:
            agent_module = self.agent_modules[target_agent]
            # Call the agent module - assumes it accepts step_description and context
            return agent_module(  # type: ignore[no-any-return]
                step_description=step_description,
                context=context,
            )

        # Fall back to default executor
        return self.default_executor(  # type: ignore[no-any-return]
            step_description=step_description,
            context=context,
        )
