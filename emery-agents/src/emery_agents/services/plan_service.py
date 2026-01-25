"""
Plan Service

Facade for plan management - generation, storage, and retrieval.
Delegates to modular components in services/planning/.

AIDEV-NOTE: This is now a thin facade that maintains backward compatibility
while delegating to:
- PlanGenerator: Core plan generation logic
- PlanRepository: gRPC persistence
- FailureAnalyzer: Step failure recovery

The original 700+ line class has been split into focused modules.
"""

import logging
from typing import List, Optional, Any

from emery_agents.models.plan import (
    Plan,
    PlanStep,
    StepPlan,
    PlanStatus,
    RecoveryResult,
    create_plan,
)
from emery_agents.models.task_ledger import TaskLedger
from emery_agents.models.context_mapping import ResolvedContext
from emery_agents.models.skill_definition import SkillInputDefinition, SkillOutputDefinition

from .protocols import ModelProvider, GRPCClient, Tool
from .capability_registry import CapabilityRegistry
from emery_agents.ace import StrategyAccumulationService
from .planning import (
    PlanGenerator,
    DSPyPlanGenerator,
    PlanRepository,
    FailureAnalyzer,
    PlanGenerationRequest,
    PlanGenerationResult,
    ToolResultSummary,
)
from .context import SessionConfig, WorkspaceContext

logger = logging.getLogger(__name__)

# Re-export dataclasses for backward compatibility
__all__ = [
    "PlanService",
    "PlanServiceFactory",
    "ToolResultSummary",
]


