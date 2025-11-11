"""
Core type definitions for MPC Skill Schema.
"""

from enum import Enum
from typing import Optional, Union, Dict, Any
from dataclasses import dataclass


class VariableType(Enum):
    """Types of variables in MPC systems."""
    CONTINUOUS = "continuous"
    DISCRETE = "discrete"
    BINARY = "binary"
    CATEGORICAL = "categorical"


class ObjectiveType(Enum):
    """Types of objectives in MPC systems."""
    MINIMIZE = "minimize"
    MAXIMIZE = "maximize"
    TRACK = "track"
    BALANCE = "balance"
    STABILIZE = "stabilize"


class PlanningHorizon(Enum):
    """Planning horizon options."""
    SHORT = "short"      # 10-15 steps
    MEDIUM = "medium"    # 25-35 steps  
    LONG = "long"        # 50-75 steps


@dataclass
class VariableBounds:
    """Bounds for variables."""
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    rate_limit: Optional[float] = None


@dataclass
class VariableConfig:
    """Configuration for variables."""
    name: str
    var_type: VariableType
    bounds: Optional[VariableBounds] = None
    unit: Optional[str] = None
    description: Optional[str] = None


@dataclass
class ObjectiveConfig:
    """Configuration for objectives."""
    type: ObjectiveType
    target_variable: str
    target_value: Optional[float] = None
    weight: float = 1.0
    description: Optional[str] = None


@dataclass
class ConstraintConfig:
    """Configuration for constraints."""
    variable: str
    constraint_type: str  # "bounds", "rate", "logical", "precedence"
    value: Union[float, str, Dict[str, Any]]
    description: Optional[str] = None


@dataclass
class PlanningConfig:
    """Configuration for MPC planning."""
    horizon: PlanningHorizon = PlanningHorizon.MEDIUM
    sample_time: float = 0.1
    prediction_steps: Optional[int] = None
    control_interval: Optional[int] = None
    
    def __post_init__(self):
        if self.prediction_steps is None:
            horizon_steps = {
                PlanningHorizon.SHORT: 15,
                PlanningHorizon.MEDIUM: 30, 
                PlanningHorizon.LONG: 60
            }
            self.prediction_steps = horizon_steps[self.horizon]
