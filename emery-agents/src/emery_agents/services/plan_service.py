"""
Plan Service

Manages plan files - generation, storage, and retrieval.
Plans are stored on agent/skill entities via gRPC.
"""

import logging
from typing import List, Optional, Any

from emery_agents.models.plan import (
    Plan,
    PlanStep,
    StepPlan,
    PlanStatus,
    create_plan,
    create_step,
)

logger = logging.getLogger(__name__)


class PlanService:
    """
    Manages plan files - generation, storage, retrieval via gRPC.

    Plans are detailed execution instructions generated from basic instructions.
    They contain step-by-step tool calls for agent execution.
    """

    def __init__(self, grpc_client=None):
        """
        Initialize plan service.

        Args:
            grpc_client: gRPC client for communication with Next.js server
        """
        self.grpc_client = grpc_client

    async def generate_plan(
        self,
        basic_instructions: str,
        context_tables: Optional[List[str]] = None,
        available_tools: Optional[List[str]] = None,
        goal: Optional[str] = None,
    ) -> Plan:
        """
        Generate detailed plan from basic instructions.

        This method creates a structured plan with step-by-step tool calls
        based on the provided instructions. In a full implementation,
        this would use an LLM to analyze the instructions and generate
        the appropriate steps.

        Args:
            basic_instructions: Human-readable instructions to convert to plan
            context_tables: Tables available for the plan to access
            available_tools: Tools that can be used in plan steps
            goal: Optional explicit goal (defaults to first line of instructions)

        Returns:
            Plan object with generated steps
        """
        context_tables = context_tables or []
        available_tools = available_tools or []

        # Extract goal from instructions if not provided
        if not goal:
            goal = basic_instructions.split('\n')[0].strip()
            if len(goal) > 100:
                goal = goal[:97] + "..."

        # Create initial plan structure
        plan = create_plan(
            goal=goal,
            basic_instructions=basic_instructions,
        )

        logger.info(f"Generated plan {plan.id} for goal: {goal}")
        return plan

    async def save_agent_plan(self, agent_id: int, plan: Plan) -> None:
        """
        Save plan to agent entity via gRPC.

        Args:
            agent_id: ID of the agent to save the plan to
            plan: Plan to save
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping save for agent {agent_id}"
            )
            return

        try:
            await self.grpc_client.update_agent_plan(
                agent_id=agent_id,
                plan=plan.to_dict(),
            )
            logger.info(f"Saved plan {plan.id} to agent {agent_id}")
        except Exception as e:
            logger.error(f"Failed to save plan to agent {agent_id}: {e}")
            raise

    async def save_step_plan(
        self,
        skill_id: int,
        step_id: str,
        plan: StepPlan,
    ) -> None:
        """
        Save plan to skill step via gRPC.

        Args:
            skill_id: ID of the parent skill
            step_id: ID of the step within the skill
            plan: StepPlan to save
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping save for step {step_id}"
            )
            return

        try:
            await self.grpc_client.update_step_plan(
                skill_id=skill_id,
                step_id=step_id,
                plan=plan.to_dict(),
            )
            logger.info(f"Saved plan {plan.id} to skill {skill_id} step {step_id}")
        except Exception as e:
            logger.error(
                f"Failed to save plan to skill {skill_id} step {step_id}: {e}"
            )
            raise

    async def load_agent_plan(self, agent_id: int) -> Optional[Plan]:
        """
        Load plan from agent entity.

        Args:
            agent_id: ID of the agent to load the plan from

        Returns:
            Plan if exists, None otherwise
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, cannot load plan for agent {agent_id}"
            )
            return None

        try:
            response = await self.grpc_client.get_agent(agent_id)
            if response and hasattr(response, 'plan') and response.plan:
                plan = Plan.from_dict(response.plan)
                logger.info(f"Loaded plan {plan.id} from agent {agent_id}")
                return plan
            return None
        except Exception as e:
            logger.error(f"Failed to load plan from agent {agent_id}: {e}")
            return None

    async def load_step_plan(
        self,
        skill_id: int,
        step_id: str,
    ) -> Optional[StepPlan]:
        """
        Load plan from skill step.

        Args:
            skill_id: ID of the parent skill
            step_id: ID of the step within the skill

        Returns:
            StepPlan if exists, None otherwise
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, cannot load plan for step {step_id}"
            )
            return None

        try:
            response = await self.grpc_client.get_skill_step(skill_id, step_id)
            if response and hasattr(response, 'plan') and response.plan:
                plan = StepPlan.from_dict(response.plan)
                logger.info(
                    f"Loaded plan {plan.id} from skill {skill_id} step {step_id}"
                )
                return plan
            return None
        except Exception as e:
            logger.error(
                f"Failed to load plan from skill {skill_id} step {step_id}: {e}"
            )
            return None

    async def approve_plan(self, plan: Plan) -> Plan:
        """
        Mark a plan as approved.

        Args:
            plan: Plan to approve

        Returns:
            Approved plan
        """
        approved = plan.approve()
        logger.info(f"Approved plan {approved.id}")
        return approved

    async def update_plan_status(
        self,
        plan: Plan,
        status: str,
    ) -> Plan:
        """
        Update plan status.

        Args:
            plan: Plan to update
            status: New status (draft, approved, executing, completed, failed)

        Returns:
            Updated plan
        """
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
        """
        Update a step's status within a plan.

        Args:
            plan: Plan containing the step
            step_id: ID of the step to update
            status: New step status
            result: Optional result (for completed steps)
            error: Optional error message (for failed steps)

        Returns:
            Updated plan with modified step
        """
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


class PlanServiceFactory:
    """Factory for creating PlanService instances."""

    def __init__(self, grpc_client=None):
        """
        Initialize factory.

        Args:
            grpc_client: gRPC client to use for all plan services
        """
        self.grpc_client = grpc_client

    def create(self) -> PlanService:
        """Create a PlanService instance."""
        return PlanService(grpc_client=self.grpc_client)
