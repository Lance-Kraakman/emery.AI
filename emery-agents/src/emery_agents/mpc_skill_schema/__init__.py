"""
MPC Skill Schema Builder - Generate adaptive skills from user descriptions.

This package provides tools to convert natural language system descriptions
into structured MPC skill schemas using LLM-based extraction and generation.

Main Usage:
    from mpc_skill_schema import generate_skill_from_user_input
    
    schema = generate_skill_from_user_input(
        "Manage multiple tasks across three teams. Minimize delays and balance workload.",
        template="workflow"
    )
"""

from .builder.skill_builder import (
    generate_skill_from_user_input,
    generate_skill_from_user_input_simple
)
from .core.schema import SkillSchema
from .core.mpc_types import VariableType, ObjectiveType, PlanningHorizon
from .core.archetypes import ArchetypeMapper

__version__ = "1.0.0"
__all__ = [
    "generate_skill_from_user_input",
    "generate_skill_from_user_input_simple", 
    "SkillSchema",
    "VariableType",
    "ObjectiveType", 
    "PlanningHorizon",
    "ArchetypeMapper"
]
