"""
Schemas for structured LLM outputs.
"""

from typing import List, Dict, Any, Optional, Literal


class BaseModel:
    """Simple base class for structured outputs."""
    pass


def Field(description: str, default=None):
    """Simple field decorator."""
    return default


class ExtractedVariable(BaseModel):
    """Variable extracted from user description."""
    name: str = Field(description="Variable name in snake_case")
    type: Literal["continuous", "discrete", "binary", "categorical"] = Field(
        description="Variable type"
    )
    description: str = Field(description="Brief description of what the variable represents")
    bounds: Optional[Dict[str, float]] = Field(
        default=None, description="Min/max values if mentioned or can be inferred"
    )
    unit: Optional[str] = Field(default=None, description="Unit of measurement")


class ComponentExtraction(BaseModel):
    """All MPC components extracted from user description."""
    states: List[ExtractedVariable] = Field(default=[], description="State variables")
    inputs: List[ExtractedVariable] = Field(default=[], description="Control/input variables")
    outputs: List[ExtractedVariable] = Field(default=[], description="Output/measured variables")
    disturbances: List[ExtractedVariable] = Field(
        default=[], description="External disturbances/factors"
    )


class SystemDynamics(BaseModel):
    """System dynamics representation."""
    representation: str = Field(default="pseudo_python", description="Representation format")
    equations: List[str] = Field(description="Pseudo-Python equations for system dynamics")
    assumptions: List[str] = Field(
        default=[], description="Assumptions made in the dynamics model"
    )
    parameters: Dict[str, Any] = Field(
        default={}, description="Parameters used in the dynamics equations"
    )


class Objective(BaseModel):
    """Objective function for MPC system."""
    type: Literal["minimize", "maximize", "track", "balance", "stabilize"] = Field(
        description="Type of objective"
    )
    target_variable: str = Field(description="Variable this objective targets")
    target_value: Optional[float] = Field(
        default=None, description="Target value for track objectives"
    )
    weight: float = Field(default=1.0, description="Weight of this objective")
    description: str = Field(description="Description of what this objective achieves")


class Constraint(BaseModel):
    """Constraint for MPC system."""
    variable: str = Field(description="Variable this constraint applies to")
    constraint_type: Literal["bounds", "rate", "logical", "precedence"] = Field(
        description="Type of constraint"
    )
    value: Any = Field(description="Constraint value (bounds, rate limit, etc.)")
    description: str = Field(description="Description of what this constraint enforces")


class PlanningConfig(BaseModel):
    """Planning configuration for MPC system."""
    horizon: Literal["short", "medium", "long"] = Field(
        description="Planning horizon length"
    )
    sample_time: float = Field(default=0.1, description="Time step for control updates")
    prediction_steps: Optional[int] = Field(
        default=None, description="Number of prediction steps"
    )
    control_interval: int = Field(
        default=1, description="How often to apply control actions"
    )


class VariablePriorities(BaseModel):
    """Priority weights for variables."""
    variable_priorities: Dict[str, float] = Field(
        description="Priority weights for each variable"
    )