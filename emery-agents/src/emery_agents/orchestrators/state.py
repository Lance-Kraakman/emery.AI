"""
LangGraph State Schemas

Defines the typed state that flows through orchestration graphs.

IMPORTANT: LangGraph checkpoints state using msgpack/JSON serialization.
Only store serializable data (primitives, dicts, lists, dataclasses) in state.
Non-serializable runtime objects (tools, agents, executors, protobuf objects)
must be passed via RuntimeContext — see orchestrators/runtime.py.
"""

import operator
from typing import Annotated, Any, TypedDict

from ..entities.models.plan import Plan
from ..entities.models.task_ledger import TaskLedger
from ..services.context import WorkspaceContext


class HumanSkillCompleted(TypedDict):
    """Structured data for completed human skill.

    Used when a human skill finishes and returns outputs to be
    applied via OutputMappingService.
    """

    step_id: str
    skill_id: str
    skill_name: str
    outputs: dict[str, Any]


class PlanExecuteState(TypedDict, total=False):
    """
    Serializable state for plan-and-execute orchestrator.

    This state is checkpointed by LangGraph between nodes and across
    interrupt/resume cycles. ALL fields must be serializable.

    Non-serializable runtime objects (tools, agents, capability_registry, etc.)
    are passed via RuntimeContext — see orchestrators/runtime.py.
    """

    # === Input (set once at graph invocation) ===
    task: str
    memory_context: str | None  # Relevant memories (passed separately to planner)

    # Session config (auth, identity) — all primitives, safe to checkpoint
    api_key: str
    org_id: str
    org_model: str | None
    organization_id: int | None

    # Workspace context — avoids duplicate WorkspaceAPI.get_all() calls
    workspace_context: WorkspaceContext | None

    # Skill template generation (for GeneratePlan RPC)
    skill_inputs: list[dict[str, Any]] | None  # Input DEFINITIONS (schema)
    skill_outputs: list[dict[str, Any]] | None
    is_template_generation: bool

    # Runtime skill inputs (for skill invocation execution)
    runtime_skill_inputs: dict[str, str] | None  # Input VALUES at execution time

    # === Plan state (dataclasses — serializable) ===
    plan: Plan | None
    stored_plan: Plan | None  # Pre-approved plan for autonomous mode
    step_outcomes: dict[str, dict[str, Any]]  # step_id → StepOutcome.to_dict()

    # Task ledger for evaluation
    ledger: TaskLedger | None

    # === Reflection state (Reflexion pattern) ===
    step_reflections: dict[str, dict[str, Any]]  # step_id → StepReflection.model_dump()
    reflection_summary: str  # Rolling summary of insights, max ~1500 chars

    # === Execution tracking (primitives) ===
    replan_count: int
    max_replans: int

    # === Human-in-the-loop (primitives/dicts) ===
    awaiting_input: str | None  # "approval", "clarification", "recovery", "human_skill"
    clarifying_questions: list[dict[str, Any]]
    human_skill_info: dict[str, Any] | None  # Info for human skill interrupt
    human_skill_completed: HumanSkillCompleted | None  # Structured completion data

    # === Event accumulator (append-only for UI streaming) ===
    events: Annotated[list[Any], operator.add]

    # === Configured tools (from skill UI) ===
    configured_tools: list[dict[str, Any]] | None

    # === Triage (set by triage node) ===
    execution_mode: str | None  # "direct", "plan", "respond"
    triage_reasoning: str | None
    triage_context: str | None  # Key findings from triage research
    triage_analysis: (
        dict[str, Any] | None
    )  # Combined analysis: intent, entities, approach, external_services
    record_context: (
        dict[str, Any] | None
    )  # {table_name, table_id, record_ids} for graph traversal

    # === Mention routing (set when @skill/@agent/@tool detected) ===
    pre_selected_skill: str | None
    pre_selected_agent: str | None
    pre_selected_tool: str | None

    # === Auto-approval ===
    auto_approved: (
        bool | None
    )  # True if plan was auto-approved (low-risk, additive only)

    # === Output ===
    response: str | None  # Final answer (signals "done" to routing)
    error: str | None
    success: bool | None


# Default initial state values — only serializable data.
DEFAULT_STATE: dict[str, Any] = {
    # Input
    "task": "",
    "memory_context": None,
    "api_key": "",
    "org_id": "",
    "org_model": None,
    "organization_id": None,
    # Workspace context
    "workspace_context": None,
    # Skill template generation
    "skill_inputs": None,
    "skill_outputs": None,
    "is_template_generation": False,
    # Runtime skill inputs
    "runtime_skill_inputs": None,
    # Plan state
    "plan": None,
    "stored_plan": None,
    "step_outcomes": {},
    "ledger": None,
    # Reflection state
    "step_reflections": {},
    "reflection_summary": "",
    # Execution tracking
    "replan_count": 0,
    "max_replans": 3,
    # Human-in-the-loop
    "awaiting_input": None,
    "clarifying_questions": [],
    "human_skill_info": None,
    "human_skill_completed": None,
    # Event accumulator
    "events": [],
    # Configured tools
    "configured_tools": None,
    # Triage
    "execution_mode": None,
    "triage_reasoning": None,
    "triage_context": None,
    "triage_analysis": None,
    "record_context": None,
    # Mention routing
    "pre_selected_skill": None,
    "pre_selected_agent": None,
    "pre_selected_tool": None,
    # Auto-approval
    "auto_approved": None,
    # Output
    "response": None,
    "error": None,
    "success": None,
}
