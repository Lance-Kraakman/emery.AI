"""
DSPy Executor Module.

This module handles step execution using DSPy's ReAct strategy.
It replaces smolagents ToolCallingAgent.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import dspy

if TYPE_CHECKING:
    pass


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
