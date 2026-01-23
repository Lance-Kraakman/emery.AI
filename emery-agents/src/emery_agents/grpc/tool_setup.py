"""
Tool Setup Utilities

Helper functions for tool configuration and plan detection.

Extracted from ChatProcessingService for better organization.
"""

import logging
from typing import Optional, List, TYPE_CHECKING

from ..models.plan import Plan

if TYPE_CHECKING:
    from .generated import agent_worker_pb2

logger = logging.getLogger(__name__)


def detect_stored_plan_from_skills(
    skills: Optional[List['agent_worker_pb2.SkillConfig']]
) -> Optional[Plan]:
    """
    Detect stored plan from skill configurations.

    Scans skills for agentic steps that have pre-approved execution plans.
    When found, the plan enables autonomous execution without HITL approval.

    Args:
        skills: List of SkillConfig proto messages from agent config

    Returns:
        Hydrated Plan object if found, None otherwise
    """
    if not skills:
        return None

    for skill in skills:
        # Check if skill has steps (DAG-based execution)
        if not skill.steps:
            continue

        for step in skill.steps:
            # Check if step has agentic config with a plan
            if not step.HasField('agentic_config'):
                continue

            agentic_config = step.agentic_config
            if not agentic_config.HasField('plan'):
                continue

            # Check if plan has an ID (empty proto message means no plan)
            if not agentic_config.plan.id:
                continue

            # Found a stored plan - hydrate it
            stored_plan = Plan.from_stored_proto(agentic_config.plan)
            logger.info(
                f"📋 Found stored plan '{stored_plan.id}' in skill '{skill.name}' "
                f"step '{step.name}' - enabling AUTONOMOUS mode"
            )
            return stored_plan

    return None
