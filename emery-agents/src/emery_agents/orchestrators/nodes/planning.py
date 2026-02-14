"""
Planning Node

Handles plan generation within the LangGraph orchestrator.
Wraps existing PlanService for plan creation.
"""

import logging
from typing import Any

from emery_agents.ace.services.strategy_service import StrategyAccumulationService
from emery_agents.api import WorkspaceAPI
from emery_agents.reasoning.modules.retrievers import get_or_create_retrievers
from emery_agents.tools.discovery import create_discovery_tools

from ...entities.models.plan import (
    Plan,
    SkillInputDefinition,
    SkillOutputDefinition,
)
from ...entities.models.task_ledger import create_ledger_from_plan
from ...entities.workspace import WorkspaceTable
from ...services.analysis.embedding_usage import set_current_tracker
from ...services.analysis.embeddings import cosine_similarity, get_embedding
from ...services.analysis.token_accumulator import TokenAccumulator
from ...services.context import (
    SessionConfig,
    WorkspaceContext,
)
from ...services.execution.events import (
    AwaitingClarificationEvent,
    ErrorEvent,
    PlanApprovedEvent,
    PlanCreatedEvent,
    PlanningStartedEvent,
)
from ...tools.integrations.dynamic_agent import DynamicAgentTool
from ...tools.integrations.dynamic_skill import DynamicSkillTool
from ...tools.tool_modes import ToolMode, filter_tools_for_mode
from ..runtime import RuntimeContext
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


def _build_workspace_context(
    api_key: str | None,
    org_id: str | None,
    token_accumulator: TokenAccumulator,
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

    # Log warning if workspace fetch failed or returned empty
    if data.fetch_error:
        logger.warning(
            f"Workspace fetch failed: {data.fetch_error}. "
            "Check NEXTJS_BASE_URL env var and ensure Next.js is running."
        )
    elif data.is_empty():
        logger.warning(
            "Workspace is empty - no databases, apps, agents, skills, or views. "
            "This may indicate a configuration issue or new organization."
        )

    logger.info(
        f"Workspace context: {len(data.databases)} databases, "
        f"{len(data.apps)} apps, {len(data.agents)} agents, "
        f"{len(data.skills)} skills, {len(data.views)} views"
    )

    # Build flat table list from nested databases, enriching with parent db info
    all_tables = []
    for db in data.databases:
        for t in db.tables:
            all_tables.append(
                WorkspaceTable(
                    id=t.id,
                    name=t.name,
                    database_id=db.id,
                    database_name=db.name,
                    field_count=t.field_count,
                    fields=t.fields,
                )
            )

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
    token_accumulator: TokenAccumulator,
    description: str = "",
) -> float:
    """Score a resource's relevance to the task using semantic similarity.

    Uses the same embedding infrastructure as CapabilityRegistry.search().
    Embeddings are LRU-cached (1000 entries) so repeated resource names are free.
    """
    resource_text = f"{name} {description}".strip()
    if not resource_text:
        return 0.0
    resource_embedding = get_embedding(
        resource_text,
        tracker=token_accumulator.get_embedding_tracker(),
    )
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
    token_accumulator: TokenAccumulator,
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
    if not task.strip():
        return workspace

    try:
        task_embedding = get_embedding(
            task,
            tracker=token_accumulator.get_embedding_tracker(),
        )

        # Caps per resource type
        TABLE_CAP = 15
        APP_CAP = 10
        AGENT_CAP = 10
        SKILL_CAP = 10
        VIEW_CAP = 10

        filtered_tables = _top_n_relevant(
            workspace.existing_tables,
            TABLE_CAP,
            lambda t: _score_resource(
                task_embedding,
                t.name,
                token_accumulator,
                " ".join(f.name for f in t.fields),
            ),
        )
        filtered_apps = _top_n_relevant(
            workspace.existing_apps,
            APP_CAP,
            lambda a: _score_resource(
                task_embedding, a.name, token_accumulator, a.description
            ),
        )
        filtered_agents = _top_n_relevant(
            workspace.existing_agents,
            AGENT_CAP,
            lambda a: _score_resource(
                task_embedding, a.name, token_accumulator, a.description
            ),
        )
        filtered_skills = _top_n_relevant(
            workspace.existing_skills,
            SKILL_CAP,
            lambda s: _score_resource(
                task_embedding, s.name, token_accumulator, s.description
            ),
        )
        filtered_views = _top_n_relevant(
            workspace.existing_views,
            VIEW_CAP,
            lambda v: _score_resource(task_embedding, v.name, token_accumulator),
        )

        return WorkspaceContext(
            existing_databases=workspace.existing_databases,  # Always include all
            existing_tables=filtered_tables,
            existing_apps=filtered_apps,
            existing_agents=filtered_agents,
            existing_skills=filtered_skills,
            existing_views=filtered_views,
        )
    except Exception:
        logger.warning(
            "Embedding service unavailable, returning full workspace context"
        )
        return workspace


