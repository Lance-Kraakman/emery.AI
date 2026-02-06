"""
DSPy Plan Generator

Generates plans using DSPy modules instead of smolagents.

AIDEV-NOTE: This is the DSPy-based replacement for plan_generator.py.
It uses declarative signatures and automatic prompt optimization
instead of Jinja2 templates and manual prompt engineering.

Benefits:
- Typed I/O contracts (no manual TOON parsing)
- Automatic prompt optimization with BootstrapFewShot/MIPROv2
- ChainOfThought reasoning built-in
- Cleaner separation between logic and prompts
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional, TYPE_CHECKING

import dspy

from emery_agents.ace import StrategyAccumulationService
from emery_agents.reasoning.capabilities import (
    CAPABILITY_ROUTING_HEADER,
    format_planning_guidance,
    get_planning_guidance,
)
from emery_agents.reasoning.config import get_dspy_lm
from emery_agents.services.analysis.llm_usage import record_from_lm
from emery_agents.reasoning.modules.planner import PlannerModule, SkillTemplatePlannerModule
from emery_agents.reasoning.signatures.planning import (
    ClarifyingQuestionOutput,
    PlanOutput,
    PlanOrQuestionsOutput,
    SkillTemplatePlanOutput,
)
from emery_agents.entities.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.services.context import WorkspaceContext, format_conversation_history
from emery_agents.services.protocols import Tool

if TYPE_CHECKING:
    from emery_agents.services.context import ConversationMessage

from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from .models import PlanGenerationRequest, PlanGenerationResult

logger = logging.getLogger(__name__)


class DSPyPlanGenerator:
    """
    Generates plans using DSPy modules.

    Replaces the smolagents-based PlanGenerator with DSPy:
    - PlannerModule with ChainOfThought for plan generation
    - Typed Pydantic outputs instead of dict/TOON parsing
    - ACE strategy patterns as input field

    The generator:
    1. Configures DSPy with the appropriate model
    2. Formats workspace context for the signature
    3. Calls PlannerModule
    4. Converts DSPy output to PlanGenerationResult
    """

    def __init__(
        self,
        discovery_tools: Optional[list["Tool"]] = None,
    ) -> None:
        self.discovery_tools = discovery_tools or []
        self._last_strategy_guidance: str = ""

        # Initialize planner modules (will be configured with model on each call)
        self._planner: Optional[PlannerModule] = None
        self._template_planner: Optional[SkillTemplatePlannerModule] = None

    def _get_planner(self) -> PlannerModule:
        """Get or create planner module."""
        if self._planner is None:
            self._planner = PlannerModule(discovery_tools=self.discovery_tools)
        return self._planner

    def _get_template_planner(self) -> SkillTemplatePlannerModule:
        """Get or create skill template planner module."""
        if self._template_planner is None:
            self._template_planner = SkillTemplatePlannerModule(discovery_tools=self.discovery_tools)
        return self._template_planner

    async def generate(
        self,
        request: PlanGenerationRequest,
        strategy_service: Optional[StrategyAccumulationService] = None,
    ) -> PlanGenerationResult:
        """Generate plan using DSPy PlannerModule. Returns plan or clarifying questions."""
        # ACE: Get strategy guidance from past successful executions
        strategy_guidance = ""
        if strategy_service:
            strategies = strategy_service.get_relevant_strategies(
                goal=request.basic_instructions,
                max_results=3,
                min_confidence=0.3,
            )
            if strategies:
                strategy_guidance = strategy_service.format_for_planner(strategies)
                logger.info(f"📊 Found {len(strategies)} relevant strategies for planning")

        self._last_strategy_guidance = strategy_guidance

        # Get model from config
        org_model = request.config.org_model if request.config else None

        # Get DSPy LM without calling configure (safe for async)
        lm = get_dspy_lm(org_model=org_model)

        # Route to appropriate module based on template generation mode
        if request.is_template_generation and request.skill_inputs:
            return await self._generate_template(request, lm, strategy_guidance)
        else:
            return await self._generate_plan(request, lm, strategy_guidance)

    async def _generate_plan(
        self,
        request: PlanGenerationRequest,
        lm: Any,
        strategy_guidance: str,
    ) -> PlanGenerationResult:
        """Generate regular plan using PlannerModule."""
        logger.info("📋 Generating plan using DSPy PlannerModule")

        planner = self._get_planner()
        workspace_context = self._format_workspace_context(request.workspace)
        capability_guidance = self._get_capability_guidance(request)
        conversation_history = format_conversation_history(request.conversation_history)

        try:
            with dspy.context(lm=lm):
                result: PlanOrQuestionsOutput = planner(
                    request=request.basic_instructions,
                    workspace_context=workspace_context,
                    capability_guidance=capability_guidance,
                    proven_strategies=strategy_guidance,
                    conversation_history=conversation_history,
                    memory_context=request.memory_context,
                    triage_analysis=request.triage_analysis,
                    configured_tools=request.configured_tools_json,
                )
            record_from_lm(lm, request.token_accumulator.get_llm_tracker())
        except Exception as e:
            logger.error(f"DSPy planning failed: {e}")
            raise

        # Handle clarifying questions
        if result.questions:
            logger.info(f"❓ DSPy planner returned {len(result.questions)} clarifying question(s)")
            return PlanGenerationResult(
                plan=None,
                strategy_guidance=strategy_guidance,
                clarifying_questions=self._convert_questions(result.questions),
            )

        # Handle plan output
        if result.plan:
            plan = self._convert_plan(
                dspy_plan=result.plan,
                basic_instructions=request.basic_instructions,
            )
            return PlanGenerationResult(
                plan=plan,
                strategy_guidance=strategy_guidance,
            )

        # Neither plan nor questions - shouldn't happen
        raise ValueError("DSPy planner returned neither plan nor questions")

    async def _generate_template(
        self,
        request: PlanGenerationRequest,
        lm: Any,
        strategy_guidance: str,
    ) -> PlanGenerationResult:
        """Generate skill template using SkillTemplatePlannerModule."""
        logger.info("📋 Generating skill template using SkillTemplatePlannerModule")

        template_planner = self._get_template_planner()
        workspace_context = self._format_workspace_context(request.workspace)
        capability_guidance = self._get_capability_guidance(request)
        conversation_history = format_conversation_history(request.conversation_history)

        # Convert skill inputs/outputs to dicts for the module
        skill_inputs = [
            {"name": i.name, "type": i.type, "required": i.required}
            for i in request.skill_inputs
        ]
        skill_outputs = [
            {"name": o.name, "type": o.type}
            for o in (request.skill_outputs or [])
        ]

        try:
            with dspy.context(lm=lm):
                template_plan: SkillTemplatePlanOutput = template_planner(
                    request=request.basic_instructions,
                    workspace_context=workspace_context,
                    capability_guidance=capability_guidance,
                    proven_strategies=strategy_guidance,
                    conversation_history=conversation_history,
                    skill_inputs=skill_inputs,
                    skill_outputs=skill_outputs,
                    configured_tools=request.configured_tools_json,
                )
            record_from_lm(lm, request.token_accumulator.get_llm_tracker())
        except Exception as e:
            logger.error(f"DSPy template planning failed: {e}")
            raise

        plan = self._convert_template_plan(template_plan, request.basic_instructions)
        return PlanGenerationResult(plan=plan, strategy_guidance=strategy_guidance)

    def _format_workspace_context(
        self,
        workspace: Optional[WorkspaceContext],
    ) -> str:
        """Format workspace context as slim summary for DSPy signature.

        Produces names + field names only — NOT full field schemas (types, constraints).
        The planner should use system_research(resource_type='tables', query='<name>',
        include_details=True) to look up field types when needed.

        Field names are included because the template planner (ChainOfThought, no tools)
        cannot call system_research. Names alone are enough for most planning decisions.
        """
        if not workspace:
            return json.dumps({"_summary": "Empty workspace — no existing resources", "resources": []})

        resources: list[dict[str, Any]] = []

        def _table_entry(t: Any) -> dict[str, Any]:
            entry: dict[str, Any] = {"name": t.name, "id": str(t.id), "field_count": t.field_count}
            if t.fields:
                entry["fields"] = [f.name for f in t.fields]
            return entry

        for db in workspace.existing_databases:
            tables = []
            for t in (workspace.existing_tables or []):
                if t.database_id == db.id:
                    tables.append(_table_entry(t))
            resources.append({"type": "database", "name": db.name, "id": str(db.id), "tables": tables})

        # Include tables not in any database (edge case)
        db_ids = {db.id for db in workspace.existing_databases}
        for t in (workspace.existing_tables or []):
            if t.database_id not in db_ids:
                resources.append({"type": "table", **_table_entry(t)})

        for app in workspace.existing_apps:
            page_names = [p.name for p in app.pages]
            resources.append({"type": "app", "name": app.name, "id": str(app.id), "pages": page_names})

        for agent in workspace.existing_agents:
            resources.append({"type": "agent", "name": agent.name, "id": str(agent.id)})

        for skill in workspace.existing_skills:
            resources.append({
                "type": "skill", "name": skill.name, "id": str(skill.id),
                "agent_id": str(skill.agent_id) if skill.agent_id else None,
            })

        for view in workspace.existing_views:
            resources.append({
                "type": "view", "name": view.name, "id": str(view.id),
                "view_type": view.view_type,
            })

        summary = workspace.resource_summary()
        return json.dumps({
            "_summary": f"{summary}. Use system_research for field details.",
            "resources": resources,
        }, indent=2, default=str)

    def _get_capability_guidance(
        self,
        request: PlanGenerationRequest,
    ) -> str:
        """Get capability planning guidance for the planner using semantic search.

        Uses multi-factor matching: semantic search (top 3) filtered to enabled,
        with the routing header always included. Falls back to all guidance if
        no registry is available.

        Matched capability guidance includes tool mappings and step description
        templates — these are the primary instructions for writing executor-ready steps.
        """
        # Fallback: no registry means return all guidance (includes routing header)
        if not request.capability_registry:
            logger.warning("capability_registry missing in request — returning all guidance (this shouldn't happen)")
            return format_planning_guidance()

        org_id = request.config.org_id if request.config else None

        try:
            # Semantic search: top 3 most relevant capabilities
            matched = request.capability_registry.search(
                query=request.basic_instructions,
                limit=3,
            )

            # Filter to enabled only
            if org_id:
                enabled_ids = {
                    cap.id for cap in request.capability_registry.get_enabled(org_id)
                }
                matched = [cap for cap in matched if cap.id in enabled_ids]

            # Get guidance for matched capabilities
            guidance_parts = []
            for cap in matched:
                g = get_planning_guidance(cap.id)
                if g:
                    guidance_parts.append(g)

            if guidance_parts:
                logger.info(
                    f"Matched {len(matched)} capabilities for guidance: "
                    f"{[c.id for c in matched]}"
                )
                # Capability guidance first (step templates + tool mappings), routing header second
                return "\n\n".join(guidance_parts) + "\n\n" + CAPABILITY_ROUTING_HEADER

        except Exception as e:
            logger.warning(f"Capability search failed, using all guidance: {e}")

        # Fallback: return all guidance (includes routing header)
        return format_planning_guidance()

    def _convert_questions(
        self,
        dspy_questions: list[ClarifyingQuestionOutput],
    ) -> list[dict[str, Any]]:
        """Convert DSPy ClarifyingQuestionOutput to dict format for compatibility."""
        return [
            {
                "question": q.question,
                "question_type": q.question_type,
                "options": q.options,
                "reason": q.reason,
            }
            for q in dspy_questions
        ]

    def _convert_plan(
        self,
        dspy_plan: PlanOutput,
        basic_instructions: str,
    ) -> Plan:
        """Convert DSPy Plan to the existing Plan model."""
        # Convert steps
        steps: list[PlanStep] = []
        for dspy_step in dspy_plan.steps:
            step = create_step(
                description=dspy_step.description,
                prompt_template=dspy_step.prompt_template,
                required_context=dspy_step.required_context,
                connection_required=dspy_step.connection_required,
                phase_name=dspy_step.phase_name,
                phase_order=dspy_step.phase_order,
                replan_after=dspy_step.replan_after,
            )
            steps.append(step)

        return create_plan(
            goal=dspy_plan.goal,
            basic_instructions=basic_instructions,
            steps=steps,
            context=dspy_plan.context,
            analysis=dspy_plan.analysis,
        )

    def _convert_template_plan(
        self,
        template_plan: SkillTemplatePlanOutput,
        basic_instructions: str,
    ) -> Plan:
        """Convert SkillTemplatePlanOutput to Plan model."""
        steps: list[PlanStep] = []
        for s in template_plan.steps:
            step = create_step(
                description=s.description,
                tool_call=s.tool_call,
                parameters=s.parameters,
                prompt_template=s.prompt_template,
                required_context=s.required_context,
                connection_required=s.connection_required,
                phase_name=s.phase_name,
                phase_order=s.phase_order,
                replan_after=s.replan_after,
            )
            steps.append(step)

        return create_plan(
            goal=template_plan.goal,
            basic_instructions=basic_instructions,
            steps=steps,
            context=template_plan.context,
            analysis=template_plan.analysis,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._last_strategy_guidance
