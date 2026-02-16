"""TriageTask signature for task routing."""

from __future__ import annotations

import dspy

from .models import RecordContext


class TriageTask(dspy.Signature):  # type: ignore[misc]
    """Analyze the user's task, extract intent/entities, and determine the best execution approach.

    Uses KNNFewShot demos to learn routing patterns. No tool calls needed — route based on
    task keywords and workspace context.

    ALWAYS output intent, entities, approach, and external_services — these are used
    by the planner if the task is routed to "plan" mode. This avoids a separate analysis step.

    ROUTING RULES:

    "direct" — Read-only research, Q&A, information gathering:
    - Research/information tasks (web search, summarize, explain)
    - Conversational queries (questions, help, explanations)
    - Lookups that don't modify workspace state
    - Visual analysis of images ("what's in this image/PDF")
    - NEVER route skill execution or CRUD modifications here

    "plan" — Any action that modifies state, execute with plan:
    - Skill execution (run @skill-name, execute skill, trigger automation)
    - CRUD operations (add/update/delete tables, fields, apps, rows)
    - Single well-defined actions that modify workspace (add a field, delete a table)
    - Multiple steps or cross-capability tasks
    - Complex business logic or data modeling (build a CRM, set up workflows)
    - "build an app based on this mockup" + images → "plan" (multi-step using images)

    "respond" — Pure conversation, no tools needed:
    - Greetings, thank you messages
    - Questions about what the platform can do
    - Requests for clarification on previous responses
    - Never route to "respond" when images are present — respond cannot process images

    WHEN IN DOUBT: prefer "direct" for questions, research, and read-only tasks.
    Only use "plan" for EXPLICIT state modifications (create, update, delete, execute skill).

    Examples that should be "direct" (NOT plan):
    - "How do I..." → direct
    - "What is [concept]..." → direct (e.g., "What is a foreign key?")
    - "Explain [concept]..." → direct (e.g., "Explain how workflows work")
    - "Search for [information]..." → direct
    - "Tell me about [concept/topic]" → direct (e.g., "Tell me about CRM best practices")

    Examples that REQUIRE "plan" (record lookups + state changes):
    - "Tell me about [person/record]" → plan (e.g., "Tell me about John Smith")
    - "Show me [record]'s details" → plan (requires row lookup)
    - "What is [record]'s history/status" → plan (requires row lookup)
    - "List all [rows] for [entity]" → plan (requires filtered query)
    - "Create a table for..." → plan
    - "Add a field to..." → plan
    - "Delete the..." → plan
    - "@skill-name" → plan
    """

    task: str = dspy.InputField(desc="The user's task or request in natural language")
    workspace_context: str = dspy.InputField(
        desc="Current workspace state: existing resources (databases, tables, apps, agents, skills). "
        "Check this before making routing decisions."
    )
    memory_context: str = dspy.InputField(
        desc="Relevant memories from previous sessions. Lightweight background "
        "context — use for continuity. Empty if none."
    )
    image_context: str = dspy.InputField(
        desc="Description of user-uploaded images available for visual analysis. "
        "Empty string if no images. When present, 'direct' and 'plan' nodes "
        "can analyze these images — 'respond' cannot.",
        default="",
    )

    execution_mode: str = dspy.OutputField(desc="One of: 'direct', 'plan', 'respond'")
    reasoning: str = dspy.OutputField(
        desc="Brief explanation of why this route was chosen (1-2 sentences)"
    )
    context_notes: str = dspy.OutputField(
        desc="Key findings from any research tools called (resource IDs, capability matches, etc.). "
        "Passed to the next node to avoid duplicate lookups. Empty string if no research done."
    )
    response: str = dspy.OutputField(
        desc="When execution_mode is 'respond': the complete, natural answer to give the user. "
        "When execution_mode is 'direct' or 'plan': empty string."
    )
    # Task analysis fields — populated during triage to avoid a separate AnalyzeTask call
    intent: str = dspy.OutputField(
        desc="One-sentence summary of the user's goal. Start with a verb "
        "(e.g., 'Create a contacts table with name, email, and phone fields'). "
        "Always populated regardless of execution_mode."
    )
    entities: list[str] = dspy.OutputField(
        desc="Concrete nouns from the request: resource names, field names, service names. "
        "Resolve references using workspace_context (e.g., 'the table' → actual table name)."
    )
    approach: str = dspy.OutputField(
        desc="Reasoning approach: 'analytical', 'systems-thinking', 'step-by-step', or 'creative'. "
        "Guides how the planner structures the plan."
    )
    external_services: list[str] = dspy.OutputField(
        desc="Third-party services mentioned (e.g., ['gmail', 'slack']). "
        "Empty list if none. The planner will call search_external for each."
    )
    record_context: RecordContext = dspy.OutputField(
        desc="If task references specific rows, extract table_id and record IDs/names"
    )
