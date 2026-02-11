"""
Execution Context Entity (Simplified)

Represents the context for agent task execution without DDD value object overhead.
Uses direct types (int, str) instead of wrapper classes.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from emery_agents.entities.models.context_mapping import ResolvedContext

from ..types import AgentId, ExecutionMode, OrganizationId, ToolMode
from .message import FileAttachment, ImageAttachment
from .skill_config import SkillConfig

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
    task: str  # Main instruction text (changed from 'instructions')
    available_tools: list[str]

    # Multimodal content (optional)
    images: list[ImageAttachment] = field(default_factory=list)  # Image URLs
    attachments: list[FileAttachment] = field(
        default_factory=list
    )  # Current message files (default)
    session_attachments: list[FileAttachment] = field(
        default_factory=list
    )  # All session files (for explicit lookup by name)

    # Optional context
    agent_id: AgentId | None = None
    organization_id: OrganizationId | None = None
    skill_name: str | None = None
    max_steps: int = DEFAULT_MAX_STEPS
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS

    # Skill configuration for skill-based execution
    skill: SkillConfig | None = None

    # Available skills for delegation (skill-as-tool)
    # When set, these skills can be invoked as tools by the executing agent
    available_skills: list[SkillConfig] = field(default_factory=list)

    # Model selection hierarchy
    agent_model: str | None = None
    org_model: str | None = None

    # OutputTool reference for capturing agent outputs (set at runtime)
    output_tool: Any | None = None

    # Environment data
    environment: dict[str, Any] = field(default_factory=dict)

    # Runtime skill inputs from automation inputMappings
    # These are resolved from trigger_data.payload and passed to execute_skill(runtime_inputs=...)
    skill_inputs: dict[str, Any] = field(default_factory=dict)

    # Row ID that triggered this execution (for table automations with input_mapping)
    source_row_id: int | None = None

    # Use ExecutionCoordinator for two-phase execution (planning → approval → execution)
    # When True, enables HITL approval gates and evaluation loop
    use_coordinator: bool = False

    # Tool mode for HITL enforcement - controls whether mutations are allowed
    # EXECUTION: Full access (default - direct commands work immediately)
    # PLANNING: Read-only operations only (enabled by coordinator for complex tasks)
    tool_mode: ToolMode = ToolMode.EXECUTION

    # Resolved context table mappings for this execution
    # Contains merged mappings with hierarchy priority: step > skill > agent
    resolved_context: ResolvedContext | None = None

    # Progress callback for streaming nested skill execution steps to UI
    # Called with step dicts: {'type': str, 'step_name': str, 'content': str, 'metadata': dict}
    progress_callback: Callable[[dict[str, Any]], None] | None = None

    # Centralized tool provider (created once at top level)
    # Provides tools with consistent auth configuration
    # Import here to avoid circular dependency
    tool_provider: Any | None = None  # Type: Optional[ToolProvider]

    # Stored plan for autonomous execution (passed by entry point)
    # When set with mode=AUTONOMOUS, coordinator executes this plan directly
    # Type: Optional[Plan] - using Any to avoid circular import
    plan: Any | None = None

    # Workspace filesystem path for isolated bash execution
    # When set, BashTool is available for file operations in sandboxed environment
    workspace_path: Path | None = None

    # Network access for bash commands (git, curl, wget)
    # Default True for agents - enables git clone, curl, etc. in sandbox
    # When True, network is routed through filtered proxy (blocks private IPs, AWS metadata)
    allow_network: bool = True

    @property
    def is_autonomous(self) -> bool:
        """Check if execution is autonomous (skill-based, no HITL)."""
        return self.mode == ExecutionMode.AUTONOMOUS

    @property
    def is_interactive(self) -> bool:
        """Check if execution is interactive (chat-based, with HITL)."""
        return self.mode == ExecutionMode.INTERACTIVE

    def with_tools(self, tools: list[str]) -> "ExecutionContext":
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
            allow_network=self.allow_network,
        )
