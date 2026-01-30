"""
Plan Service

Facade for plan management using DSPy.
"""

import logging
from typing import List, Optional, Any

from emery_agents.entities.models.plan import (
    Plan,
    PlanStep,
    StepPlan,
    PlanStatus,
    RecoveryResult,
    create_plan,
    SkillInputDefinition,
    SkillOutputDefinition,
)
from emery_agents.entities.models.task_ledger import TaskLedger
from emery_agents.entities.models.context_mapping import ResolvedContext

from .protocols import ModelProviderProtocol, GRPCClient, Tool
from .tools import CapabilityRegistry
from emery_agents.ace import StrategyAccumulationService
from .planning import (
    DSPyPlanGenerator,
    PlanRepository,
    FailureAnalyzer,
    PlanGenerationRequest,
    PlanGenerationResult,
    ToolResultSummary,
)
from .context import SessionConfig, WorkspaceContext

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
        grpc_client: Optional[GRPCClient] = None,
        model_provider: Optional[ModelProviderProtocol] = None,
        discovery_tools: Optional[List[Tool]] = None,
    ):
        self.grpc_client = grpc_client
        self.model_provider = model_provider

        # Initialize DSPy generator
        self._generator: DSPyPlanGenerator = DSPyPlanGenerator(
            model_provider=model_provider,
            discovery_tools=discovery_tools,
        )
        logger.info("📋 PlanService initialized with DSPy generator (smolagents disabled)")

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
        memory_context: str = "",
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
        model_provider: Optional[ModelProviderProtocol] = None,
        discovery_tools: Optional[List[Tool]] = None,
    ) -> None:
        self.grpc_client = grpc_client
        self.model_provider = model_provider
        self.discovery_tools = discovery_tools

    def create(self) -> PlanService:
        """Create a PlanService instance."""
        return PlanService(
            grpc_client=self.grpc_client,
            model_provider=self.model_provider,
            discovery_tools=self.discovery_tools,
        )
