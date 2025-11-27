"""
Core type definitions for MPC Skill Builder.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field


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
class StateVariable:
    """State variable in MPC system (evolves over time)."""
    name: str
    var_type: VariableType
    description: str
    bounds: Optional[VariableBounds] = None
    unit: Optional[str] = None
    initial_value: Optional[float] = None


@dataclass
class ControlVariable:
    """Control/input variable in MPC system (actions we can take)."""
    name: str
    var_type: VariableType
    description: str
    bounds: Optional[VariableBounds] = None
    unit: Optional[str] = None


@dataclass
class OutputVariable:
    """Output/measured variable in MPC system."""
    name: str
    var_type: VariableType
    description: str
    unit: Optional[str] = None


@dataclass
class ExternalFactor:
    """External disturbance/factor in MPC system."""
    name: str
    var_type: VariableType
    description: str
    characteristics: Optional[Dict[str, Any]] = None


@dataclass
class Objective:
    """Objective function for MPC system."""
    type: ObjectiveType
    target_variable: str
    description: str
    target_value: Optional[float] = None
    weight: float = 1.0


@dataclass
class Constraint:
    """Constraint for MPC system."""
    variable: str
    constraint_type: str  # "bounds", "rate", "logical"
    value: Any
    description: str


@dataclass
class SystemDynamics:
    """System dynamics representation."""
    representation: str = "pseudo_python"
    equations: List[str] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PlanningConfig:
    """Planning configuration for MPC system."""
    horizon: PlanningHorizon
    sample_time: float = 0.1
    prediction_steps: Optional[int] = None
    control_interval: int = 1


@dataclass
class SkillSchema:
    """Complete MPC skill schema."""
    system_description: str
    states: List[StateVariable]
    inputs: List[ControlVariable]
    outputs: List[OutputVariable]
    dynamics: SystemDynamics
    objectives: List[Objective]
    constraints: List[Constraint]
    planning: PlanningConfig
    external_factors: List[ExternalFactor]
    variable_priorities: Dict[str, float] = field(default_factory=dict)
    confidence_score: float = 0.8
    extraction_method: str = "llm"
    template: Optional[str] = None