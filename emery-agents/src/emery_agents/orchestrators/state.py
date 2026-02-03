"""
LangGraph State Schemas

Defines the typed state that flows through orchestration graphs.

IMPORTANT: LangGraph checkpoints state using msgpack/JSON serialization.
Only store serializable data (primitives, dicts, lists, dataclasses) in state.
Non-serializable runtime objects (tools, agents, executors, protobuf objects)
must be passed via RuntimeContext — see orchestrators/runtime.py.
"""

import operator
from typing import TypedDict, Annotated, List, Optional, Any, Dict

from ..entities.models.plan import Plan, PlanStep
from ..entities.models.task_ledger import TaskLedger
from ..services.context import WorkspaceContext


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
    memory_context: Optional[str]  # Relevant memories (passed separately to planner)

    # Session config (auth, identity) — all primitives, safe to checkpoint
    api_key: str
    org_id: str
    org_model: Optional[str]
    organization_id: Optional[int]

    # Workspace context — avoids duplicate WorkspaceAPI.get_all() calls
    workspace_context: Optional[WorkspaceContext]

    # Skill template generation (for GeneratePlan RPC)
    skill_inputs: Optional[List[Dict[str, Any]]]  # Input DEFINITIONS (schema)
    skill_outputs: Optional[List[Dict[str, Any]]]
    is_template_generation: bool

    # Runtime skill inputs (for skill invocation execution)
    runtime_skill_inputs: Optional[Dict[str, str]]  # Input VALUES at execution time

    # === Plan state (dataclasses — serializable) ===
    plan: Optional[Plan]
    stored_plan: Optional[Plan]  # Pre-approved plan for autonomous mode
    step_outcomes: Dict[str, Dict[str, Any]]  # step_id → StepOutcome.to_dict()

    # Task ledger for evaluation
    ledger: Optional[TaskLedger]

    # === Reflection state (Reflexion pattern) ===
    step_reflections: Dict[str, Dict[str, Any]]  # step_id → StepReflection.model_dump()
    reflection_summary: str  # Rolling summary of insights, max ~1500 chars

    # === Execution tracking (primitives) ===
    replan_count: int
    max_replans: int

    # === Human-in-the-loop (primitives/dicts) ===
    awaiting_input: Optional[str]  # "approval", "clarification", "recovery"
    clarifying_questions: List[Dict[str, Any]]

    # === Event accumulator (append-only for UI streaming) ===
    events: Annotated[List[Any], operator.add]

    # === Configured tools (from skill UI) ===
    configured_tools: Optional[List[Dict[str, Any]]]

    # === Triage (set by triage node) ===
    execution_mode: Optional[str]  # "direct", "plan", "respond"
    triage_reasoning: Optional[str]
    triage_context: Optional[str]  # Key findings from triage research
    triage_analysis: Optional[Dict[str, Any]]  # Combined analysis: intent, entities, approach, external_services

    # === Auto-approval ===
    auto_approved: Optional[bool]  # True if plan was auto-approved (low-risk, additive only)

    # === Output ===
    response: Optional[str]  # Final answer (signals "done" to routing)
    error: Optional[str]
    success: Optional[bool]


# Default initial state values — only serializable data.
DEFAULT_STATE: Dict[str, Any] = {
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
    # Event accumulator
    "events": [],
    # Configured tools
    "configured_tools": None,
    # Triage
    "execution_mode": None,
    "triage_reasoning": None,
    "triage_context": None,
    "triage_analysis": None,
    # Auto-approval
    "auto_approved": None,
    # Output
    "response": None,
    "error": None,
    "success": None,
}
