"""
Execution Context Value Object

AIDEV-NOTE: Value object for maintaining execution state between steps.
Immutable context that tracks variables, outputs, and step history.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List
import json


@dataclass(frozen=True)
class ExecutionContext:
    """Value object for agent execution context."""
    
    execution_id: str
    variables: Dict[str, Any] = field(default_factory=dict)
    step_outputs: Dict[str, Any] = field(default_factory=dict)
    completed_steps: List[str] = field(default_factory=list)
    model: str = "default"
    
    def __post_init__(self):
        """Validate execution context."""
        if not self.execution_id or not self.execution_id.strip():
            raise ValueError("Execution ID cannot be empty")
        
        if not isinstance(self.variables, dict):
            raise TypeError(f"Variables must be a dict, got {type(self.variables)}")
        
        if not isinstance(self.step_outputs, dict):
            raise TypeError(f"Step outputs must be a dict, got {type(self.step_outputs)}")
        
        if not isinstance(self.completed_steps, list):
            raise TypeError(f"Completed steps must be a list, got {type(self.completed_steps)}")
    
    def has_variable(self, key: str) -> bool:
        """Check if context has a specific variable."""
        return key in self.variables
    
    def get_variable(self, key: str, default: Any = None) -> Any:
        """Get variable value with default."""
        return self.variables.get(key, default)
    
    def has_step_output(self, step_id: str) -> bool:
        """Check if context has output from a specific step."""
        return step_id in self.step_outputs
    
    def get_step_output(self, step_id: str, default: Any = None) -> Any:
        """Get step output with default."""
        return self.step_outputs.get(step_id, default)
    
    def is_step_completed(self, step_id: str) -> bool:
        """Check if a step has been completed."""
        return step_id in self.completed_steps
    
    def with_variable(self, key: str, value: Any) -> "ExecutionContext":
        """Return new context with updated variable."""
        new_variables = self.variables.copy()
        new_variables[key] = value
        
        return ExecutionContext(
            execution_id=self.execution_id,
            variables=new_variables,
            step_outputs=self.step_outputs,
            completed_steps=self.completed_steps,
            model=self.model
        )
    
    def with_step_output(self, step_id: str, output: Any) -> "ExecutionContext":
        """Return new context with step output."""
        new_outputs = self.step_outputs.copy()
        new_outputs[step_id] = output
        
        return ExecutionContext(
            execution_id=self.execution_id,
            variables=self.variables,
            step_outputs=new_outputs,
            completed_steps=self.completed_steps,
            model=self.model
        )
    
    def with_completed_step(self, step_id: str) -> "ExecutionContext":
        """Return new context with completed step."""
        if step_id in self.completed_steps:
            return self  # No change needed
        
        new_completed = self.completed_steps.copy()
        new_completed.append(step_id)
        
        return ExecutionContext(
            execution_id=self.execution_id,
            variables=self.variables,
            step_outputs=self.step_outputs,
            completed_steps=new_completed,
            model=self.model
        )
    
    def with_model(self, model: str) -> "ExecutionContext":
        """Return new context with updated model."""
        return ExecutionContext(
            execution_id=self.execution_id,
            variables=self.variables,
            step_outputs=self.step_outputs,
            completed_steps=self.completed_steps,
            model=model
        )
    
    @classmethod
    def create(cls, execution_id: str, model: str = "default") -> "ExecutionContext":
        """Create new empty execution context."""
        return cls(execution_id=execution_id, model=model)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExecutionContext":
        """Create ExecutionContext from dictionary."""
        return cls(
            execution_id=data["execution_id"],
            variables=data.get("variables", {}),
            step_outputs=data.get("step_outputs", {}),
            completed_steps=data.get("completed_steps", []),
            model=data.get("model", "default")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "execution_id": self.execution_id,
            "variables": self.variables,
            "step_outputs": self.step_outputs,
            "completed_steps": self.completed_steps,
            "model": self.model
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)
    
    @classmethod
    def from_json(cls, json_str: str) -> "ExecutionContext":
        """Create ExecutionContext from JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)