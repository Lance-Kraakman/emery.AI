"""
DSPy Planner Module.

This module handles plan generation using DSPy's ChainOfThought strategy.
It replaces the Jinja2-based planning templates.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import dspy

from emery_agents.reasoning.signatures.planning import (
    AnalyzeTask,
    ClarifyingQuestion,
    CreatePlan,
    PlanOrQuestions,
)

if TYPE_CHECKING:
    from typing import Any


class PlannerModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for creating execution plans.

    This module implements the Think Before Asking pattern:
    1. Classify intent (greeting, question, vague, clear actionable)
    2. Check for delegation phrases (user wants us to decide)
    3. Analyze the task to understand complexity
    4. Create a plan or ask clarifying questions
    5. Validate the output

    Critical logic is in Python (testable, maintainable), not in prompt strings.
    """

    # Phrases that indicate user wants us to propose defaults
    DELEGATION_PHRASES = [
        "what do you think",
        "you decide",
        "typical",
        "standard",
        "whatever you think",
        "up to you",
        "your choice",
        "default",
        "usual",
        "common",
    ]

    # Simple greetings that need clarification
    GREETINGS = ["hey", "hi", "hello", "good morning", "good afternoon", "good evening"]

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
        # Step 1: Classify intent (Python logic, not LLM-dependent)
        intent = self._classify_intent(request)

        # Handle greetings with a clarifying question
        if intent == "greeting":
            return PlanOrQuestions(
                questions=[
                    ClarifyingQuestion(
                        question="What would you like help with today?",
                        question_type="text",
                        options=None,
                        reason="Need to understand your goal before creating a plan",
                    )
                ]
            )

        # Step 2: Check for delegation phrases
        # If user says "whatever you think" etc., we should propose defaults
        # rather than asking open-ended questions
        has_delegation = self._has_delegation_phrase(request)

        # Step 3: Analyze the task to understand intent and complexity
        analysis = self.analyzer(
            request=request,
            context=workspace_context,
        )

        # Get tool names for the planner
        tool_names = [getattr(t, "name", str(t)) for t in self.discovery_tools]

        # Step 4: Build effective guidance with Think Before Asking
        has_workspace = bool(workspace_context and workspace_context != "{}")
        think_first = self._build_think_before_asking_guidance(
            has_delegation=has_delegation,
            has_workspace_context=has_workspace,
        )
        effective_guidance = f"{think_first}\n\n{capability_guidance}"

        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            available_tools=tool_names,
            capability_guidance=effective_guidance,
            proven_strategies=proven_strategies,
        )

        # Step 5: Validate output
        plan_result = result.result
        self._validate_result(plan_result)

        return plan_result  # type: ignore[no-any-return]

    def _classify_intent(self, request: str) -> str:
        """
        Classify the request intent.

        Returns:
            - 'greeting': Simple greeting, need to ask what they want
            - 'question': User is asking a question (informational)
            - 'actionable': User wants something done
        """
        normalized = request.lower().strip().rstrip("!?.")

        # Check for simple greetings
        if normalized in self.GREETINGS:
            return "greeting"

        # Check for questions about capabilities (informational, not actionable)
        question_patterns = ["what can you do", "how do you work", "what are you"]
        if any(pattern in normalized for pattern in question_patterns):
            return "question"

        # Default: assume actionable request
        return "actionable"

    def _has_delegation_phrase(self, request: str) -> bool:
        """
        Check if the request contains phrases indicating user wants us to decide.

        This implements the "Think Before Asking" pattern - if the user says
        "whatever you think" or "standard approach", we should propose defaults
        rather than asking clarifying questions.
        """
        normalized = request.lower()
        return any(phrase in normalized for phrase in self.DELEGATION_PHRASES)

    def _build_think_before_asking_guidance(
        self,
        has_delegation: bool,
        has_workspace_context: bool,
    ) -> str:
        """
        Build Think Before Asking guidance based on context.

        This keeps critical logic in Python (testable) rather than in prompts.
        """
        lines = [
            "THINK BEFORE ASKING:",
            "1. Check workspace_context for existing resources FIRST",
            "2. Use capability_guidance to understand which capability to use",
            "3. Propose defaults based on domain patterns",
            "4. Only ask when truly ambiguous (security, business rules, destructive ops)",
            "",
            "Questions OK for: security decisions, business rules, destructive operations",
            "Discovery/propose for: resource names, what exists, schemas, common patterns",
        ]

        if has_delegation:
            lines.insert(0, "USER DELEGATED - propose defaults, do NOT ask questions.\n")

        if not has_workspace_context:
            lines.append(
                "\nWorkspace context is empty - use Discovery phase to find resources."
            )

        return "\n".join(lines)

    def _validate_result(self, result: PlanOrQuestions) -> None:
        """
        Validate the planner output.

        Raises:
            ValueError: If the output is invalid
        """
        # Must have either plan or questions
        if result.plan is None and result.questions is None:
            raise ValueError("Planner must return either a plan or clarifying questions")

        # If plan exists, it must have at least one step
        if result.plan is not None and len(result.plan.steps) == 0:
            raise ValueError("Plan must have at least one step")


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
