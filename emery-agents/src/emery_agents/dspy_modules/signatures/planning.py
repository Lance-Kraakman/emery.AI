"""
DSPy Signatures for planning operations.

These signatures replace the Jinja2 planning templates with typed I/O contracts.
"""

from __future__ import annotations

from typing import Any, Optional

import dspy
from pydantic import BaseModel, Field


class PlanStep(BaseModel):
    """A single step in an execution plan."""

    step_id: str = Field(description="Unique identifier for this step")
    description: str = Field(description="Human-readable description of what this step does")
    tool_call: Optional[str] = Field(
        default=None, description="Tool to call for this step (e.g., 'table_crud')"
    )
    parameters: Optional[dict[str, Any]] = Field(
        default=None, description="Parameters for the tool call (values can be strings, lists, or dicts)"
    )
    target_agent: Optional[str] = Field(
        default=None, description="Specialized agent to delegate to (e.g., 'schema_builder')"
    )
    required_context: list[str] = Field(
        default_factory=list, description="Context keys required from previous steps"
    )
    # Phase fields for execution control
    phase_name: str = Field(
        default="Execution",
        description="Phase: Discovery|Analysis|Execution|Summary",
    )
    phase_order: int = Field(
        default=1,
        description="Order within the phase (1, 2, 3...)",
    )
    replan_after: bool = Field(
        default=False,
        description="Re-evaluate plan after this step completes",
    )


class Plan(BaseModel):
    """A complete execution plan."""

    plan_id: str = Field(description="Unique identifier for this plan")
    goal: str = Field(description="The high-level goal this plan achieves")
    context: str = Field(description="Summary of workspace context used for planning")
    analysis: str = Field(description="Analysis of the request and approach")
    steps: list[PlanStep] = Field(description="Ordered list of steps to execute")


class ClarifyingQuestion(BaseModel):
    """A question to ask the user for clarification."""

    question: str = Field(description="The question to ask")
    question_type: str = Field(
        description="Type of question: 'choice', 'text', or 'confirmation'"
    )
    options: Optional[list[str]] = Field(
        default=None, description="Available options for choice questions"
    )
    reason: str = Field(description="Why this clarification is needed")


class PlanOrQuestions(BaseModel):
    """Result of planning: either a plan or clarifying questions."""

    plan: Optional[Plan] = Field(default=None, description="The execution plan if ready")
    questions: Optional[list[ClarifyingQuestion]] = Field(
        default=None, description="Questions if clarification is needed"
    )


class CreatePlan(dspy.Signature):  # type: ignore[misc]
    """Create an execution plan or ask clarifying questions if truly ambiguous.

    Check workspace_context for existing resources before asking questions.
    Use capability_guidance to understand which capability to delegate to.
    """

    request: str = dspy.InputField(desc="User's goal or task")
    workspace_context: str = dspy.InputField(
        desc="JSON of existing databases, tables, apps - check FIRST before asking"
    )
    available_tools: list[str] = dspy.InputField(desc="Discovery tools available")
    capability_guidance: str = dspy.InputField(
        desc="Capability planning guidance - when to use each capability"
    )
    proven_strategies: str = dspy.InputField(desc="ACE patterns for similar goals")

    result: PlanOrQuestions = dspy.OutputField()


class AnalyzeTask(dspy.Signature):  # type: ignore[misc]
    """Analyze user request to understand intent and extract entities.

    This is the first step before planning - understanding what the user wants.
    """

    request: str = dspy.InputField(desc="The user's request or goal")
    context: str = dspy.InputField(desc="Workspace context")

    intent: str = dspy.OutputField(desc="What the user wants to achieve")
    domain: str = dspy.OutputField(desc="Domain: emery|web|automation|research")
    entities: list[str] = dspy.OutputField(desc="Key entities mentioned in the request")
    complexity: str = dspy.OutputField(desc="Complexity level: simple|medium|complex")
