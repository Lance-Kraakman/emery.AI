"""
MPC Skill Agents Library

A clean, minimal library for MPC-based skills that integrates with smolagents.
Uses do-mpc for mathematical solving and LLM for system configuration.
"""

from .core import SystemDescription, Variable, Goal, GoalType, Constraint, MPCPlanner, PlanningHorizon
from .mpc_skill import MPCSkill
from .solver import MPCSolver

__version__ = "0.1.0"
__all__ = [
    "SystemDescription", 
    "Variable", 
    "Goal", 
    "GoalType", 
    "Constraint", 
    "MPCPlanner",
    "PlanningHorizon",
    "MPCSkill",
    "MPCSolver"
]