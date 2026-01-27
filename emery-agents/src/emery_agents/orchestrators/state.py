"""
LangGraph State Schemas

Defines the typed state that flows through orchestration graphs.
"""

import operator
from typing import TypedDict, Annotated, List, Optional, Any, Dict

from ..entities.models.plan import Plan, PlanStep
from ..entities.models.task_ledger import TaskLedger


class PlanExecuteState(TypedDict, total=False):
    """
    State for plan-and-execute orchestrator.

    This state flows through LangGraph nodes. Each node reads what it needs
    and returns a partial dict to update the state.

    Annotated fields with operator.add are append-only (events accumulate).
    """

    # === Input (set once at graph invocation) ===
    task: str
    tools: List[Any]
    managed_agents: List[Any]

    # Session config (auth, identity)
    api_key: str
    org_id: str
    org_model: Optional[str]
    organization_id: Optional[int]

    # Conversation context
    conversation_history: Optional[List[Any]]
    capability_registry: Optional[Any]

    # Pre-approved plan for autonomous mode
    stored_plan: Optional[Plan]

    # === Plan state ===
    plan: Optional[Plan]
    current_step_index: int
    step_results: Dict[str, Any]

    # Task ledger for evaluation (preserves existing evaluator integration)
    ledger: Optional[TaskLedger]

    # === Execution tracking ===
    replan_count: int
    max_replans: int
    evaluation_count: int
    evaluate_after_steps: int
    steps_since_eval: int

    # === Reusable executors (created once, reused across steps) ===
    plan_step_executor: Optional[Any]  # PlanStepExecutor instance

    # === Phase tracking (for hierarchical plans) ===
    current_phase_name: Optional[str]
    phase_step_results: Dict[str, List[str]]

    # === ACE context curation tracking ===
    steps_since_curation: int
    curated_step_ids: List[str]

    # === Human-in-the-loop ===
    # What kind of input we're waiting for: "approval", "clarification", "recovery"
    awaiting_input: Optional[str]
    # Clarifying questions from planner
    clarifying_questions: List[Dict[str, Any]]
    # User's response (set when graph is resumed after interrupt)
    user_response: Optional[str]

    # === ACE services (initialized once, reused across nodes) ===
    execution_context_service: Optional[Any]
    strategy_service: Optional[Any]

    # === Event accumulator (append-only for UI streaming) ===
    events: Annotated[List[Any], operator.add]

    # === Terminal state ===
    final_result: Optional[str]
    error: Optional[str]
    success: Optional[bool]


# Default initial state values
DEFAULT_STATE: Dict[str, Any] = {
    "plan": None,
    "current_step_index": 0,
    "step_results": {},
    "ledger": None,
    "replan_count": 0,
    "max_replans": 3,
    "evaluation_count": 0,
    "evaluate_after_steps": 1,
    "steps_since_eval": 0,
    "plan_step_executor": None,
    "current_phase_name": None,
    "phase_step_results": {},
    "steps_since_curation": 0,
    "curated_step_ids": [],
    "awaiting_input": None,
    "clarifying_questions": [],
    "user_response": None,
    "execution_context_service": None,
    "strategy_service": None,
    "events": [],
    "final_result": None,
    "error": None,
    "success": None,
    "stored_plan": None,
    "conversation_history": None,
    "capability_registry": None,
}