class PlanService:
    """
    Facade for plan management.

    Delegates to:
    - PlanGenerator (or DSPyPlanGenerator) for plan creation
    - PlanRepository for persistence
    - FailureAnalyzer for recovery analysis

    Maintains backward-compatible interface.

    AIDEV-NOTE: Set use_dspy=True to use DSPy-based plan generation.
    DSPy offers typed outputs, automatic prompt optimization, and
    ChainOfThought reasoning. The default remains smolagents-based
    for backward compatibility.
    """

    def __init__(
        self,
        grpc_client: Optional[GRPCClient] = None,
        model_provider: Optional[ModelProvider] = None,
        use_dspy: bool = False,
        discovery_tools: Optional[List[Tool]] = None,
    ):
        """
        Initialize plan service.

        Args:
            grpc_client: gRPC client for communication with Next.js server
            model_provider: Model provider for LLM access and model resolution
            use_dspy: If True, use DSPy-based plan generation instead of smolagents
            discovery_tools: Optional tools for planning phase (read-only discovery)
        """
        self.grpc_client = grpc_client
        self.model_provider = model_provider
        self.use_dspy = use_dspy

        # Initialize generator based on mode
        if use_dspy:
            self._generator: PlanGenerator | DSPyPlanGenerator = DSPyPlanGenerator(
                model_provider=model_provider,
                discovery_tools=discovery_tools,
            )
            logger.info("📋 PlanService initialized with DSPy generator")
        else:
            self._generator = PlanGenerator(model_provider=model_provider)
            logger.info("📋 PlanService initialized with smolagents generator")

        # Initialize other delegates
        self._repository = PlanRepository(grpc_client=grpc_client)
        self._analyzer = FailureAnalyzer(model_provider=model_provider)

    async def generate_plan(
        self,
        basic_instructions: str,
        context_tables: Optional[ResolvedContext] = None,
        available_tools: Optional[List[str]] = None,
        goal: Optional[str] = None,
        tools: Optional[List[Tool]] = None,
        managed_agents: Optional[List[Any]] = None,
        research_tools: Optional[List[Any]] = None,
        skill_inputs: Optional[List[SkillInputDefinition]] = None,
        previous_plan_json: Optional[str] = None,
        user_feedback: Optional[str] = None,
        skill_outputs: Optional[List[SkillOutputDefinition]] = None,
        is_template_generation: bool = False,
        conversation_history: Optional[List[Any]] = None,
        strategy_service: Optional[StrategyAccumulationService] = None,
        capability_registry: Optional[Any] = None,
        config: Optional[SessionConfig] = None,
        workspace: Optional[WorkspaceContext] = None,
    ) -> PlanGenerationResult:
        """
        Generate plan using phased domain routing.

        Delegates to PlanGenerator which routes to domain-specific planners
        (schema, app, automation) via PlannerRouter.

        Args:
            basic_instructions: Human-readable instructions to convert to plan
            context_tables: Resolved context mappings (tables available for the plan)
            available_tools: Tool names as strings (for logging, unused)
            goal: Optional explicit goal (defaults to LLM-generated goal)
            tools: Actual tool objects (for prompt template)
            managed_agents: Available managed agents (planner sees their descriptions)
            research_tools: Optional web research tools (web_search, visit_webpage)
            skill_inputs: Optional skill input definitions for variable-aware planning
            previous_plan_json: Optional previous plan JSON for regeneration with feedback
            user_feedback: Optional user feedback for plan regeneration
            skill_outputs: Optional skill output definitions for result-aware planning
            is_template_generation: If True, plan is for a reusable skill (no hardcoded IDs)
            conversation_history: Optional chat history for resolving references
            strategy_service: Optional service for surfacing proven patterns
            capability_registry: Optional registry for capability discovery
            config: Session config with auth/identity (org_id, org_model, api_key)
            workspace: Pre-resolved workspace state (agents, tables, apps)

        Returns:
            PlanGenerationResult with either:
            - plan: Generated Plan object (if details were sufficient)
            - clarifying_questions: Questions for user (if details were missing)
        """
        # Build request dataclass (includes all config for plan generation)
        request = PlanGenerationRequest(
            basic_instructions=basic_instructions,
            context_tables=context_tables,
            goal=goal,
            conversation_history=conversation_history,
            tools=tools or [],
            managed_agents=managed_agents or [],
            research_tools=research_tools,
            skill_inputs=list(skill_inputs) if skill_inputs else [],
            skill_outputs=list(skill_outputs) if skill_outputs else [],
            is_template_generation=is_template_generation,
            previous_plan_json=previous_plan_json,
            user_feedback=user_feedback,
            capability_registry=capability_registry,
            config=config,
            workspace=workspace,
        )

        # Delegate to generator (uses capability-based discovery)
        result = await self._generator.generate(
            request,
            strategy_service=strategy_service,
        )

        return result

    async def save_agent_plan(self, agent_id: int, plan: Plan) -> None:
        """Save plan to agent entity via gRPC."""
        await self._repository.save_agent_plan(agent_id, plan)

    async def save_step_plan(
        self,
        skill_id: int,
        step_id: str,
        plan: StepPlan,
    ) -> None:
        """Save plan to skill step via gRPC."""
        await self._repository.save_step_plan(skill_id, step_id, plan)

    async def load_agent_plan(self, agent_id: int) -> Optional[Plan]:
        """Load plan from agent entity."""
        return await self._repository.load_agent_plan(agent_id)

    async def load_step_plan(
        self,
        skill_id: int,
        step_id: str,
    ) -> Optional[StepPlan]:
        """Load plan from skill step."""
        return await self._repository.load_step_plan(skill_id, step_id)

    async def approve_plan(self, plan: Plan) -> Plan:
        """Mark a plan as approved."""
        approved = plan.approve()
        logger.info(f"Approved plan {approved.id}")
        return approved

    async def update_plan_status(
        self,
        plan: Plan,
        status: str,
    ) -> Plan:
        """Update plan status."""
        if status == PlanStatus.APPROVED.value:
            return plan.approve()
        elif status == PlanStatus.EXECUTING.value:
            return plan.start_execution()
        elif status == PlanStatus.COMPLETED.value:
            return plan.complete()
        elif status == PlanStatus.FAILED.value:
            return plan.fail()
        else:
            logger.warning(f"Unknown plan status: {status}")
            return plan

    async def update_step_status(
        self,
        plan: Plan,
        step_id: str,
        status: str,
        result: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Plan:
        """Update a step's status within a plan."""
        for step in plan.steps:
            if step.step_id == step_id:
                if status == "in_progress":
                    updated_step = step.mark_in_progress()
                elif status == "completed":
                    updated_step = step.mark_completed(result)
                elif status == "failed":
                    updated_step = step.mark_failed(error or "Unknown error")
                else:
                    logger.warning(f"Unknown step status: {status}")
                    return plan

                return plan.update_step(step_id, updated_step)

        logger.warning(f"Step {step_id} not found in plan {plan.id}")
        return plan

    def analyze_step_failure(
        self,
        failed_step: PlanStep,
        error_message: str,
        plan: Plan,
        ledger: TaskLedger,
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        capability_registry: Optional[CapabilityRegistry] = None,
    ) -> RecoveryResult:
        """
        Analyze a failed step and determine how to fix it.

        Delegates to FailureAnalyzer.

        Args:
            failed_step: The step that failed
            error_message: The error from execution
            plan: The original plan (for context)
            ledger: Current execution state
            org_model: Organization model ID for model resolution hierarchy
            api_key: API key for research_emery auth
            organization_id: Organization ID for research_emery RLS context
            capability_registry: Registry for agent lookup (avoids creating new agents)

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        return self._analyzer.analyze(
            failed_step=failed_step,
            error_message=error_message,
            plan_goal=plan.goal,
            plan_context=plan.context,
            ledger=ledger,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
            capability_registry=capability_registry,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._generator.last_strategy_guidance


class PlanServiceFactory:
    """Factory for creating PlanService instances."""

    def __init__(
        self,
        grpc_client: Optional[GRPCClient] = None,
        model_provider: Optional[ModelProvider] = None,
        use_dspy: bool = False,
        discovery_tools: Optional[List[Tool]] = None,
    ) -> None:
        """
        Initialize factory.

        Args:
            grpc_client: gRPC client to use for all plan services
            model_provider: Model provider for LLM access
            use_dspy: If True, use DSPy-based plan generation
            discovery_tools: Optional tools for planning phase
        """
        self.grpc_client = grpc_client
        self.model_provider = model_provider
        self.use_dspy = use_dspy
        self.discovery_tools = discovery_tools

    def create(self) -> PlanService:
        """Create a PlanService instance."""
        return PlanService(
            grpc_client=self.grpc_client,
            model_provider=self.model_provider,
            use_dspy=self.use_dspy,
            discovery_tools=self.discovery_tools,
        )