_DESTRUCTIVE_KEYWORDS = {
    "delete",
    "remove",
    "destroy",
    "drop",
    "truncate",
    "clear",
    "wipe",
    "purge",
}


def _check_plan_conditions(plan: Plan) -> list[str]:
    """Check which auto-approve conditions the plan meets.

    Returns list of condition names that are satisfied.
    """
    met_conditions: list[str] = []

    # single_resource: Plan modifies at most one resource
    # (heuristic: <= 2 steps, or all steps target same entity)
    if len(plan.steps) <= 2:
        met_conditions.append("single_resource")

    # additive_only: No destructive operations
    has_destructive = False
    for step in plan.steps:
        desc_lower = step.description.lower()
        if any(kw in desc_lower for kw in _DESTRUCTIVE_KEYWORDS):
            has_destructive = True
            break
    if not has_destructive:
        met_conditions.append("additive_only")

    # explicit_values: Step descriptions contain explicit values (parentheses with types)
    # e.g., "Add field 'phone' (phone) to table 'contacts'"
    has_explicit = all(
        "(" in step.description and ")" in step.description for step in plan.steps
    )
    if has_explicit:
        met_conditions.append("explicit_values")

    return met_conditions


def _is_low_risk_plan(plan: Plan) -> bool:
    """Check if a plan is low-risk based on auto-approve policy and conditions.

    Auto-approve policies (from PlanningRegistry patterns):
    - "explicit": Always require approval (OAuth, destructive ops)
    - "auto": Auto-approve if ALL required conditions are met
    - "confirm": Default - use heuristics + check conditions

    Low-risk plans can be auto-approved to skip the human approval step.
    """
    policy = plan.auto_approve_policy
    required_conditions = plan.matched_conditions

    # "explicit" policy: ALWAYS require approval
    if policy == "explicit":
        logger.debug(f"Plan {plan.id} requires explicit approval (policy=explicit)")
        return False

    # Check for OAuth connections (always requires approval regardless of policy)
    for step in plan.steps:
        if step.connection_required:
            logger.debug(
                f"Plan {plan.id} requires approval (OAuth connection: {step.connection_required})"
            )
            return False

    # Check for destructive operations
    for step in plan.steps:
        desc_lower = step.description.lower()
        if any(kw in desc_lower for kw in _DESTRUCTIVE_KEYWORDS):
            logger.debug(
                f"Plan {plan.id} requires approval (destructive keyword in step)"
            )
            return False

    # "auto" policy: Auto-approve if ALL required conditions are met
    if policy == "auto":
        if not required_conditions:
            # No conditions specified means unconditional auto-approve
            logger.debug(f"Plan {plan.id} auto-approved (policy=auto, no conditions)")
            return True

        met_conditions = _check_plan_conditions(plan)
        all_met = all(cond in met_conditions for cond in required_conditions)
        if all_met:
            logger.debug(
                f"Plan {plan.id} auto-approved (policy=auto, all conditions met: {met_conditions})"
            )
            return True
        else:
            missing = [c for c in required_conditions if c not in met_conditions]
            logger.debug(
                f"Plan {plan.id} requires approval (policy=auto, missing conditions: {missing})"
            )
            return False

    # "confirm" policy (default): Check conditions as hints, use heuristics
    if policy == "confirm":
        met_conditions = _check_plan_conditions(plan)

        # If required_conditions specified and ALL are met, auto-approve
        if required_conditions and all(
            c in met_conditions for c in required_conditions
        ):
            logger.debug(
                f"Plan {plan.id} auto-approved (policy=confirm, all conditions met: {met_conditions})"
            )
            return True

        # Fallback heuristic: small additive plans with explicit values
        if all(
            c in met_conditions
            for c in ["additive_only", "explicit_values", "single_resource"]
        ):
            logger.debug(
                f"Plan {plan.id} auto-approved (policy=confirm, heuristic: small explicit additive)"
            )
            return True

        logger.debug(
            f"Plan {plan.id} requires approval (policy=confirm, conditions: {met_conditions})"
        )
        return False

    # Unknown policy: require approval
    logger.warning(f"Unknown auto_approve_policy '{policy}', requiring approval")
    return False


