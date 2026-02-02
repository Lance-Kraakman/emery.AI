"""
DSPy Planner Module.

This module handles plan generation using DSPy's ChainOfThought strategy.
It replaces the Jinja2-based planning templates.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.reasoning.signatures.planning import (
    AnalyzeTask,
    ClarifyingQuestionOutput,
    CreatePlan,
    CreateSkillTemplate,
    PlanOrQuestionsOutput,
    QuestionType,
    SelectReasoningApproach,
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
)


class PlannerModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for creating execution plans using ReAct.

    Uses dspy.ReAct with discovery tools so the planner can dynamically
    look up resources and capabilities during reasoning. Static context
    (workspace, capability guidance) is still provided as baseline.

    The Think Before Asking pattern is injected via guidance text.
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
        self.approach_selector = dspy.ChainOfThought(SelectReasoningApproach)
        self.discovery_tools = discovery_tools or []
        self.planner = dspy.ReAct(CreatePlan, tools=self.discovery_tools, max_iters=5)

    def forward(
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str,
        proven_strategies: str,
        conversation_history: str = "",
        memory_context: str = "",
    ) -> PlanOrQuestionsOutput:
        """
        Generate a plan or clarifying questions for a user request.

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            capability_guidance: Domain-specific instructions from capability registry
            proven_strategies: ACE patterns for similar goals
            conversation_history: Formatted previous messages for context continuity
            memory_context: Relevant memories from previous interactions

        Returns:
            PlanOrQuestionsOutput with either a plan or clarifying questions
        """
        has_delegation = self._has_delegation_phrase(request)

        # Analyze the task to understand intent and complexity
        analysis = self.analyzer(
            request=request,
            context=workspace_context,
        )

        # Format analysis for the planner (guides step count and capability selection)
        task_analysis = (
            f"Intent: {analysis.intent}\n"
            f"Domain: {analysis.domain}\n"
            f"Entities: {', '.join(analysis.entities)}\n"
            f"Complexity: {analysis.complexity}"
        )

        # Self-Discover: select reasoning approach before planning
        approach_result = self.approach_selector(
            request=request,
            task_analysis=task_analysis,
            workspace_context=workspace_context,
        )
        approach = approach_result.approach
        approach_guidance = (
            f"REASONING APPROACH: {approach.primary_approach}"
            + (f" + {approach.secondary_approach}" if approach.secondary_approach else "")
            + f"\n{approach.reasoning}"
        )
        if approach.key_considerations:
            approach_guidance += "\nKEY CONSIDERATIONS:\n" + "\n".join(
                f"- {c}" for c in approach.key_considerations
            )

        # Build effective guidance with Think Before Asking
        has_workspace = bool(workspace_context and workspace_context != "{}")
        think_first = self._build_think_before_asking_guidance(
            has_delegation=has_delegation,
            has_workspace_context=has_workspace,
        )
        effective_guidance = f"{approach_guidance}\n\n{think_first}\n\n{capability_guidance}"

        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            capability_guidance=effective_guidance,
            proven_strategies=proven_strategies,
            conversation_history=conversation_history,
            memory_context=memory_context,
            task_analysis=task_analysis,
        )

        plan_result = result.result
        self._ensure_valid_output(plan_result)

        return plan_result  # type: ignore[no-any-return]

    def _has_delegation_phrase(self, request: str) -> bool:
        """
        Check if the request contains phrases indicating user wants us to decide.

        This implements the "Think Before Asking" pattern - if the user says
        "whatever you think" or "standard approach", we should propose defaults
        rather than asking clarifying questions.
        """
        normalized = request.lower()
        return any(phrase in normalized for phrase in self.DELEGATION_PHRASES)

    def _build_think_before_asking_guidance(
        self,
        has_delegation: bool,
        has_workspace_context: bool,
    ) -> str:
        """
        Build Think Before Asking guidance.

        Args:
            has_delegation: Whether user used delegation phrases
            has_workspace_context: Whether workspace context is non-empty
        """
        sections: list[str] = []

        if has_delegation:
            sections.append(
                "USER DELEGATED — propose sensible defaults for everything. "
                "Do NOT ask questions. Include all decisions in the plan."
            )

        # Core Think Before Asking rules (always included)
        sections.append(
            "THINK BEFORE ASKING — 3-step process:\n"
            "1. CHECK CONTEXT: workspace_context shows existing databases, tables "
            "(with field schemas), apps, agents. Use what's there — never ask about "
            "resources you can already see.\n"
            "2. SUGGEST DEFAULTS: For new resources, propose sensible names, field types, "
            "and configurations in the plan. The user can modify before approving.\n"
            "   Example: 'Create contacts table' → plan with: name (text), email (email), "
            "phone (phone), company (text), status (single-select)\n"
            "3. ASK WHEN GENUINELY NEEDED: security decisions, destructive operations, "
            "ambiguous business rules, unclear user preference, or when multiple valid "
            "approaches exist and you are not confident which the user wants. "
            "For external services (Gmail, Slack, etc.), call search_external first — "
            "if multiple actions exist (e.g., send vs draft), ask or pick the most obvious one."
        )

        if not has_workspace_context:
            sections.append(
                "NOTE: Workspace context is empty — the executor can discover "
                "resources at runtime. Plan a Discovery phase if you need to find "
                "existing resources."
            )

        return "\n\n".join(sections)

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

        # Neither plan nor questions — fall back to clarification
        result.questions = [
            ClarifyingQuestionOutput(
                question="What would you like help with?",
                question_type=QuestionType.TEXT,
                options=None,
                reason="Need more detail to create an actionable plan",
            )
        ]


class SimplePlannerModule(dspy.Module):  # type: ignore[misc]
    """
    Simplified planner that skips analysis for straightforward tasks.

    Use this for simple, well-defined tasks that don't need pre-analysis.
    """

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """
        Initialize the simple planner module.

        Args:
            discovery_tools: List of tools available during planning phase
        """
        super().__init__()
        self.planner = dspy.ChainOfThought(CreatePlan)
        self.discovery_tools = discovery_tools or []

    def forward(
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str = "",
        proven_strategies: str = "",
        conversation_history: str = "",
    ) -> PlanOrQuestionsOutput:
        """
        Generate a plan directly without pre-analysis.

        Args:
            request: The user's goal or task description
            workspace_context: JSON string of existing workspace resources
            capability_guidance: Domain-specific instructions
            proven_strategies: ACE patterns for similar goals
            conversation_history: Formatted previous messages for context continuity

        Returns:
            PlanOrQuestionsOutput with either a plan or clarifying questions
        """
        result = self.planner(
            request=request,
            workspace_context=workspace_context,
            capability_guidance=capability_guidance,
            proven_strategies=proven_strategies,
            conversation_history=conversation_history,
        )

        return result.result  # type: ignore[no-any-return]


class SkillTemplatePlannerModule(PlannerModule):
    """DSPy module for creating skill templates with {{ variable }} placeholders.

    Extends PlannerModule to inherit shared logic:
    - _has_delegation_phrase()
    - _build_think_before_asking_guidance()
    - Discovery tools handling
    """

    def __init__(self, discovery_tools: list[Any] | None = None) -> None:
        """Initialize the skill template planner module.

        Args:
            discovery_tools: List of tools available during planning phase
        """
        super().__init__(discovery_tools=discovery_tools)
        # Use template-specific signature
        self.template_planner = dspy.ChainOfThought(CreateSkillTemplate)

    def forward(  # type: ignore[override]
        self,
        request: str,
        workspace_context: str,
        capability_guidance: str,
        proven_strategies: str,
        conversation_history: str,
        skill_inputs: list[dict[str, Any]],
        skill_outputs: list[dict[str, Any]],
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
        tool_names = [getattr(t, "name", str(t)) for t in self.discovery_tools]

        # Build template-specific guidance (adds template rules to base guidance)
        template_guidance = self._build_template_guidance(capability_guidance)

        # Convert to typed specs
        input_specs = [SkillInputSpec(**inp) for inp in skill_inputs]
        output_specs = [SkillOutputSpec(**out) for out in skill_outputs]

        result = self.template_planner(
            request=request,
            workspace_context=workspace_context,
            available_tools=tool_names,
            capability_guidance=template_guidance,
            proven_strategies=proven_strategies,
            conversation_history=conversation_history,
            skill_inputs=input_specs,
            skill_outputs=output_specs,
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
        import logging
        logger = logging.getLogger(__name__)

        for step in plan.steps:
            if not step.prompt_template:
                raise ValueError(f"Step {step.step_id} missing required prompt_template")

            # Warn if no {{ }} but inputs provided
            if skill_inputs and "{{" not in step.prompt_template:
                logger.warning(
                    f"Step {step.step_id} has inputs but no {{{{ }}}} in prompt_template"
                )
