"""
MPC Skill Builder - Generate adaptive control skills from natural language descriptions.

A compact library for converting user descriptions into structured MPC skill schemas
using HuggingFace's native structured outputs.

Main Usage:
    from mpc_skill_builder import generate_skill_schema
    
    schema = generate_skill_schema(
        "Manage tasks across teams with minimal delay and balanced workload."
    )
"""

from .generator import MPCSkillBuilder
from .mpc_types import SkillSchema, VariableType, ObjectiveType
from .client import HuggingFaceClient

__version__ = "2.0.0"
__all__ = [
    "MPCSkillBuilder",
    "SkillSchema", 
    "VariableType",
    "ObjectiveType",
    "HuggingFaceClient",
    "generate_skill_schema"
]


def generate_skill_schema(description: str, model: str = None) -> SkillSchema:
    """
    Generate MPC skill schema from natural language description.
    
    Args:
        description: Natural language system description
        model: Optional HuggingFace model name (defaults to Qwen2.5-14B-Instruct)
        
    Returns:
        Complete SkillSchema with states, inputs, outputs, objectives, dynamics, etc.
    """
    builder = MPCSkillBuilder(model or "Qwen/Qwen2.5-14B-Instruct")
    return builder.generate_from_description(description)