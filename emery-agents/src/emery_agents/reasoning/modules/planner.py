"""
DSPy Planner Module.

This module handles plan generation using DSPy's ChainOfThought strategy.
It replaces the Jinja2-based planning templates.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

logger = logging.getLogger(__name__)

from emery_agents.reasoning.examples.planning import PLANNING_DEMOS
from emery_agents.reasoning.signatures.planning import (
    AnalyzeTask,
    CreatePlan,
    CreateSkillTemplate,
    PlanOrQuestionsOutput,
    PlanReflection,
    ReflectOnPlan,
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
)


class PlannerModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for creating execution plans using ReAct.

    Two LLM calls:
    1. AnalyzeTask — understand intent, approach, external services
    2. ReAct(CreatePlan) — generate plan with discovery tool access

    Each input field to the planner has one clear purpose:
    - request: what the user wants
    - workspace_context: what already exists
    - capability_guidance: routing table + matched capability instructions
    - proven_strategies: what worked before (ACE)
    - task_analysis: pre-analyzed intent, approach, external service hints
    """

    # Phrases that indicate user wants us to propose defaults
    DELEGATION_PHRASES = [
        "what do you think",
        "you decide",
        "typical",
        "standard",
        "whatever you think",
        "up to you",
        "your choice",
        "default",
        "usual",
        "common",
    ]

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """
        Initialize the planner module.

        Args:
            discovery_tools: dspy.Tool instances for dynamic discovery during planning
                           (e.g., system_research, search_capabilities, search_external).
                           ReAct with no tools behaves like ChainOfThought.
        """
        super().__init__()
        self.analyzer = dspy.ChainOfThought(AnalyzeTask)
        self.discovery_tools = discovery_tools or []
        self.planner = dspy.ReAct(
            CreatePlan, tools=self.discovery_tools, max_iters=8, demos=PLANNING_DEMOS
        )
        # Reflexion module for extended thinking - critiques and improves plans
        self.reflector = dspy.ChainOfThought(ReflectOnPlan)

    def forward(
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str,
        proven_strategies: str,
        conversation_history: str = "",
        memory_context: str = "",
        triage_analysis: dict[str, Any] | None = None,
        configured_tools: str = "",
    ) -> PlanOrQuestionsOutput:
        """
        Generate a plan or clarifying questions for a user request.

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            capability_guidance: Routing table + matched capability instructions
            proven_strategies: ACE patterns for similar goals
            conversation_history: Formatted previous messages for context continuity
            memory_context: Relevant memories from previous interactions
            triage_analysis: Pre-computed analysis from triage node (intent, entities,
                           approach, external_services). If provided, skips AnalyzeTask call.

        Returns:
            PlanOrQuestionsOutput with either a plan or clarifying questions
        """
        has_delegation = self._has_delegation_phrase(request)

        # Use pre-computed triage analysis if available, otherwise run AnalyzeTask
        if triage_analysis and triage_analysis.get("intent"):
            analysis_data = triage_analysis
        else:
            # Fallback: run separate AnalyzeTask when no triage analysis available
            analysis = self.analyzer(
                request=request,
                context=workspace_context,
            )
            analysis_data = {
                "intent": analysis.intent,
                "domain": str(analysis.domain),
                "entities": analysis.entities or [],
                "approach": analysis.approach,
                "external_services": analysis.external_services or [],
            }

        # Build combined planning_context from analysis + auxiliary fields
        planning_context = self._build_planning_context(
            analysis_data=analysis_data,
            proven_strategies=proven_strategies,
            memory_context=memory_context,
            has_delegation=has_delegation,
        )

        # Call planner with consolidated fields
        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            capability_guidance=capability_guidance,
            planning_context=planning_context,
            conversation_history=conversation_history,
            configured_tools=configured_tools,
        )

        plan_result = result.result

        # Reflexion loop (max 2 iterations) - like extended thinking
        # Critiques the plan and triggers re-planning if improvements needed
        for iteration in range(2):
            if plan_result.plan is None:
                # Questions returned, user needs to answer - skip reflexion
                break

            reflection = self.reflector(
                request=request,
                draft_plan=plan_result.plan.model_dump_json(),
                research_done="(research performed during ReAct planning)",
                workspace_context=workspace_context,
            )

            if not reflection.reflection.should_iterate:
                # Plan is ready for user
                logger.debug(
                    f"Plan ready after iteration {iteration}: "
                    f"quality={reflection.reflection.quality_score}"
                )
                break

            # Plan needs improvement - re-run planner with reflection context
            logger.info(
                f"Reflexion iteration {iteration + 1}: {reflection.reflection.critique}"
            )

            # Add reflection to planning context for next iteration
            reflection_context = (
                f"\n\n## Reflection (Iteration {iteration + 1})\n"
                f"Critique: {reflection.reflection.critique}\n"
                f"Missing info: {', '.join(reflection.reflection.missing_info)}\n"
                f"Suggested improvements: {reflection.reflection.suggested_improvements}"
            )

            result = self.planner(
                request=request,
                workspace_context=workspace_context,
                capability_guidance=capability_guidance,
                planning_context=planning_context + reflection_context,
                conversation_history=conversation_history,
                configured_tools=configured_tools,
            )
            plan_result = result.result

        self._ensure_valid_output(plan_result)

        return plan_result  # type: ignore[no-any-return]

    @staticmethod
    def _build_planning_context(
        analysis_data: dict[str, Any],
        proven_strategies: str,
        memory_context: str,
        has_delegation: bool,
    ) -> str:
        """Build merged planning_context from task analysis and auxiliary fields.

        Combines task analysis, proven strategies, memory context, and delegation
        hints into a single labeled string. Empty sections are omitted to reduce noise.
        """
        sections: list[str] = []

        # Task analysis (always present)
        external_services = analysis_data.get("external_services", [])
        external_hint = ""
        if external_services:
            services_str = ", ".join(external_services)
            external_hint = f"\nExternal services: {services_str} (call search_external to discover actions)"

        entities = analysis_data.get("entities", [])
        entities_str = ", ".join(entities) if entities else ""

        sections.append(
            f"## Task Analysis\n"
            f"Intent: {analysis_data.get('intent', '')}\n"
            f"Domain: {analysis_data.get('domain', '')}\n"
            f"Entities: {entities_str}\n"
            f"Approach: {analysis_data.get('approach', '')}"
            f"{external_hint}"
        )

        # Proven strategies (only if non-empty)
        if proven_strategies and proven_strategies.strip():
            sections.append(f"## Proven Strategies\n{proven_strategies}")

        # Memory context (only if non-empty)
        if memory_context and memory_context.strip():
            sections.append(f"## Background Memory\n{memory_context}")

        # Delegation hint
        if has_delegation:
            sections.append(
                "## Delegation\nUser delegated decisions — propose sensible defaults, do not ask questions."
            )

        return "\n\n".join(sections)

    def _has_delegation_phrase(self, request: str) -> bool:
        """Check if the request contains phrases indicating user wants us to decide."""
        normalized = request.lower()
        return any(phrase in normalized for phrase in self.DELEGATION_PHRASES)

    def _ensure_valid_output(self, result: PlanOrQuestionsOutput) -> None:
        """
        Ensure the planner returned a valid output.

        If neither plan nor questions were produced (e.g., ReAct extraction
        failed), fall back to asking a clarifying question instead of crashing.
        """
        if result.plan is not None:
            if len(result.plan.steps) == 0:
                raise ValueError("Plan must have at least one step")
            return

        if result.questions is not None and len(result.questions) > 0:
            return

        # Neither plan nor questions — ReAct likely failed (invalid tool call, etc.)
        raise ValueError(
            "Planner produced neither a plan nor clarifying questions. "
            "This usually means the ReAct trajectory failed (e.g., LLM tried to call "
            "a non-existent tool). Check logs for DSPy ReAct errors."
        )


