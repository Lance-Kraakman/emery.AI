"""
Plan Service

Facade for plan management using DSPy.
"""

import logging
from typing import Any

from emery_agents.ace import StrategyAccumulationService
from emery_agents.entities.models.context_mapping import ResolvedContext
from emery_agents.entities.models.plan import (
    Plan,
    PlanStatus,
    PlanStep,
    RecoveryResult,
    SkillInputDefinition,
    SkillOutputDefinition,
    StepPlan,
)
from emery_agents.entities.models.task_ledger import TaskLedger
from emery_agents.reasoning.signatures.planning.models import TriageAnalysis
from emery_agents.tools.capability_registry import CapabilityRegistry

from .context import SessionConfig, WorkspaceContext
from .planning import (
    DSPyPlanGenerator,
    FailureAnalyzer,
    PlanGenerationRequest,
    PlanGenerationResult,
    PlanRepository,
    ToolResultSummary,
)
from .protocols import GRPCClient, ModelProviderProtocol, Tool

logger = logging.getLogger(__name__)

__all__ = [
    "PlanService",
    "PlanServiceFactory",
    "ToolResultSummary",
]


class PlanService:
    """Facade for plan management using DSPy."""

    def __init__(
        self,
        grpc_client: GRPCClient | None = None,
        model_provider: ModelProviderProtocol | None = None,
    ):
        self.grpc_client = grpc_client
        self.model_provider = model_provider

        # Initialize DSPy generator (discovery_tools passed at generate time)
        self._generator: DSPyPlanGenerator = DSPyPlanGenerator()
        logger.info(
            "📋 PlanService initialized with DSPy generator (smolagents disabled)"
        )

        # Initialize other delegates
        self._repository = PlanRepository(grpc_client=grpc_client)
        self._analyzer = FailureAnalyzer(model_provider=model_provider)

    async def generate_plan(
        self,
        basic_instructions: str,
        context_tables: ResolvedContext | None = None,
        available_tools: list[str] | None = None,
        goal: str | None = None,
        tools: list[Tool] | None = None,
        managed_agents: list[Any] | None = None,
        skill_inputs: list[SkillInputDefinition] | None = None,
        previous_plan_json: str | None = None,
        user_feedback: str | None = None,
        skill_outputs: list[SkillOutputDefinition] | None = None,
        is_template_generation: bool = False,
        conversation_history: list[Any] | None = None,
        strategy_service: StrategyAccumulationService | None = None,
        capability_registry: Any | None = None,
        config: SessionConfig | None = None,
        workspace: WorkspaceContext | None = None,
        memory_context: str = "",
        triage_analysis: TriageAnalysis | None = None,
        configured_tools: list | None = None,
        token_accumulator: Any | None = None,
        retrieved_capabilities: str = "",
        retrieved_patterns: str = "",
        retrieved_knowledge: str = "",
        retrieved_strategies: str = "",
        graph_context: str = "",
        autonomous_mode: bool = False,
        discovery_tools: list[Tool] | None = None,
    ) -> PlanGenerationResult:
        """Generate plan using DSPy PlannerModule. Returns plan or clarifying questions."""
        # Build request dataclass (includes all config for plan generation)
        request = PlanGenerationRequest(
            basic_instructions=basic_instructions,
            context_tables=context_tables,
            goal=goal,
            conversation_history=conversation_history,
            tools=tools or [],
            managed_agents=managed_agents or [],
            skill_inputs=list(skill_inputs) if skill_inputs else [],
            skill_outputs=list(skill_outputs) if skill_outputs else [],
            is_template_generation=is_template_generation,
            previous_plan_json=previous_plan_json,
            user_feedback=user_feedback,
            capability_registry=capability_registry,
            config=config,
            workspace=workspace,
            memory_context=memory_context,
            triage_analysis=triage_analysis,
            configured_tools=configured_tools,
            token_accumulator=token_accumulator,
            retrieved_capabilities=retrieved_capabilities,
            retrieved_patterns=retrieved_patterns,
            retrieved_knowledge=retrieved_knowledge,
            retrieved_strategies=retrieved_strategies,
            graph_context=graph_context,
            autonomous_mode=autonomous_mode,
        )

        # Delegate to generator (uses capability-based discovery)
        result = await self._generator.generate(
            request,
            strategy_service=strategy_service,
            discovery_tools=discovery_tools,
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

    async def load_agent_plan(self, agent_id: int) -> Plan | None:
        """Load plan from agent entity."""
        return await self._repository.load_agent_plan(agent_id)

    async def load_step_plan(
        self,
        skill_id: int,
        step_id: str,
    ) -> StepPlan | None:
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
        result: str | None = None,
        error: str | None = None,
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
        org_model: str | None = None,
        api_key: str | None = None,
        organization_id: int | None = None,
        capability_registry: CapabilityRegistry | None = None,
        tracker: Any | None = None,
    ) -> RecoveryResult:
        """Analyze a failed step and determine recovery strategy."""
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
            tracker=tracker,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._generator.last_strategy_guidance


class PlanServiceFactory:
    """Factory for creating PlanService instances."""

    def __init__(
        self,
        grpc_client: GRPCClient | None = None,
        model_provider: ModelProviderProtocol | None = None,
    ) -> None:
        self.grpc_client = grpc_client
        self.model_provider = model_provider

    def create(self) -> PlanService:
        """Create a PlanService instance."""
        return PlanService(
            grpc_client=self.grpc_client,
            model_provider=self.model_provider,
        )
