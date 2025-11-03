"""
Execution Context Entity (Simplified)

Represents the context for agent task execution without DDD value object overhead.
Uses direct types (int, str) instead of wrapper classes.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from ..types import AgentId, OrganizationId, ExecutionMode

# Import from proto_entities for SkillConfig (protobuf compatible)
from ..proto_entities import SkillConfig


# Constants
DEFAULT_MAX_STEPS = 10
DEFAULT_TIMEOUT_SECONDS = 300


@dataclass
class ExecutionContext:
    """Execution context for agent tasks - simplified without value objects."""

    # Core execution properties
    mode: ExecutionMode
    instructions: str
    available_tools: List[str]

    # Optional context
    agent_id: Optional[AgentId] = None
    organization_id: Optional[OrganizationId] = None
    skill_name: Optional[str] = None
    max_steps: int = DEFAULT_MAX_STEPS
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS

    # Skill configuration for skill-based execution
    skill: Optional[SkillConfig] = None

    # Model selection hierarchy
    agent_model: Optional[str] = None
    org_model: Optional[str] = None

    # Environment data
    environment: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_skill_mode(self) -> bool:
        """Check if execution is skill-based."""
        return self.mode == ExecutionMode.SKILL

    @property
    def is_instruction_mode(self) -> bool:
        """Check if execution is instruction-based."""
        return self.mode == ExecutionMode.INSTRUCTION

    def with_tools(self, tools: List[str]) -> 'ExecutionContext':
        """Create new context with different tools."""
        return ExecutionContext(
            mode=self.mode,
            instructions=self.instructions,
            available_tools=tools,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            skill_name=self.skill_name,
            max_steps=self.max_steps,
            timeout_seconds=self.timeout_seconds,
            skill=self.skill,
            agent_model=self.agent_model,
            org_model=self.org_model,
            environment=self.environment.copy()
        )
