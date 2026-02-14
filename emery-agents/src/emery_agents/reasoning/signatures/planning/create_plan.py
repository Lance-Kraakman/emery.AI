"""CreatePlan signature for interactive planning."""

from __future__ import annotations

import dspy

from ._docstrings import build_create_plan_docstring
from .models import PlanOrQuestionsOutput

_DOCSTRING = build_create_plan_docstring()


class CreatePlan(dspy.Signature):  # type: ignore[misc]
    __doc__ = _DOCSTRING

    request: str = dspy.InputField(
        desc="The user's goal in natural language. May reference existing resources by name."
    )
    workspace_context: str = dspy.InputField(
        desc="Summary of existing workspace resources (databases, tables with field counts, "
        "apps, agents, skills). Check this BEFORE creating resources that may already exist. "
        "For detailed field schemas, use system_research(resource_type='tables', query='<name>', include_details=True). "
        "Do NOT guess field names or types — look them up if needed."
    )
    capability_guidance: str = dspy.InputField(
        desc="Routing table and instructions for system capabilities. "
        "Shows what the system can do, when to use each capability, "
        "which tools each capability uses, and step description templates. "
        "Use the step description templates to write executor-ready step descriptions."
    )
    planning_context: str = dspy.InputField(
        desc="Combined context for planning: task analysis (intent, domain, entities, approach), "
        "proven strategies from past executions, background memories, and delegation hints. "
        "Each section is labeled. Empty sections are omitted."
    )
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this chat session for follow-up context."
    )
    configured_tools: str = dspy.InputField(
        desc="JSON list of tools explicitly configured for this skill. "
        "When tools are listed here, you MUST use them in the plan steps. "
        "Include the exact tool name in the step's tool_call field. "
        "You may also discover additional tools via search_external if needed. "
        "Empty string if no tools are configured."
    )

    result: PlanOrQuestionsOutput = dspy.OutputField()
