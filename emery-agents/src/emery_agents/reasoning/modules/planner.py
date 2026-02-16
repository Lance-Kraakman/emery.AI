"""
DSPy Planner Module.

This module handles plan generation using DSPy's ChainOfThought or ReAct.

Two planner modes:
- Standard: ChainOfThought with all context retrieved upfront via KNN retrievers
- Complex: ReAct with external tools (workspace_overview, search_external, web_search)

TOOL_EXAMPLES are NOT used here - they belong in the Executor which actually calls
execution tools. The Planner only needs PLANNING_DEMOS to learn plan structure.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy
from dspy import LabeledFewShot

from emery_agents.reasoning.examples.planning import (
    AUTONOMOUS_PLANNING_DEMOS,
    PLANNING_DEMOS,
)
from emery_agents.reasoning.examples.skill_templates import SKILL_TEMPLATE_DEMOS
from emery_agents.reasoning.signatures.planning import (
    AnalyzeTask,
    CreatePlan,
    CreatePlanAutonomous,
    TriageAnalysis,
    CreateSkillTemplate,
    PlanOrQuestionsOutput,
    PlanOutput,
    PlanReflection,
    ReflectOnPlan,
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
)

logger = logging.getLogger(__name__)


class PlannerModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for creating execution plans using ReAct.

    Two LLM calls:
    1. AnalyzeTask — understand intent, approach, external services
    2. ReAct(CreatePlan) — generate plan with discovery tool access

    Each input field to the planner has one clear purpose:
    - request: what the user wants
    - workspace_context: what already exists
    - planning_context: retrieved capabilities, patterns, strategies, task analysis
    - proven_strategies: what worked before (ACE)
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

    def __init__(self, external_tools: list[Any] | None = None) -> None:
        """
        Initialize the planner module with standard and complex planners.

        Args:
            external_tools: dspy.Tool instances for EXTERNAL data only:
                           workspace_overview, system_research, search_external, web_search.
                           These are NOT execution tools (table_crud, etc.) - those go to Executor.
                           Internal search tools (search_capabilities, search_planning_patterns)
                           are replaced by KNN retrievers called before planning.
        """
        super().__init__()
        self.analyzer = dspy.ChainOfThought(AnalyzeTask)
        self.external_tools = external_tools or []

        # Standard planner: ChainOfThought (no tools)
        # Used when all context is retrieved upfront via KNN retrievers
        # LabeledFewShot injects demos without bootstrap overhead (unlike KNNFewShot)
        base_standard = dspy.ChainOfThought(CreatePlan)
        self.standard_planner = LabeledFewShot(k=5).compile(
            base_standard, trainset=PLANNING_DEMOS
        )

        # Complex planner: ReAct with external tools only
        # Used when planning needs external data (workspace API, pipedream, web)
        base_complex = dspy.ReAct(
            CreatePlan, tools=self.external_tools, max_iters=4
        )
        self.complex_planner = LabeledFewShot(k=5).compile(
            base_complex, trainset=PLANNING_DEMOS
        )

        # Reflexion module for extended thinking - critiques and improves plans
        self.reflector = dspy.ChainOfThought(ReflectOnPlan)

        # Autonomous planners: use CreatePlanAutonomous (no questions allowed)
        # These planners output PlanOutput directly, not PlanOrQuestionsOutput
        # Use AUTONOMOUS_PLANNING_DEMOS which have PlanOutput structure (not wrapped)
        base_autonomous = dspy.ChainOfThought(CreatePlanAutonomous)
        self.autonomous_planner = LabeledFewShot(k=5).compile(
            base_autonomous, trainset=AUTONOMOUS_PLANNING_DEMOS
        )

        base_autonomous_complex = dspy.ReAct(
            CreatePlanAutonomous, tools=self.external_tools, max_iters=4
        )
        self.autonomous_complex_planner = LabeledFewShot(k=5).compile(
            base_autonomous_complex, trainset=AUTONOMOUS_PLANNING_DEMOS
        )

    def forward(
        self,
        request: str,
        workspace_context: str,
        proven_strategies: str,
        conversation_history: str = "",
        memory_context: str = "",
        triage_analysis: TriageAnalysis | None = None,
        configured_tools: str = "",
        retrieved_capabilities: str = "",
        retrieved_patterns: str = "",
        retrieved_knowledge: str = "",
        retrieved_strategies: str = "",
        graph_context: str = "",
        use_complex_planner: bool = False,
        autonomous_mode: bool = False,
    ) -> PlanOrQuestionsOutput:
        """
        Generate a plan or clarifying questions for a user request.

        Routes between standard (ChainOfThought) and complex (ReAct) planners:
        - Standard: All context retrieved upfront via KNN retrievers, no tools needed
        - Complex: Needs external data during planning (workspace API, pipedream, web)

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            proven_strategies: ACE patterns for similar goals (legacy, prefer retrieved_strategies)
            conversation_history: Formatted previous messages for context continuity
            memory_context: Relevant memories from previous interactions
            triage_analysis: Pre-computed analysis from triage node (intent, entities,
                           approach, external_services). If provided, skips AnalyzeTask call.
            configured_tools: JSON of configured tool names
            retrieved_capabilities: Formatted capabilities from CapabilityRetriever
            retrieved_patterns: Formatted patterns from PatternRetriever
            retrieved_knowledge: Formatted knowledge from KnowledgeRetriever
            retrieved_strategies: Formatted strategies from StrategyRetriever
            graph_context: Formatted related records from GraphRetriever
            use_complex_planner: Force ReAct planner for external tool access

        Returns:
            PlanOrQuestionsOutput with either a plan or clarifying questions
        """
        # Autonomous mode (gRPC Tasks) forces delegation to skip clarifying questions
        has_delegation = autonomous_mode or self._has_delegation_phrase(request)

        # Use pre-computed triage analysis if available, otherwise run AnalyzeTask
        if triage_analysis and triage_analysis.intent:
            analysis_data = triage_analysis.model_dump()
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

        # Build combined planning_context from analysis + retrieved context
        planning_context = self._build_planning_context(
            analysis_data=analysis_data,
            proven_strategies=proven_strategies,
            memory_context=memory_context,
            has_delegation=has_delegation,
            retrieved_capabilities=retrieved_capabilities,
            retrieved_patterns=retrieved_patterns,
            retrieved_knowledge=retrieved_knowledge,
            retrieved_strategies=retrieved_strategies,
            graph_context=graph_context,
        )

        # Route to appropriate planner
        # Use complex planner if:
        # 1. Explicitly requested via use_complex_planner
        # 2. External services detected in triage (needs search_external for tool details)
        # 3. We have external tools configured
        external_services = analysis_data.get("external_services", [])
        needs_external_data = (
            use_complex_planner
            or bool(external_services)
            or bool(self.external_tools)
        )

        # Route to autonomous planners when autonomous_mode=True
        # These use CreatePlanAutonomous signature which outputs PlanOutput directly
        if autonomous_mode:
            planner = (
                self.autonomous_complex_planner
                if needs_external_data
                else self.autonomous_planner
            )
            logger.debug(
                f"Using autonomous {'complex' if needs_external_data else 'standard'} planner "
                f"(no questions allowed)"
            )
        else:
            planner = self.complex_planner if needs_external_data else self.standard_planner
            logger.debug(
                f"Using {'complex' if needs_external_data else 'standard'} planner "
                f"(external_services={external_services})"
            )

        # Call planner with consolidated fields
        result = planner(
            request=request,
            workspace_context=workspace_context,
            planning_context=planning_context,
            conversation_history=conversation_history,
            configured_tools=configured_tools,
        )

        # Handle result type based on planner used
        if autonomous_mode:
            # Autonomous planners return PlanOutput directly - wrap for consistency
            plan_output: PlanOutput = result.result
            plan_result = PlanOrQuestionsOutput(plan=plan_output, questions=None)
            # Skip reflexion for autonomous mode - already made sensible defaults
            self._ensure_valid_output(plan_result)
            return plan_result

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

            result = planner(
                request=request,
                workspace_context=workspace_context,
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
        retrieved_capabilities: str = "",
        retrieved_patterns: str = "",
        retrieved_knowledge: str = "",
        retrieved_strategies: str = "",
        graph_context: str = "",
    ) -> str:
        """Build merged planning_context from task analysis and retrieved context.

        Combines:
        - Task analysis (from triage)
        - Retrieved capabilities (from CapabilityRetriever)
        - Retrieved patterns (from PatternRetriever)
        - Retrieved knowledge (from KnowledgeRetriever)
        - Retrieved strategies (from StrategyRetriever, preferred over proven_strategies)
        - Graph context (from GraphRetriever - related records)
        - Memory context
        - Delegation hint

        Empty sections are omitted to reduce noise.
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

        # Retrieved capabilities (from KNN retriever)
        if retrieved_capabilities and retrieved_capabilities.strip():
            sections.append(retrieved_capabilities)

        # Retrieved patterns (from KNN retriever)
        if retrieved_patterns and retrieved_patterns.strip():
            sections.append(retrieved_patterns)

        # Retrieved knowledge (from KNN retriever)
        if retrieved_knowledge and retrieved_knowledge.strip():
            sections.append(retrieved_knowledge)

        # Retrieved strategies (from KNN retriever, preferred over proven_strategies)
        if retrieved_strategies and retrieved_strategies.strip():
            sections.append(retrieved_strategies)
        elif proven_strategies and proven_strategies.strip():
            # Fallback to legacy proven_strategies if no retrieved_strategies
            sections.append(f"## Proven Strategies\n{proven_strategies}")

        # Graph context (from GraphRetriever - related records)
        if graph_context and graph_context.strip():
            sections.append(graph_context)

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
    - External tools handling
    """

    def __init__(self, external_tools: list[Any] | None = None) -> None:
        """Initialize the skill template planner module.

        Args:
            external_tools: External tools for workspace/integration discovery
        """
        super().__init__(external_tools=external_tools)

        # Create base template planner with ReAct for tool use
        base_template_planner = dspy.ReAct(
            CreateSkillTemplate, tools=self.external_tools, max_iters=5
        )

        # LabeledFewShot injects demos without bootstrap overhead (unlike KNNFewShot)
        self.template_planner = LabeledFewShot(k=3).compile(
            base_template_planner, trainset=SKILL_TEMPLATE_DEMOS
        )

    def forward(  # type: ignore[override]
        self,
        request: str,
        workspace_context: str,
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
            proven_strategies: ACE patterns
            conversation_history: Previous messages
            skill_inputs: List of {name, type, required}
            skill_outputs: List of {name, type}

        Returns:
            SkillTemplatePlanOutput with steps containing prompt_template
        """
        # Convert to typed specs
        input_specs = [SkillInputSpec(**inp) for inp in skill_inputs]
        output_specs = [SkillOutputSpec(**out) for out in skill_outputs]

        result = self.template_planner(
            request=request,
            workspace_context=workspace_context,
            proven_strategies=proven_strategies,
            conversation_history=conversation_history,
            skill_inputs=input_specs,
            skill_outputs=output_specs,
            configured_tools=configured_tools,
        )

        plan = result.result
        self._validate_template_syntax(plan, skill_inputs)
        return plan  # type: ignore[no-any-return]

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
