"""
DSPy Executor Module.

This module handles step execution using DSPy's ReAct strategy.
It replaces smolagents ToolCallingAgent.

Uses KNNFewShot with TOOL_EXAMPLES to teach tool selection:
- TOOL_EXAMPLES teach which tool to use for each type of task
- ReAct handles the actual execution with tools from runtime
"""

from __future__ import annotations

import logging
from typing import Any

from ..signatures.evaluation import JudgeDirectExecution

import dspy
from dspy import KNNFewShot
from dspy.adapters.types.image import Image as DspyImage
from dspy.primitives.prediction import Prediction

from emery_agents.reasoning.examples.tools import TOOL_EXAMPLES
from emery_agents.services.analysis.embeddings import create_dspy_embedder

from ...services.context import clear_human_skill_awaiting, get_human_skill_awaiting

logger = logging.getLogger(__name__)

# Cache only the embedder (expensive FAISS index creation)
# ReAct must be created fresh with actual tools to set Literal constraint
_CACHED_EMBEDDER: Any = None


def _get_embedder() -> Any:
    """Get cached embedder for KNNFewShot (avoids re-creating FAISS index)."""
    global _CACHED_EMBEDDER
    if _CACHED_EMBEDDER is None:
        _CACHED_EMBEDDER = create_dspy_embedder()
        logger.info("Created and cached DSPy embedder for KNNFewShot")
    return _CACHED_EMBEDDER


def _check_and_raise_human_skill() -> None:
    """Check for pending human skill signal and raise if present.

    DSPy ReAct catches tool exceptions internally, so skill tools signal
    via context variable instead. This function checks after ReAct completes
    and re-raises the stored exception.
    """
    exception = get_human_skill_awaiting()
    if exception:
        clear_human_skill_awaiting()  # Clear before raising
        raise exception


class ExecutorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for executing plan steps using ReAct.

    This module uses the ReAct (Reasoning + Acting) pattern to execute
    steps, calling tools as needed and reasoning about results.

    Uses KNNFewShot with TOOL_EXAMPLES to teach tool selection:
    - At each forward() call, KNN finds similar examples from TOOL_EXAMPLES
    - Examples teach: "create table" -> table_crud, "send email" -> gmail_send_email
    - ReAct then executes with the actual tools from runtime
    """

    def __init__(
        self,
        execution_tools: list[Any] | None = None,
        max_iters: int = 10,
    ) -> None:
        """
        Initialize the executor module.

        Args:
            execution_tools: List of dspy.Tool instances from runtime.tools
                           (table_crud, field_crud, gmail_send_email, etc.)
            max_iters: Maximum iterations for ReAct loop
        """
        super().__init__()
        self.execution_tools = execution_tools or []
        self.max_iters = max_iters
        self.last_trajectory: dict[str, Any] | None = None

        # Build tools list with finish tool BEFORE creating ReAct
        # DSPy ReAct bakes Literal[tool_names] into the signature at init,
        # so we MUST pass all tools at creation time - cannot add later!
        all_tools = list(self.execution_tools)
        all_tools.append(
            dspy.Tool(
                func=lambda: "Completed.",
                name="finish",
                desc="Marks the task as complete.",
                args={},
            )
        )

        # Create ReAct with actual tools - Literal constraint includes all tool names
        base_react = dspy.ReAct(
            "step_description, context -> result",  # type: ignore[arg-type]
            tools=all_tools,
            max_iters=max_iters,
        )

        # Apply KNNFewShot compilation (embedder is cached, compilation is fast)
        embedder = _get_embedder()
        self.react = KNNFewShot(
            k=5, trainset=TOOL_EXAMPLES, vectorizer=embedder
        ).compile(base_react)

        logger.debug(
            f"ExecutorModule initialized with {len(self.execution_tools)} tools"
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

        # Check for human skill signal from tool execution
        # (DSPy catches tool exceptions, so tools signal via context instead)
        _check_and_raise_human_skill()

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
    result_text = str(getattr(pred, "result", ""))
    trajectory: dict[str, Any] = getattr(pred, "trajectory", None) or {}
    task = kwargs.get("step_description", "")

    # Fast-path: empty result is always bad
    if not result_text.strip():
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

    Uses KNNFewShot with TOOL_EXAMPLES to teach tool selection.
    """

    def __init__(
        self,
        execution_tools: list[Any] | None = None,
        max_iters: int = 10,
    ) -> None:
        super().__init__()
        self.execution_tools = execution_tools or []
        self.max_iters = max_iters

        # Build tools list with finish tool BEFORE creating ReAct
        # DSPy ReAct bakes Literal[tool_names] into the signature at init,
        # so we MUST pass all tools at creation time - cannot add later!
        all_tools = list(self.execution_tools)
        all_tools.append(
            dspy.Tool(
                func=lambda: "Completed.",
                name="finish",
                desc="Marks the task as complete.",
                args={},
            )
        )

        # Create ReAct with actual tools - Literal constraint includes all tool names
        base_react = dspy.ReAct(
            DirectExecution,
            tools=all_tools,
            max_iters=max_iters,
        )

        # Apply KNNFewShot compilation (embedder is cached, compilation is fast)
        embedder = _get_embedder()
        self.react = KNNFewShot(
            k=5, trainset=TOOL_EXAMPLES, vectorizer=embedder
        ).compile(base_react)

        logger.debug(
            f"DirectExecutorModule initialized with {len(self.execution_tools)} tools"
        )

    def forward(
        self, step_description: str, context: str, images: list[DspyImage] | None = None
    ) -> Prediction:
        """Execute and return full Prediction (required for dspy.Refine)."""
        result = self.react(
            step_description=step_description,
            context=context,
            images=images or [],
        )

        # Check for human skill signal from tool execution
        # (DSPy catches tool exceptions, so tools signal via context instead)
        _check_and_raise_human_skill()

        return result


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
