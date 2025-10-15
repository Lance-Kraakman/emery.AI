"""
Capability Configuration Entity

AIDEV-NOTE: Domain entity for agent capability configuration.
Matches the protobuf CapabilityConfig message exactly.
"""

from dataclasses import dataclass
from typing import List
from .step_config import StepConfig


@dataclass
class CapabilityConfig:
    """
    Agent capability configuration.
    
    AIDEV-NOTE: Matches protobuf message CapabilityConfig {
        string name = 1;
        string description = 2;
        repeated StepConfig steps = 3;
    }
    """
    
    name: str
    description: str
    steps: List[StepConfig]
    
    def __post_init__(self):
        """Validate capability configuration."""
        if not self.name or not self.name.strip():
            raise ValueError("Capability name cannot be empty")
        
        if not self.description or not self.description.strip():
            raise ValueError("Capability description cannot be empty")
        
        if not self.steps:
            raise ValueError("Capability must have at least one step")
        
        # Validate all steps
        for i, step in enumerate(self.steps):
            if not isinstance(step, StepConfig):
                raise TypeError(f"Step {i} must be a StepConfig instance")
    
    @property
    def step_count(self) -> int:
        """Get total number of steps in this capability."""
        return len(self.steps)
    
    @property
    def normalized_name(self) -> str:
        """Get normalized capability name."""
        return self.name.strip().lower().replace(" ", "_")
    
    def get_step_by_id(self, step_id: str) -> StepConfig:
        """Get step by ID, raises ValueError if not found."""
        for step in self.steps:
            if step.id == step_id:
                return step
        raise ValueError(f"Step '{step_id}' not found in capability '{self.name}'")
    
    def has_step(self, step_id: str) -> bool:
        """Check if capability has a step with given ID."""
        return any(step.id == step_id for step in self.steps)
    
    def get_code_steps(self) -> List[StepConfig]:
        """Get all CODE_STEP steps in this capability."""
        from .step_config import StepType
        return [step for step in self.steps if step.type == StepType.CODE_STEP]
    
    def get_tool_steps(self) -> List[StepConfig]:
        """Get all TOOL_STEP steps in this capability."""
        from .step_config import StepType
        return [step for step in self.steps if step.type == StepType.TOOL_STEP]
    
    @classmethod
    def from_dict(cls, data: dict) -> "CapabilityConfig":
        """Create CapabilityConfig from dictionary (protobuf conversion)."""
        from .step_config import StepConfig
        
        return cls(
            name=data["name"],
            description=data["description"], 
            steps=[StepConfig.from_dict(step_data) for step_data in data.get("steps", [])]
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary (protobuf conversion)."""
        return {
            "name": self.name,
            "description": self.description,
            "steps": [step.to_dict() for step in self.steps]
        }