"""
Grouped configuration dataclasses.

Phase 1.4: Parameter grouping configs
- AuthConfig, ExecutionConfig, PlanningContextComponents, StepPromptContext

Phase 2.2: Mode-specific request types (replacing ExecutionContext god object)
- InteractiveRequest, SkillRequest, WorkflowRequest, CoordinatorRequest

AIDEV-NOTE: Part of Phase 1.4 and 2.2 refactoring (Feb 2026).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from emery_agents.entities.message import FileAttachment, ImageAttachment
    from emery_agents.entities.models.context_mapping import ResolvedContext
    from emery_agents.entities.models.plan import Plan, PlanStep
    from emery_agents.entities.skill_config import SkillConfig, SkillStep
    from emery_agents.entities.tool_config import ToolConfig


@dataclass(frozen=True)
class AuthConfig:
    """Immutable authentication context.

    Groups scattered api_key/org_id/org_model parameters into a single
    immutable config object. Set once at request boundary.

    Usage:
        auth = AuthConfig(api_key="...", org_id=123, org_model="claude-3-sonnet")
        # Pass auth instead of 3 separate parameters
    """

    api_key: str
    org_id: int
    org_model: str | None = None


@dataclass
class ExecutionConfig:
    """Execution settings for plan step executor.

    Replaces individual parameters in PlanStepExecutor.__init__:
    - api_key, org_id, org_model → auth: AuthConfig
    - max_steps, timeout_seconds → direct fields

    Usage:
        config = ExecutionConfig(
            auth=AuthConfig(api_key="...", org_id=123),
            max_steps=10,
        )
        executor = PlanStepExecutor(config=config, ...)
    """

    auth: AuthConfig
    max_steps: int = 10
    timeout_seconds: int = 300
    skill_model: str | None = None


@dataclass
class PlanningContextComponents:
    """Grouped context for PlannerModule.forward().

    Replaces 7 separate string parameters passed to the planner:
    - retrieved_capabilities, retrieved_patterns, retrieved_knowledge
    - retrieved_strategies, memory_context, triage_analysis

    All fields are optional strings or dicts that get assembled into
    the planning context for LLM consumption.

    Usage:
        ctx = PlanningContextComponents(
            retrieved_capabilities="...",
            memory_context="...",
        )
        result = planner.forward(request, context_components=ctx)
    """

    retrieved_capabilities: str = ""
    retrieved_patterns: str = ""
    retrieved_knowledge: str = ""
    retrieved_strategies: str = ""
    memory_context: str = ""
    triage_analysis: dict[str, Any] | None = None

    def has_retrieved_context(self) -> bool:
        """Check if any retrieved context is present."""
        return bool(
            self.retrieved_capabilities
            or self.retrieved_patterns
            or self.retrieved_knowledge
            or self.retrieved_strategies
        )


@dataclass
class StepPromptContext:
    """Context for building step execution prompts.

    Replaces 8 parameters in _build_step_prompt():
    - goal, current_step, step_index, total_steps
    - completed_steps, remaining_steps
    - resolved_prompt, original_task

    Usage:
        ctx = StepPromptContext(
            goal=plan.goal,
            current_step=step,
            step_index=i,
            total_steps=len(plan.steps),
            completed_steps=completed,
            remaining_steps=remaining,
        )
        prompt = build_step_prompt(ctx)
    """

    goal: str
    current_step: PlanStep
    step_index: int
    total_steps: int
    completed_steps: list[PlanStep] = field(default_factory=list)
    remaining_steps: list[PlanStep] = field(default_factory=list)
    resolved_prompt: str | None = None
    original_task: str | None = None

    @property
    def is_first_step(self) -> bool:
        """Check if this is the first step."""
        return self.step_index == 0

    @property
    def is_last_step(self) -> bool:
        """Check if this is the last step."""
        return self.step_index == self.total_steps - 1

    @property
    def progress_fraction(self) -> float:
        """Get progress as a fraction (0.0 to 1.0)."""
        if self.total_steps == 0:
            return 0.0
        return self.step_index / self.total_steps


# =============================================================================
# Phase 2.2: Mode-Specific Request Types
# =============================================================================


@dataclass
class InteractiveRequest:
    """Request for instruction-based execution (chat direct commands).

    Used when a user sends a direct instruction in chat without a skill context.
    The agent executes the task using available tools and returns a response.

    Replaces ExecutionContext fields:
    - task, available_tools, images, attachments
    - agent_id, organization_id, agent_model, org_model
    """

    task: str
    auth: AuthConfig
    tools: list[ToolConfig] = field(default_factory=list)
    images: list[ImageAttachment] = field(default_factory=list)
    attachments: list[FileAttachment] = field(default_factory=list)
    session_attachments: list[FileAttachment] = field(default_factory=list)
    agent_id: int | None = None
    agent_model: str | None = None
    max_steps: int = 10
    timeout_seconds: int = 300


@dataclass
class SkillRequest:
    """Request for skill-based execution (automations, triggers).

    Used when executing a skill from a trigger, automation, or explicit invocation.
    Contains skill configuration and runtime inputs.

    Replaces ExecutionContext fields:
    - skill, skill_inputs, available_skills
    - source_row_id, resolved_context
    """

    skill: SkillConfig
    inputs: dict[str, Any]
    auth: AuthConfig
    resolved_context: ResolvedContext | None = None
    available_skills: list[SkillConfig] = field(default_factory=list)
    source_row_id: int | None = None
    capture_outputs: bool = False
    skill_model: str | None = None


@dataclass
class WorkflowRequest:
    """Request for DAG workflow execution.

    Used when executing a skill with explicit steps (workflow mode).
    Contains step configurations and initial inputs.

    Replaces ExecutionContext fields:
    - skill.steps, skill_inputs
    """

    steps: list[SkillStep]
    initial_inputs: dict[str, Any]
    auth: AuthConfig
    available_skills: dict[int, SkillConfig] = field(default_factory=dict)
    skill_model: str | None = None


@dataclass
class CoordinatorRequest:
    """Request for two-phase plan-execute execution.

    Used when executing with the coordinator pattern:
    1. Plan generation phase
    2. User approval
    3. Execution phase with evaluation

    Replaces ExecutionContext fields:
    - task, use_coordinator=True, plan
    - tool_mode, workspace_path
    """

    goal: str
    auth: AuthConfig
    tools: list[ToolConfig] = field(default_factory=list)
    images: list[ImageAttachment] = field(default_factory=list)
    attachments: list[FileAttachment] = field(default_factory=list)
    plan: Plan | None = None  # For resuming with existing plan
    workspace_path: Path | None = None
    agent_id: int | None = None
    max_steps: int = 10
