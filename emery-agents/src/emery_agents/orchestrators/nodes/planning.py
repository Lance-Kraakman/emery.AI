"""
Planning Node

Handles plan generation within the LangGraph orchestrator.
Wraps existing PlanService for plan creation.
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
)
from ...services.tools import get_research_tools, detect_research_intent
from ...tools.tool_modes import ToolMode, filter_tools_for_mode
from ...reasoning.tools.api import WorkspaceAPI
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

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


async def generate_plan_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Generate a plan using PlanService.

    Returns plan or clarifying questions.
    """
    task = state.get("task", "")
    if not task:
        logger.error("generate_plan_node called without a task")
        return {"error": "No task provided", "events": [ErrorEvent(error="No task provided")]}

    # Read non-serializable objects from runtime
    tools = runtime.tools
    managed_agents = runtime.managed_agents
    capability_registry = runtime.capability_registry
    conversation_history = runtime.conversation_history

    # Read serializable session config from state
    api_key = state.get("api_key")
    org_id = state.get("org_id")
    org_model = state.get("org_model")

    events: List[Any] = []

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
            strategy_service=None,
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

    # Emit planning started only when a real plan was created (not for greetings/clarification)
    task_summary = task[:200] if len(task) > 200 else task
    events.append(PlanningStartedEvent(goal=task_summary))

    # Create task ledger from plan
    ledger = create_ledger_from_plan(
        task_id=plan.id,
        goal=task,
        plan_steps=[{"step_id": s.step_id, "description": s.description} for s in plan.steps],
    )
    ledger.record_plan_created({"plan_id": plan.id, "step_count": len(plan.steps)})

    logger.info(f"Plan {plan.id} created with {len(plan.steps)} steps, awaiting approval")
    events.append(PlanCreatedEvent(plan_id=plan.id, plan=plan))

    # Save plan to filesystem
    if runtime.plan_file_repository and plan:
        try:
            runtime.plan_file_repository.save(plan)
        except Exception as e:
            logger.warning(f"Failed to save plan to filesystem: {e}")

    return {
        "plan": plan,
        "ledger": ledger,
        "awaiting_input": "approval",
        "events": events,
    }
