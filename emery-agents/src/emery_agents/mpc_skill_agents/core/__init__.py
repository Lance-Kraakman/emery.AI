"""
Core MPC entities - clean dataclasses with minimal boilerplate.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class GoalType(Enum):
    TRACKING = "tracking"
    OPTIMIZATION = "optimization" 
    STABILIZATION = "stabilization"


@dataclass
class Variable:
    name: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    rate_limit: Optional[float] = None
    priority: float = 1.0
    is_input: bool = False
    is_output: bool = False


@dataclass
class SystemDescription:
    name: str
    description: str
    variables: Dict[str, Variable] = field(default_factory=dict)
    
    def add_variable(self, var: Variable) -> None:
        self.variables[var.name] = var
    
    def get_inputs(self) -> List[Variable]:
        return [v for v in self.variables.values() if v.is_input]
    
    def get_outputs(self) -> List[Variable]:
        return [v for v in self.variables.values() if v.is_output]


@dataclass
class Goal:
    type: GoalType
    target_variable: str
    target_value: Optional[float] = None
    reference_trajectory: Optional[List[float]] = None
    cost_weight: float = 1.0


@dataclass
class Constraint:
    variable: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    rate_limit: Optional[float] = None


class PlanningHorizon(Enum):
    SHORT = 10
    MEDIUM = 25
    LONG = 50


@dataclass
class MPCPlanner:
    horizon: PlanningHorizon = PlanningHorizon.MEDIUM
    sample_time: float = 0.1
    prediction_steps: Optional[int] = None
    
    def __post_init__(self):
        if self.prediction_steps is None:
            self.prediction_steps = self.horizon.value