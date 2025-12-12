"""
Execution Context Entity (Simplified)

Represents the context for agent task execution without DDD value object overhead.
Uses direct types (int, str) instead of wrapper classes.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from ..types import AgentId, OrganizationId, ExecutionMode

# Import from generated protobuf
from ..grpc.generated.agent_worker_pb2 import SkillConfig, ImageAttachment, FileAttachment


# Constants
DEFAULT_MAX_STEPS = 10
DEFAULT_TIMEOUT_SECONDS = 300


@dataclass
class ExecutionContext:
    """
    Execution context for agent tasks - aligned with smolagents API.

    AIDEV-NOTE: Task instruction format aligned with smolagents agent.run():
    - task: Main text instruction → agent.run(task=...)
    - images: Image URLs → downloaded to PIL.Image → agent.run(images=[...])
    - attachments: File metadata (preprocessed files already in task text)
    """

    # Core execution properties
    mode: ExecutionMode
    task: str                              # Main instruction text (changed from 'instructions')
    available_tools: List[str]

    # Multimodal content (optional)
    images: List[ImageAttachment] = field(default_factory=list)       # Image URLs
    attachments: List[FileAttachment] = field(default_factory=list)   # File metadata

    # Optional context
    agent_id: Optional[AgentId] = None
    organization_id: Optional[OrganizationId] = None
    skill_name: Optional[str] = None
    max_steps: int = DEFAULT_MAX_STEPS
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS

    # Skill configuration for skill-based execution
    skill: Optional[SkillConfig] = None

    # Available skills for delegation (skill-as-tool)
    # When set, these skills can be invoked as tools by the executing agent
    available_skills: List[SkillConfig] = field(default_factory=list)

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
            task=self.task,
            available_tools=tools,
            images=self.images,
            attachments=self.attachments,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            skill_name=self.skill_name,
            max_steps=self.max_steps,
            timeout_seconds=self.timeout_seconds,
            skill=self.skill,
            available_skills=self.available_skills,
            agent_model=self.agent_model,
            org_model=self.org_model,
            environment=self.environment.copy()
        )