class SkillTemplatePlannerModule(PlannerModule):
    """DSPy module for creating skill templates with {{ variable }} placeholders.

    Extends PlannerModule to inherit shared logic:
    - _has_delegation_phrase()
    - Discovery tools handling
    """

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """Initialize the skill template planner module.

        Args:
            discovery_tools: List of tools available during planning phase
        """
        super().__init__(discovery_tools=discovery_tools)
        # ReAct with discovery tools so the template planner can call system_research
        self.template_planner = dspy.ReAct(
            CreateSkillTemplate, tools=self.discovery_tools, max_iters=5
        )

    def forward(  # type: ignore[override]
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str,
        proven_strategies: str,
        conversation_history: str,
        skill_inputs: list[dict[str, Any]],
        skill_outputs: list[dict[str, Any]],
        configured_tools: str = "",
    ) -> SkillTemplatePlanOutput:
        """Generate skill template plan.

        Args:
            request: What the skill should accomplish
            workspace_context: JSON of existing resources
            capability_guidance: When to use each capability
            proven_strategies: ACE patterns
            conversation_history: Previous messages
            skill_inputs: List of {name, type, required}
            skill_outputs: List of {name, type}

        Returns:
            SkillTemplatePlanOutput with steps containing prompt_template
        """
        # Build template-specific guidance (adds template rules to base guidance)
        template_guidance = self._build_template_guidance(capability_guidance)

        # Convert to typed specs
        input_specs = [SkillInputSpec(**inp) for inp in skill_inputs]
        output_specs = [SkillOutputSpec(**out) for out in skill_outputs]

        result = self.template_planner(
            request=request,
            workspace_context=workspace_context,
            capability_guidance=template_guidance,
            proven_strategies=proven_strategies,
            conversation_history=conversation_history,
            skill_inputs=input_specs,
            skill_outputs=output_specs,
            configured_tools=configured_tools,
        )

        plan = result.result
        self._validate_template_syntax(plan, skill_inputs)
        return plan  # type: ignore[no-any-return]

    def _build_template_guidance(self, base_guidance: str) -> str:
        """Add template-specific guidance to capability guidance."""
        template_rules = """
TEMPLATE MODE - Creating a REUSABLE skill template.

FORBIDDEN - Never generate these patterns in goal, analysis, or description:
- "Create a skill that..." or "This skill..."
- "takes input X and returns/outputs Y" or "assigns X to Y"
- "returns the value of X as Y"
- "No external tools or databases are required"
- Any text that just describes the input-to-output mapping

Focus goal/analysis/description on the TASK PURPOSE, not on explaining I/O mechanics.

PRESERVE USER'S RULES:
- Copy conditional logic from request: "if X then Y" -> {% if X %}Y{% endif %}
- Do NOT summarize - preserve verbatim

VARIABLE SYNTAX:
- Use {{ name }} in text and inside {% if %} blocks
- description: Brief summary, {{ }} OK, NO {% if %}
- prompt_template: Full logic with {% if %} for conditionals
"""
        return f"{template_rules}\n\n{base_guidance}"

    def _validate_template_syntax(
        self,
        plan: SkillTemplatePlanOutput,
        skill_inputs: list[dict[str, Any]],
    ) -> None:
        """Validate template plan has required prompt_template.

        Checks:
        - prompt_template is present
        - Warns if inputs provided but no {{ }} found
        """
        for step in plan.steps:
            if not step.prompt_template:
                raise ValueError(
                    f"Step {step.step_id} missing required prompt_template"
                )

            # Warn if no {{ }} but inputs provided
            if skill_inputs and "{{" not in step.prompt_template:
                logger.warning(
                    f"Step {step.step_id} has inputs but no {{{{ }}}} in prompt_template"
                )
