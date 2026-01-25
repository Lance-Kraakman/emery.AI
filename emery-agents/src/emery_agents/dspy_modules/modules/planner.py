"""
DSPy Planner Module.

This module handles plan generation using DSPy's ChainOfThought strategy.
It replaces the Jinja2-based planning templates.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import dspy

from emery_agents.dspy_modules.signatures.planning import (
    AnalyzeTask,
    CreatePlan,
    PlanOrQuestions,
)

if TYPE_CHECKING:
    from typing import Any


class PlannerModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for creating execution plans.

    This module first analyzes the task to understand intent and complexity,
    then creates a plan or asks clarifying questions.
    """

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """
        Initialize the planner module.

        Args:
            discovery_tools: List of tools available during planning phase
                           (read-only discovery tools)
        """
        super().__init__()
        self.analyzer = dspy.ChainOfThought(AnalyzeTask)
        self.planner = dspy.ChainOfThought(CreatePlan)
        self.discovery_tools = discovery_tools or []

    def forward(
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str,
        proven_strategies: str,
    ) -> PlanOrQuestions:
        """
        Generate a plan or clarifying questions for a user request.

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            capability_guidance: Domain-specific instructions from capability registry
            proven_strategies: ACE patterns for similar goals

        Returns:
            PlanOrQuestions with either a plan or clarifying questions
        """
        # First analyze the task to understand intent
        analysis = self.analyzer(
            request=request,
            context=workspace_context,
        )

        # Get tool names for the planner
        tool_names = [
            getattr(t, "name", str(t)) for t in self.discovery_tools
        ]

        # Then create plan with full context
        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            available_tools=tool_names,
            capability_guidance=capability_guidance,
            proven_strategies=proven_strategies,
        )

        return result.result  # type: ignore[no-any-return]


class SimplePlannerModule(dspy.Module):  # type: ignore[misc]
    """
    Simplified planner that skips analysis for straightforward tasks.

    Use this for simple, well-defined tasks that don't need pre-analysis.
    """

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """
        Initialize the simple planner module.

        Args:
            discovery_tools: List of tools available during planning phase
        """
        super().__init__()
        self.planner = dspy.ChainOfThought(CreatePlan)
        self.discovery_tools = discovery_tools or []

    def forward(
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str = "",
        proven_strategies: str = "",
    ) -> PlanOrQuestions:
        """
        Generate a plan directly without pre-analysis.

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            capability_guidance: Domain-specific instructions
            proven_strategies: ACE patterns for similar goals

        Returns:
            PlanOrQuestions with either a plan or clarifying questions
        """
        tool_names = [
            getattr(t, "name", str(t)) for t in self.discovery_tools
        ]

        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            available_tools=tool_names,
            capability_guidance=capability_guidance,
            proven_strategies=proven_strategies,
        )

        return result.result  # type: ignore[no-any-return]
