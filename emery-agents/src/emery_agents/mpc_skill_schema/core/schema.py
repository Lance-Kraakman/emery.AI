"""
Core SkillSchema data structures.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from .mpc_types import (
    VariableType, ObjectiveType, PlanningHorizon,
    VariableConfig, ObjectiveConfig, ConstraintConfig, PlanningConfig
)


@dataclass
class StateVariable:
    """State variable in MPC system (evolves over time)."""
    name: str
    var_type: VariableType
    bounds: Optional[Dict[str, float]] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    initial_value: Optional[float] = None


@dataclass
class ControlVariable:
    """Control/input variable in MPC system (actions we can take)."""
    name: str
    var_type: VariableType
    bounds: Optional[Dict[str, float]] = None
    unit: Optional[str] = None
    description: Optional[str] = None


@dataclass
class OutputVariable:
    """Output/measured variable in MPC system."""
    name: str
    var_type: VariableType
    unit: Optional[str] = None
    description: Optional[str] = None


@dataclass
class ExternalFactor:
    """External disturbance/factor in MPC system."""
    name: str
    var_type: VariableType
    description: Optional[str] = None
    characteristics: Optional[Dict[str, Any]] = None


@dataclass
class SystemDynamics:
    """System dynamics representation."""
    representation: str  # "pseudo_python", "natural_language", "mathematical"
    equations: List[str]
    assumptions: List[str] = field(default_factory=list)
    parameters: Dict[str, float] = field(default_factory=dict)


@dataclass
class Objective:
    """Objective in MPC system."""
    type: ObjectiveType
    target_variable: str
    target_value: Optional[float] = None
    weight: float = 1.0
    description: Optional[str] = None


@dataclass
class Constraint:
    """Constraint in MPC system."""
    variable: str
    constraint_type: str
    value: Any
    description: Optional[str] = None


@dataclass
class SkillSchema:
    """Complete MPC Skill Schema."""
    system_description: str
    states: List[StateVariable]
    inputs: List[ControlVariable]
    outputs: List[OutputVariable]
    dynamics: SystemDynamics
    objectives: List[Objective]
    constraints: List[Constraint]
    planning: PlanningConfig
    external_factors: List[ExternalFactor] = field(default_factory=list)
    variable_priorities: Dict[str, float] = field(default_factory=dict)
    
    # Metadata
    template: Optional[str] = None
    confidence_score: float = 0.0
    extraction_method: str = "llm"
    user_edits: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "system_description": self.system_description,
            "states": [
                {
                    "name": s.name,
                    "type": s.var_type.value,
                    "bounds": s.bounds,
                    "unit": s.unit,
                    "description": s.description,
                    "initial_value": s.initial_value
                } for s in self.states
            ],
            "inputs": [
                {
                    "name": i.name,
                    "type": i.var_type.value,
                    "bounds": i.bounds,
                    "unit": i.unit,
                    "description": i.description
                } for i in self.inputs
            ],
            "outputs": [
                {
                    "name": o.name,
                    "type": o.var_type.value,
                    "unit": o.unit,
                    "description": o.description
                } for o in self.outputs
            ],
            "dynamics": {
                "representation": self.dynamics.representation,
                "equations": self.dynamics.equations,
                "assumptions": self.dynamics.assumptions,
                "parameters": self.dynamics.parameters
            },
            "objectives": [
                {
                    "type": obj.type.value,
                    "target_variable": obj.target_variable,
                    "target_value": obj.target_value,
                    "weight": obj.weight,
                    "description": obj.description
                } for obj in self.objectives
            ],
            "constraints": [
                {
                    "variable": c.variable,
                    "constraint_type": c.constraint_type,
                    "value": c.value,
                    "description": c.description
                } for c in self.constraints
            ],
            "planning": {
                "horizon": self.planning.horizon.value,
                "sample_time": self.planning.sample_time,
                "prediction_steps": self.planning.prediction_steps,
                "control_interval": self.planning.control_interval
            },
            "external_factors": [
                {
                    "name": ef.name,
                    "type": ef.var_type.value,
                    "description": ef.description,
                    "characteristics": ef.characteristics
                } for ef in self.external_factors
            ],
            "variable_priorities": self.variable_priorities,
            "template": self.template,
            "confidence_score": self.confidence_score,
            "extraction_method": self.extraction_method,
            "user_edits": self.user_edits
        }
