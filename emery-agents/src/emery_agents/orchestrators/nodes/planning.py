"""
Planning Node

Handles plan generation within the LangGraph orchestrator.
Wraps existing PlanService for plan creation.
"""

import logging
from typing import Any, Dict, List, Optional

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus, SkillInputDefinition, SkillOutputDefinition
from ...entities.models.task_ledger import create_ledger_from_plan
from ...services.plan_service import PlanService
from ...services.context import (
    SessionConfig,
    WorkspaceContext,
)
from ...entities.workspace import WorkspaceTable
from ...services.execution.events import (
    PlanCreatedEvent,
    PlanningStartedEvent,
    AwaitingClarificationEvent,
    ErrorEvent,
)
from ...tools.tool_modes import ToolMode, filter_tools_for_mode
from emery_agents.api import WorkspaceAPI
from emery_agents.tools.discovery import create_discovery_tools
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

    # Build flat table list from nested databases, enriching with parent db info
    all_tables = []
    for db in data.databases:
        for t in db.tables:
            all_tables.append(WorkspaceTable(
                id=t.id,
                name=t.name,
                database_id=db.id,
                database_name=db.name,
                field_count=t.field_count,
                fields=t.fields,
            ))

    return WorkspaceContext(
        existing_databases=data.databases,
        existing_tables=all_tables,
        existing_apps=data.apps,
        existing_agents=data.agents,
        existing_skills=data.skills,
        existing_views=data.views,
    )


# Minimum cosine similarity to consider a resource relevant.
_RELEVANCE_THRESHOLD = 0.3


def _score_resource(
    task_embedding: tuple[float, ...],
    name: str,
    description: str = "",
) -> float:
    """Score a resource's relevance to the task using semantic similarity.

    Uses the same embedding infrastructure as CapabilityRegistry.search().
    Embeddings are LRU-cached (1000 entries) so repeated resource names are free.
    """
    from ...services.analysis.embeddings import get_embedding, cosine_similarity

    resource_text = f"{name} {description}".strip()
    if not resource_text:
        return 0.0
    resource_embedding = get_embedding(resource_text)
    return cosine_similarity(task_embedding, resource_embedding)


def _top_n_relevant(
    items: list,  # type: ignore[type-arg]
    n: int,
    score_fn: Any,
    threshold: float = _RELEVANCE_THRESHOLD,
) -> list:  # type: ignore[type-arg]
    """Return top N items above the similarity threshold, sorted by score.

    If no items score above the threshold, returns all items unchanged
    (fallback: the task doesn't clearly relate to any resource).
    """
    scored = [(item, score_fn(item)) for item in items]
    relevant = [(item, s) for item, s in scored if s >= threshold]
    if not relevant:
        return items  # Nothing matched — return all as fallback
    relevant.sort(key=lambda x: x[1], reverse=True)
    return [item for item, _ in relevant[:n]]


def _filter_relevant_context(
    workspace: WorkspaceContext,
    task: str,
) -> WorkspaceContext:
    """
    Filter workspace context to resources relevant to the task.

    Uses semantic embeddings (same as CapabilityRegistry.search()) to score
    each resource by similarity to the task. Returns a filtered WorkspaceContext:
    - ALL databases (always included — typically 1-3, negligible cost)
    - Top-N most relevant tables, apps, agents, skills, views

    Embeddings are LRU-cached, so after the first call resource embeddings are free.
    If no resource scores above the threshold, returns full context unchanged.
    """
    from ...services.analysis.embeddings import get_embedding

    if not task.strip():
        return workspace

    try:
        task_embedding = get_embedding(task)
    except Exception:
        logger.warning("Embedding service unavailable, returning full workspace context")
        return workspace

    # Caps per resource type
    TABLE_CAP = 15
    APP_CAP = 10
    AGENT_CAP = 10
    SKILL_CAP = 10
    VIEW_CAP = 10

    filtered_tables = _top_n_relevant(
        workspace.existing_tables, TABLE_CAP,
        lambda t: _score_resource(task_embedding, t.name, " ".join(f.name for f in t.fields)),
    )
    filtered_apps = _top_n_relevant(
        workspace.existing_apps, APP_CAP,
        lambda a: _score_resource(task_embedding, a.name, a.description),
    )
    filtered_agents = _top_n_relevant(
        workspace.existing_agents, AGENT_CAP,
        lambda a: _score_resource(task_embedding, a.name, a.description),
    )
    filtered_skills = _top_n_relevant(
        workspace.existing_skills, SKILL_CAP,
        lambda s: _score_resource(task_embedding, s.name, s.description),
    )
    filtered_views = _top_n_relevant(
        workspace.existing_views, VIEW_CAP,
        lambda v: _score_resource(task_embedding, v.name),
    )

    return WorkspaceContext(
        existing_databases=workspace.existing_databases,  # Always include all
        existing_tables=filtered_tables,
        existing_apps=filtered_apps,
        existing_agents=filtered_agents,
        existing_skills=filtered_skills,
        existing_views=filtered_views,
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
    memory_context = state.get("memory_context") or ""

    events: List[Any] = []

    logger.info("Creating plan (planner handles clarification if needed)")

    # Filter tools to read-only for planning
    planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)

    # Create discovery tools for ReAct planner (system_research, search_capabilities, search_external)
    # Exclude workspace_overview — redundant with the static workspace_context below
    if api_key and org_id:
        discovery_tools = create_discovery_tools(api_key, org_id, capability_registry)
        discovery_tools = [t for t in discovery_tools if t.name != "workspace_overview"]
    else:
        discovery_tools = []

    # Use cached workspace from state if available, otherwise fetch
    cached_workspace = state.get("workspace_context")
    if cached_workspace:
        full_workspace = cached_workspace
    else:
        logger.warning(
            "workspace_context not in graph state — fetching "
            "(caller should populate state to avoid duplicate API call)"
        )
        full_workspace = _build_workspace_context(api_key, org_id)

    # Filter to task-relevant resources
    workspace_context = _filter_relevant_context(full_workspace, task)

    # Build session config
    config = SessionConfig(
        org_id=org_id or "",
        org_model=org_model,
        api_key=api_key,
    )

    # Read skill template generation fields (set by GeneratePlan RPC)
    skill_inputs_raw = state.get("skill_inputs")
    skill_outputs_raw = state.get("skill_outputs")
    is_template_generation = state.get("is_template_generation", False)

    skill_input_defs = (
        [SkillInputDefinition(**s) for s in skill_inputs_raw]
        if skill_inputs_raw
        else None
    )
    skill_output_defs = (
        [SkillOutputDefinition(**s) for s in skill_outputs_raw]
        if skill_outputs_raw
        else None
    )

    # Create PlanService with discovery tools for ReAct planner
    plan_service = PlanService(model_provider=None, discovery_tools=discovery_tools)

    try:
        result = await plan_service.generate_plan(
            basic_instructions=task,
            goal=task,
            tools=planning_tools,
            managed_agents=managed_agents,
            conversation_history=conversation_history,
            strategy_service=None,
            capability_registry=capability_registry,
            config=config,
            workspace=workspace_context,
            skill_inputs=skill_input_defs,
            skill_outputs=skill_output_defs,
            is_template_generation=is_template_generation,
            memory_context=memory_context,
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
