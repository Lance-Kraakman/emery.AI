"""
Plan Repository

Handles persistence of plans via gRPC to the Next.js server.
Plans are stored on agent/skill entities.

AIDEV-NOTE: All persistence operations are async and handle
missing gRPC client gracefully with warnings.
"""

import logging
from typing import Optional

from emery_agents.models.plan import Plan, StepPlan
from ..protocols import GRPCClient

logger = logging.getLogger(__name__)


class PlanRepository:
    """
    Handles plan persistence via gRPC.

    Plans can be stored on:
    - Agent entities (full execution plans)
    - Skill steps (step-level sub-plans)
    """

    def __init__(self, grpc_client: Optional[GRPCClient] = None):
        self.grpc_client = grpc_client

    async def save_agent_plan(self, agent_id: int, plan: Plan) -> None:
        """Save plan to agent entity via gRPC."""
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
        """Save plan to skill step via gRPC."""
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
        """Load plan from agent entity. Returns None if not found."""
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
        """Load plan from skill step. Returns None if not found."""
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
