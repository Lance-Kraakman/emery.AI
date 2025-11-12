"""
Simple schemas for structured LLM outputs (without pydantic for now).
"""

from typing import List, Dict, Any, Optional, Literal


class ExtractedVariable:
    """Variable extracted from user description."""
    def __init__(self, name: str, type: str, description: str, bounds: Optional[Dict] = None, unit: Optional[str] = None):
        self.name = name
        self.type = type
        self.description = description
        self.bounds = bounds
        self.unit = unit


class ComponentExtraction:
    """All MPC components extracted from user description."""
    def __init__(self, states: List = None, inputs: List = None, outputs: List = None, disturbances: List = None):
        self.states = states or []
        self.inputs = inputs or []
        self.outputs = outputs or []
        self.disturbances = disturbances or []


class SystemDynamics:
    """System dynamics representation."""
    def __init__(self, representation: str = "pseudo_python", equations: List = None, assumptions: List = None, parameters: Dict = None):
        self.representation = representation
        self.equations = equations or []
        self.assumptions = assumptions or []
        self.parameters = parameters or {}


class Objective:
    """Objective function for MPC system."""
    def __init__(self, type: str, target_variable: str, description: str, target_value: Optional[float] = None, weight: float = 1.0):
        self.type = type
        self.target_variable = target_variable
        self.description = description
        self.target_value = target_value
        self.weight = weight


class Constraint:
    """Constraint for MPC system."""
    def __init__(self, variable: str, constraint_type: str, value: Any, description: str):
        self.variable = variable
        self.constraint_type = constraint_type
        self.value = value
        self.description = description


class PlanningConfig:
    """Planning configuration for MPC system."""
    def __init__(self, horizon: str = "medium", sample_time: float = 0.1, prediction_steps: Optional[int] = None, control_interval: int = 1):
        self.horizon = horizon
        self.sample_time = sample_time
        self.prediction_steps = prediction_steps
        self.control_interval = control_interval


class VariablePriorities:
    """Priority weights for variables."""
    def __init__(self, variable_priorities: Dict = None):
        self.variable_priorities = variable_priorities or {}