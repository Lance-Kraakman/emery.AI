"""
Execution Context Entity (Simplified)

Represents the context for agent task execution without DDD value object overhead.
Uses direct types (int, str) instead of wrapper classes.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any, Callable

from emery_agents.entities.models.context_mapping import ResolvedContext
from ..types import AgentId, OrganizationId, ExecutionMode
from ..tools.tool_modes import ToolMode

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
    attachments: List[FileAttachment] = field(default_factory=list)   # Current message files (default)
    session_attachments: List[FileAttachment] = field(default_factory=list)  # All session files (for explicit lookup by name)

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

    # OutputTool reference for capturing agent outputs (set at runtime)
    output_tool: Optional[Any] = None

    # Environment data
    environment: Dict[str, Any] = field(default_factory=dict)

    # Runtime skill inputs from automation inputMappings
    # These are resolved from trigger_data.payload and passed to execute_skill(runtime_inputs=...)
    skill_inputs: Dict[str, Any] = field(default_factory=dict)

    # Row ID that triggered this execution (for table automations with input_mapping)
    source_row_id: Optional[int] = None

    # Use ExecutionCoordinator for two-phase execution (planning → approval → execution)
    # When True, enables HITL approval gates and evaluation loop
    use_coordinator: bool = False

    # Tool mode for HITL enforcement - controls whether mutations are allowed
    # EXECUTION: Full access (default - direct commands work immediately)
    # PLANNING: Read-only operations only (enabled by coordinator for complex tasks)
    tool_mode: ToolMode = ToolMode.EXECUTION

    # Resolved context table mappings for this execution
    # Contains merged mappings with hierarchy priority: step > skill > agent
    resolved_context: Optional[ResolvedContext] = None

    # Progress callback for streaming nested skill execution steps to UI
    # Called with step dicts: {'type': str, 'step_name': str, 'content': str, 'metadata': dict}
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None

    # Centralized tool provider (created once at top level)
    # Provides tools with consistent auth configuration
    # Import here to avoid circular dependency
    tool_provider: Optional[Any] = None  # Type: Optional[ToolProvider]

    # Stored plan for autonomous execution (passed by entry point)
    # When set with mode=AUTONOMOUS, coordinator executes this plan directly
    # Type: Optional[Plan] - using Any to avoid circular import
    plan: Optional[Any] = None

    # Workspace filesystem path for isolated bash execution
    # When set, BashTool is available for file operations in sandboxed environment
    workspace_path: Optional[Path] = None

    @property
    def is_autonomous(self) -> bool:
        """Check if execution is autonomous (skill-based, no HITL)."""
        return self.mode == ExecutionMode.AUTONOMOUS

    @property
    def is_interactive(self) -> bool:
        """Check if execution is interactive (chat-based, with HITL)."""
        return self.mode == ExecutionMode.INTERACTIVE

    def with_tools(self, tools: List[str]) -> 'ExecutionContext':
        """Create new context with different tools."""
        return ExecutionContext(
            mode=self.mode,
            task=self.task,
            available_tools=tools,
            images=self.images,
            attachments=self.attachments,
            session_attachments=self.session_attachments,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            skill_name=self.skill_name,
            max_steps=self.max_steps,
            timeout_seconds=self.timeout_seconds,
            skill=self.skill,
            available_skills=self.available_skills,
            agent_model=self.agent_model,
            org_model=self.org_model,
            environment=self.environment.copy(),
            skill_inputs=self.skill_inputs.copy(),
            source_row_id=self.source_row_id,
            use_coordinator=self.use_coordinator,
            resolved_context=self.resolved_context,
            tool_mode=self.tool_mode,
            tool_provider=self.tool_provider,  # Shared reference (not copied)
            plan=self.plan,  # Shared reference (not copied)
            workspace_path=self.workspace_path,
        )
