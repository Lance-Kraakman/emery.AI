"""
Execution Context Entity

AIDEV-NOTE: Domain entity representing the context for task execution.
Contains execution mode, tools, and environment information.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum


class ExecutionMode(Enum):
    """Execution mode enumeration."""
    CAPABILITY_BASED = "capability"
    INSTRUCTION_BASED = "instruction"


@dataclass
class ExecutionContext:
    """Execution context for agent tasks."""
    
    # Core execution properties
    mode: ExecutionMode
    instructions: str
    available_tools: List[str]
    
    # Optional context
    agent_id: Optional[int] = None
    organization_id: Optional[int] = None
    capability_name: Optional[str] = None
    max_steps: Optional[int] = None
    timeout_seconds: Optional[int] = None
    
    # Environment data
    environment: Dict[str, Any] = None
    
    def __post_init__(self):
        """Initialize defaults after creation."""
        if self.environment is None:
            self.environment = {}
        
        if self.max_steps is None:
            self.max_steps = 10
            
        if self.timeout_seconds is None:
            self.timeout_seconds = 300  # 5 minutes default
    
    @property
    def is_capability_mode(self) -> bool:
        """Check if execution is capability-based."""
        return self.mode == ExecutionMode.CAPABILITY_BASED
    
    @property
    def is_instruction_mode(self) -> bool:
        """Check if execution is instruction-based."""
        return self.mode == ExecutionMode.INSTRUCTION_BASED
    
    def with_tools(self, tools: List[str]) -> 'ExecutionContext':
        """Create new context with different tools."""
        return ExecutionContext(
            mode=self.mode,
            instructions=self.instructions,
            available_tools=tools,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            capability_name=self.capability_name,
            max_steps=self.max_steps,
            timeout_seconds=self.timeout_seconds,
            environment=self.environment.copy()
        )