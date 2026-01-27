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

    # Session config (auth, identity) — all primitives, safe to checkpoint
    api_key: str
    org_id: str
    org_model: Optional[str]
    organization_id: Optional[int]

    # === Plan state (dataclasses — serializable) ===
    plan: Optional[Plan]
    stored_plan: Optional[Plan]  # Pre-approved plan for autonomous mode
    current_step_index: int
    step_results: Dict[str, Any]

    # Task ledger for evaluation
    ledger: Optional[TaskLedger]

    # === Execution tracking (primitives) ===
    replan_count: int
    max_replans: int
    evaluation_count: int
    evaluate_after_steps: int
    steps_since_eval: int

    # === Phase tracking (primitives/dicts) ===
    current_phase_name: Optional[str]
    phase_step_results: Dict[str, List[str]]

    # === ACE context curation tracking (primitives/lists) ===
    steps_since_curation: int
    curated_step_ids: List[str]

    # === Human-in-the-loop (primitives/dicts) ===
    awaiting_input: Optional[str]  # "approval", "clarification", "recovery"
    clarifying_questions: List[Dict[str, Any]]
    user_response: Optional[str]

    # === Event accumulator (append-only for UI streaming) ===
    events: Annotated[List[Any], operator.add]

    # === Evaluation routing (explicit booleans for LangGraph routing) ===
    eval_goal_achieved: Optional[bool]
    eval_needs_replan: Optional[bool]
    eval_should_continue: Optional[bool]
    eval_has_blocking_issues: Optional[bool]

    # === Terminal state (primitives) ===
    final_result: Optional[str]
    error: Optional[str]
    success: Optional[bool]


# Default initial state values — only serializable data.
DEFAULT_STATE: Dict[str, Any] = {
    # Input
    "task": "",
    "api_key": "",
    "org_id": "",
    "org_model": None,
    "organization_id": None,
    # Plan state
    "plan": None,
    "stored_plan": None,
    "current_step_index": 0,
    "step_results": {},
    "ledger": None,
    # Execution tracking
    "replan_count": 0,
    "max_replans": 3,
    "evaluation_count": 0,
    "evaluate_after_steps": 1,
    "steps_since_eval": 0,
    # Phase tracking
    "current_phase_name": None,
    "phase_step_results": {},
    # ACE context curation
    "steps_since_curation": 0,
    "curated_step_ids": [],
    # Human-in-the-loop
    "awaiting_input": None,
    "clarifying_questions": [],
    "user_response": None,
    # Event accumulator
    "events": [],
    # Evaluation routing
    "eval_goal_achieved": None,
    "eval_needs_replan": None,
    "eval_should_continue": None,
    "eval_has_blocking_issues": None,
    # Terminal state
    "final_result": None,
    "error": None,
    "success": None,
}
