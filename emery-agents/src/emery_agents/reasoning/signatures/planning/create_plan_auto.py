"""CreatePlanAutonomous signature for autonomous planning."""

from __future__ import annotations

import dspy

from ._docstrings import build_create_plan_autonomous_docstring
from .models import PlanOutput

_DOCSTRING = build_create_plan_autonomous_docstring()


class CreatePlanAutonomous(dspy.Signature):  # type: ignore[misc]
    __doc__ = _DOCSTRING

    request: str = dspy.InputField(
        desc="The user's goal in natural language. May reference existing resources by name."
    )
    workspace_context: str = dspy.InputField(
        desc="Summary of existing workspace resources (databases, tables with field counts, "
        "apps, agents, skills). Check this BEFORE creating resources that may already exist."
    )
    capability_guidance: str = dspy.InputField(
        desc="Routing table and instructions for system capabilities. "
        "Shows what the system can do, when to use each capability, "
        "which tools each capability uses, and step description templates."
    )
    planning_context: str = dspy.InputField(
        desc="Combined context for planning: task analysis (intent, domain, entities, approach), "
        "proven strategies from past executions, background memories, and delegation hints."
    )
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this chat session for follow-up context."
    )
    configured_tools: str = dspy.InputField(
        desc="JSON list of tools explicitly configured for this skill. "
        "When tools are listed here, you MUST use them in the plan steps. "
        "Empty string if no tools are configured."
    )

    # KEY DIFFERENCE: PlanOutput directly, NOT PlanOrQuestionsOutput
    result: PlanOutput = dspy.OutputField()
