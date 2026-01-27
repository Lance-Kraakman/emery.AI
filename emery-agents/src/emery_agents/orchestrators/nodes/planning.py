"""
Planning Nodes

Handles plan generation and replanning within the LangGraph orchestrator.
Wraps existing PlanService and PlanDiffer.
"""

import logging
from typing import Any, Dict, List, Optional

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...entities.models.task_ledger import create_ledger_from_plan
from ...services.plan_service import PlanService
from ...services.context import (
    SessionConfig,
    WorkspaceContext,
    TableInfo,
    DatabaseInfo,
    AppInfo,
    PageInfo,
    AgentInfo,
    SkillInfo,
    ViewInfo,
)
from ...services.execution.events import (
    PlanCreatedEvent,
    PlanningStartedEvent,
    AwaitingClarificationEvent,
    ErrorEvent,
    ReplanTriggeredEvent,
    PlanUpdatedEvent,
)
from ...services.tools import get_research_tools, detect_research_intent
from ...tools.tool_modes import ToolMode, filter_tools_for_mode
from ...reasoning.tools.api import WorkspaceAPI
from ...services.planning.plan_differ import PlanDiffer
from ...services.execution.replan_handler import ReplanHandler, ReplanNeedsClarificationError
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


def _build_workspace_context(
    api_key: Optional[str],
    org_id: Optional[str],
) -> WorkspaceContext:
    """
    Build workspace context using unified Workspace API.

    Single API call fetches all workspace resources.
    """
    if not api_key or not org_id:
        logger.warning("Cannot fetch workspace data: missing api_key or org_id")
        return WorkspaceContext(
            existing_databases=[],
            existing_tables=[],
            existing_apps=[],
            existing_agents=[],
            existing_skills=[],
            existing_views=[],
        )

    workspace_api = WorkspaceAPI(api_key, org_id)
    data = workspace_api.get_all()

    logger.info(
        f"Workspace context: {len(data.databases)} databases, "
        f"{len(data.apps)} apps, {len(data.agents)} agents, "
        f"{len(data.skills)} skills, {len(data.views)} views"
    )

    # Build flat table list from nested databases
    all_tables = []
    for db in data.databases:
        for t in db.tables:
            all_tables.append(TableInfo(
                name=t.name,
                id=str(t.id),
                database_id=str(db.id),
                database_name=db.name,
                field_count=t.field_count,
                fields=[],
            ))

    return WorkspaceContext(
        existing_databases=[
            DatabaseInfo(name=db.name, id=str(db.id), table_count=len(db.tables))
            for db in data.databases
        ],
        existing_tables=all_tables,
        existing_apps=[
            AppInfo(
                name=app.name,
                id=str(app.id),
                description=app.description,
                pages=[
                    PageInfo(name=p.name, id=str(p.id), app_id=str(app.id))
                    for p in app.pages
                ],
            )
            for app in data.apps
        ],
        existing_agents=[
            AgentInfo(name=a.name, id=str(a.id), description=a.description)
            for a in data.agents
        ],
        existing_skills=[
            SkillInfo(
                name=s.name,
                id=str(s.id),
                description=s.description,
                agent_id=str(s.agent_id) if s.agent_id else None,
            )
            for s in data.skills
        ],
        existing_views=[
            ViewInfo(
                name=v.name,
                id=str(v.id),
                table_id=str(v.table_id),
                view_type=v.view_type,
            )
            for v in data.views
        ],
    )