async def generate_plan_node(
    state: PlanExecuteState, runtime: RuntimeContext
) -> dict[str, Any]:
    """
    Generate a plan using PlanService.

    Returns plan or clarifying questions.
    """
    task = state.get("task", "")
    if not task:
        logger.error("generate_plan_node called without a task")
        return {
            "error": "No task provided",
            "events": [ErrorEvent(error="No task provided")],
        }

    # Read non-serializable objects from runtime
    tools = runtime.tools
    managed_agents = runtime.managed_agents
    capability_registry = runtime.capability_registry
    conversation_history = runtime.conversation_history

    # Get names of ALL execution tools (including write tools like write_file, bash)
    # Define early so it's available for task enrichment below
    all_execution_tool_names = [
        getattr(t, "name", str(t)) for t in tools if hasattr(t, "name")
    ]

    # Read serializable session config from state
    api_key = state.get("api_key")
    org_id = state.get("org_id")
    org_model = state.get("org_model")
    memory_context = state.get("memory_context") or ""
    triage_analysis = state.get("triage_analysis")
    configured_tools = state.get("configured_tools")

    # === @mention hint enrichment (when triage was skipped) ===
    pre_selected_skill = state.get("pre_selected_skill")
    pre_selected_agent = state.get("pre_selected_agent")
    pre_selected_tool = state.get("pre_selected_tool")

    enriched_task = task
    if pre_selected_skill:
        # Check if we have a loaded skill tool we can use directly
        loaded_skill_tool: DynamicSkillTool | None = None
        for tool in tools:
            if isinstance(tool, DynamicSkillTool):
                loaded_skill_tool = tool
                break

        if loaded_skill_tool:
            # Skill tool is already loaded - tell planner to use it directly
            skill_id = loaded_skill_tool.skill_id
            tool_name = loaded_skill_tool.name
            enriched_task = (
                f"{task}\n\n"
                f"[USER DIRECTIVE: The user selected the '{pre_selected_skill}' skill via @skill mention. "
                f"This skill is ALREADY LOADED as tool '{tool_name}' (skill ID: {skill_id}). "
                f"Use this tool directly in your plan - do NOT use discovery tools to search for it. "
                f"Do NOT execute other skills unless explicitly requested. "
                f"Extract any required inputs from the user's message and conversation context.]"
            )
        else:
            # No loaded skill tool - fall back to discovery then skill:{id}
            enriched_task = (
                f"{task}\n\n"
                f"[USER DIRECTIVE: The user explicitly selected the '{pre_selected_skill}' skill via @skill mention. "
                f"First, use skill_crud(method='list') to find the skill ID. "
                f"Then create a plan step with tool_call='skill:{{id}}' (e.g., skill:30) to execute it. "
                f"The skill:{'{id}'} pattern lazy-loads typed inputs from the skill schema. "
                f"Extract any required inputs from the user's message and conversation context.]"
            )
    elif pre_selected_agent:
        # Check if we have a loaded agent tool
        loaded_agent_tool: DynamicAgentTool | None = None
        for tool in tools:
            if isinstance(tool, DynamicAgentTool):
                loaded_agent_tool = tool
                break

        if loaded_agent_tool:
            agent_id = loaded_agent_tool.agent_id
            tool_name = loaded_agent_tool.name
            enriched_task = (
                f"{task}\n\n"
                f"[USER DIRECTIVE: The user selected the '{pre_selected_agent}' agent via @agent mention. "
                f"This agent is ALREADY LOADED as tool '{tool_name}' (agent ID: {agent_id}). "
                f"Use this tool directly in your plan - do NOT use discovery tools to search for it. "
                f"Pass the user's task to the agent.]"
            )
        else:
            enriched_task = (
                f"{task}\n\n"
                f"[USER DIRECTIVE: The user explicitly selected the '{pre_selected_agent}' agent via @agent mention. "
                f"First, use agent_crud(method='list') to find the agent ID. "
                f"Then create a plan step with tool_call='agent:{{id}}' (e.g., agent:5) to execute it. "
                f"The agent:{'{id}'} pattern lazy-loads the agent with proper context. "
                f"Pass the user's task to the agent.]"
            )
    elif pre_selected_tool:
        enriched_task = (
            f"{task}\n\n"
            f"[USER DIRECTIVE: The user explicitly selected the '{pre_selected_tool}' external tool via @tool mention. "
            f"Build a focused plan that uses this specific tool. Extract the required inputs from the user's message "
            f"and conversation context.]"
        )

    # Add execution tools info so planner knows what tools to set in tool_call field
    # Filter to include only workspace tools (write_file, bash, etc.) - these are the ones
    # the planner needs to explicitly specify since they're not in planning_tools
    workspace_tool_names = [
        name for name in all_execution_tool_names
        if name in ("write_file", "bash", "read_file", "edit_file", "glob_files", "grep_content")
    ]
    if workspace_tool_names:
        enriched_task = (
            f"{enriched_task}\n\n"
            f"[EXECUTION TOOLS: The following workspace tools are available for execution: {', '.join(workspace_tool_names)}. "
            f"When your plan step uses one of these tools, set tool_call to the exact tool name (e.g., tool_call='write_file').]"
        )

    # Construct synthetic triage_analysis when triage was skipped (@mention path)
    if (
        pre_selected_skill or pre_selected_agent or pre_selected_tool
    ) and not triage_analysis:
        mention_name = pre_selected_skill or pre_selected_agent or pre_selected_tool
        mention_type = (
            "skill"
            if pre_selected_skill
            else ("agent" if pre_selected_agent else "tool")
        )
        triage_analysis = {
            "intent": f"Execute {mention_type} '{mention_name}' as requested by user",
            "entities": [mention_name],
            "approach": "step-by-step",
            "external_services": [],
        }

    events: list[Any] = []

    logger.info("Creating plan (planner handles clarification if needed)")
    logger.info(f"Available execution tools: {all_execution_tool_names}")

    # Filter tools to read-only for planning (planner can only CALL these)
    planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)

    # Create external discovery tools for ReAct planner
    # Internal search tools removed - replaced by KNN retrievers called below
    # Exclude workspace_overview — redundant with the static workspace_context below
    if api_key and org_id:
        discovery_tools = create_discovery_tools(api_key, org_id)
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
        if not runtime.token_accumulator:
            raise ValueError("TokenAccumulator is required for planning.")
        full_workspace = _build_workspace_context(
            api_key, org_id, runtime.token_accumulator
        )

    # Filter to task-relevant resources
    if not runtime.token_accumulator:
        raise ValueError("TokenAccumulator is required for planning.")
    workspace_context = _filter_relevant_context(
        full_workspace, task, runtime.token_accumulator
    )

    # === ACE Service: Per-agent strategy accumulation ===
    # Create ACE service for agent workspaces to track execution patterns
    ace_service = None
    if runtime.engine and runtime.workspace_type == "agents" and runtime.workspace_id:
        try:
            workspace_path = runtime.engine.paths.root
            ace_service = StrategyAccumulationService(workspace_path=workspace_path)
            runtime.ace_service = ace_service  # Store for replan node
            logger.debug(f"ACE service created for agent {runtime.workspace_id}")
        except Exception as e:
            logger.warning(f"Failed to create ACE service: {e}")

    # === KNN Retrieval: Get relevant context from registries ===
    # Creates retrievers for available registries and retrieves context
    retrieved_capabilities = ""
    retrieved_patterns = ""
    retrieved_knowledge = ""
    retrieved_strategies = ""

    if org_id and (capability_registry or runtime.planning_registry):
        # Set embedding tracker context so retrievers track to this request
        embedding_tracker = (
            runtime.token_accumulator.get_embedding_tracker()
            if runtime.token_accumulator
            else None
        )
        try:
            with set_current_tracker(embedding_tracker):
                retrievers = get_or_create_retrievers(
                    org_id=org_id,
                    capability_registry=capability_registry,
                    planning_registry=runtime.planning_registry,
                    knowledge_base=runtime.knowledge_base,
                    ace_service=ace_service,  # NOW WIRED
                )

                # Retrieve relevant context for the task
                if "capabilities" in retrievers:
                    caps = retrievers["capabilities"](enriched_task)
                    retrieved_capabilities = retrievers[
                        "capabilities"
                    ].format_for_planner(caps)
                    logger.debug(f"Retrieved {len(caps)} capabilities for planning")

                if "patterns" in retrievers:
                    patterns = retrievers["patterns"](enriched_task)
                    retrieved_patterns = retrievers["patterns"].format_for_planner(
                        patterns
                    )
                    logger.debug(f"Retrieved {len(patterns)} patterns for planning")

                if "knowledge" in retrievers:
                    items = retrievers["knowledge"](enriched_task)
                    retrieved_knowledge = retrievers["knowledge"].format_for_planner(
                        items
                    )
                    logger.debug(f"Retrieved {len(items)} knowledge items for planning")

                if "strategies" in retrievers:
                    strategies = retrievers["strategies"](enriched_task)
                    retrieved_strategies = retrievers["strategies"].format_for_planner(
                        strategies
                    )
                    logger.debug(f"Retrieved {len(strategies)} strategies for planning")

        except Exception as e:
            logger.warning(f"KNN retrieval failed, continuing without: {e}")

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

    # Use workspace-scoped planner from engine
    plan_service = runtime.engine.planner

    try:
        result = await plan_service.generate_plan(
            basic_instructions=enriched_task,
            goal=enriched_task,
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
            triage_analysis=triage_analysis,
            configured_tools=configured_tools,
            token_accumulator=runtime.token_accumulator,
            retrieved_capabilities=retrieved_capabilities,
            retrieved_patterns=retrieved_patterns,
            retrieved_knowledge=retrieved_knowledge,
            retrieved_strategies=retrieved_strategies,
            autonomous_mode=runtime.autonomous_mode,
            discovery_tools=discovery_tools,
        )
    except Exception as e:
        logger.error(f"Plan generation failed: {e}")
        events.append(
            ErrorEvent(error=f"Failed to generate plan: {e}", recoverable=True)
        )
        return {"error": str(e), "events": events}

    # Check if planner needs clarification
    if result.needs_clarification and result.clarifying_questions:
        logger.info(
            f"Planner needs clarification: {len(result.clarifying_questions)} question(s)"
        )
        events.append(
            AwaitingClarificationEvent.from_dict_list(
                questions=result.clarifying_questions,
                reasoning="Need more details to create a specific plan",
            )
        )
        return {
            "clarifying_questions": result.clarifying_questions,
            "awaiting_input": "clarification",
            "events": events,
        }

    plan = result.plan
    if plan is None:
        logger.error("Plan generation returned no plan and no questions")
        events.append(
            ErrorEvent(
                error="Plan generation failed: no plan returned", recoverable=True
            )
        )
        return {"error": "No plan returned", "events": events}

    # Emit planning started only when a real plan was created (not for greetings/clarification)
    task_summary = task[:200] if len(task) > 200 else task
    events.append(PlanningStartedEvent(goal=task_summary))

    # Create task ledger from plan
    ledger = create_ledger_from_plan(
        task_id=plan.id,
        goal=task,
        plan_steps=[
            {"step_id": s.step_id, "description": s.description} for s in plan.steps
        ],
    )
    ledger.record_plan_created({"plan_id": plan.id, "step_count": len(plan.steps)})

    # Save plan to filesystem
    if runtime.engine and plan:
        try:
            runtime.engine.plans.save(plan)
        except Exception as e:
            logger.warning(f"Failed to save plan to filesystem: {e}")

    # Auto-approve when:
    # 1. autonomous_mode is True (task API - always auto-approve)
    # 2. OR plan is low-risk (interactive but simple plan)
    # Skip auto-approve for template generation — the GeneratePlan RPC expects PlanCreatedEvent
    should_auto_approve = (
        runtime.autonomous_mode or _is_low_risk_plan(plan)
    ) and not is_template_generation

    if should_auto_approve:
        reason = "autonomous_mode" if runtime.autonomous_mode else "low-risk"
        logger.info(f"Plan {plan.id} auto-approved ({reason}, {len(plan.steps)} steps)")
        approved_plan = plan.approve().start_execution()
        ledger.record_plan_approved()
        # Skip PlanCreatedEvent for auto-approved plans — it triggers approval UI flicker
        events.append(PlanApprovedEvent(plan_id=plan.id))
        return {
            "plan": approved_plan,
            "ledger": ledger,
            "auto_approved": True,
            "awaiting_input": None,
            "events": events,
        }

    # Non-auto-approved: emit PlanCreatedEvent so frontend shows approval UI
    events.append(PlanCreatedEvent(plan_id=plan.id, plan=plan))
    logger.info(
        f"Plan {plan.id} created with {len(plan.steps)} steps, awaiting approval"
    )
    return {
        "plan": plan,
        "ledger": ledger,
        "awaiting_input": "approval",
        "events": events,
    }