async def generate_plan_node(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Generate a plan using PlanService.

    Replaces ExecutionCoordinator.create_plan().
    Returns plan or clarifying questions.
    """
    task = state["task"]
    tools = state.get("tools", [])
    managed_agents = state.get("managed_agents", [])
    api_key = state.get("api_key")
    org_id = state.get("org_id")
    org_model = state.get("org_model")
    organization_id = state.get("organization_id")
    conversation_history = state.get("conversation_history")
    capability_registry = state.get("capability_registry")
    strategy_service = state.get("strategy_service")

    events: List[Any] = []

    # Emit planning started
    task_summary = task[:200] if len(task) > 200 else task
    events.append(PlanningStartedEvent(goal=task_summary))

    logger.info("Creating plan (planner handles clarification if needed)")

    # Filter tools to read-only for planning
    planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)

    # Detect research intent
    research_tools = None
    if detect_research_intent(task):
        research_tools = get_research_tools()
        if research_tools:
            logger.info(f"Research intent detected, adding {len(research_tools)} research tools")

    # Build workspace context
    workspace_context = _build_workspace_context(api_key, org_id)

    # Build session config
    config = SessionConfig(
        org_id=org_id or "",
        org_model=org_model,
        api_key=api_key,
    )

    # Create PlanService and generate plan
    plan_service = PlanService(model_provider=None)

    try:
        result = await plan_service.generate_plan(
            basic_instructions=task,
            goal=task,
            tools=planning_tools,
            managed_agents=managed_agents,
            research_tools=research_tools,
            conversation_history=conversation_history,
            strategy_service=strategy_service,
            capability_registry=capability_registry,
            config=config,
            workspace=workspace_context,
        )
    except Exception as e:
        logger.error(f"Plan generation failed: {e}")
        events.append(ErrorEvent(error=f"Failed to generate plan: {e}", recoverable=True))
        return {"error": str(e), "events": events}

    # Check if planner needs clarification
    if result.needs_clarification and result.clarifying_questions:
        logger.info(f"Planner needs clarification: {len(result.clarifying_questions)} question(s)")
        events.append(AwaitingClarificationEvent.from_dict_list(
            questions=result.clarifying_questions,
            reasoning="Need more details to create a specific plan",
        ))
        return {
            "clarifying_questions": result.clarifying_questions,
            "awaiting_input": "clarification",
            "events": events,
        }

    plan = result.plan
    if plan is None:
        logger.error("Plan generation returned no plan and no questions")
        events.append(ErrorEvent(error="Plan generation failed: no plan returned", recoverable=True))
        return {"error": "No plan returned", "events": events}

    # Create task ledger from plan
    ledger = create_ledger_from_plan(
        task_id=plan.id,
        goal=task,
        plan_steps=[{"step_id": s.step_id, "description": s.description} for s in plan.steps],
    )
    ledger.record_plan_created({"plan_id": plan.id, "step_count": len(plan.steps)})

    # Store strategy guidance on ledger
    if plan_service.last_strategy_guidance:
        ledger.strategy_guidance = plan_service.last_strategy_guidance

    logger.info(f"Plan {plan.id} created with {len(plan.steps)} steps, awaiting approval")
    events.append(PlanCreatedEvent(plan_id=plan.id, plan=plan))

    return {
        "plan": plan,
        "ledger": ledger,
        "awaiting_input": "approval",
        "events": events,
    }


async def replan_node(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Replan using diff-based approach.

    Replaces ExecutionCoordinator._trigger_replan() + ReplanHandler.
    """
    plan = state["plan"]
    replan_count = state.get("replan_count", 0)
    max_replans = state.get("max_replans", 3)
    tools = state.get("tools", [])
    org_model = state.get("org_model")
    error = state.get("error")

    events: List[Any] = []

    assert plan is not None, "Cannot replan without a plan"

    replan_count += 1

    events.append(ReplanTriggeredEvent(
        plan_id=plan.id,
        reason=error or "Evaluation triggered replan",
        replan_number=replan_count,
    ))

    # Use ReplanHandler for diff-based replanning
    replan_handler = ReplanHandler(model_provider=None, org_model=org_model)

    old_pending_count = len(plan.get_pending_steps())

    try:
        updated_plan = await replan_handler.handle_replan(
            current_plan=plan,
            failed_step=None,
            reason=error or "Evaluation triggered replan",
            tools=tools,
        )
    except ReplanNeedsClarificationError as e:
        events.append(AwaitingClarificationEvent.from_dict_list(
            questions=e.questions,
            reasoning=e.reasoning or "Need more information to replan",
        ))
        return {
            "awaiting_input": "clarification",
            "clarifying_questions": e.questions,
            "replan_count": replan_count,
            "events": events,
        }

    new_pending_count = len(updated_plan.get_pending_steps())

    events.append(PlanUpdatedEvent(
        plan_id=plan.id,
        reason=error or "Evaluation triggered replan",
        added_steps=max(0, new_pending_count - old_pending_count),
        removed_steps=max(0, old_pending_count - new_pending_count),
        replan_number=replan_count,
    ))

    logger.info(f"Replan complete ({replan_count}): {new_pending_count} pending steps")

    return {
        "plan": updated_plan,
        "replan_count": replan_count,
        "error": None,  # Clear error after successful replan
        "events": events,
    }
