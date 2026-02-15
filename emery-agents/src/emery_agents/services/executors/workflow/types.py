"""
Workflow execution types.

Clean internal types for workflow orchestration.

AIDEV-NOTE: Part of Phase 2.3 refactoring (Feb 2026).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from emery_agents.entities.skill_config import (
        AgenticStepConfig,
        ErrorConfig,
        InputDef,
        LoopConfig,
        OutputDef,
        ReadConfig,
        RetryConfig,
        SkillStep,
        StepOutput,
        ToolExecutionConfig,
        WriteConfig,
    )


@dataclass
class StepProgress:
    """Progress update for a single step in a workflow.

    Yielded by WorkflowOrchestrator as each step executes.
    """

    step: int  # 1-indexed step number
    total: int  # Total steps in workflow
    id: str  # Step UUID for context keying
    name: str  # Display name
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    result: str | None = None
    captured_data: dict[str, Any] | None = None
    error: str | None = None
    continued_after_error: bool = False
    retries_attempted: int = 0


@dataclass
class StepError:
    """Error details for storing in step context."""

    message: str
    error_type: str
    step_name: str
    timestamp: float
    retries_attempted: int = 0


@dataclass
class WorkflowStep:
    """Internal representation of a workflow step.

    Converted from SkillStep DTO for clean internal processing.
    """

    id: str  # Stable UUID for references
    name: str  # Display name
    instruction: str = ""
    skill_id: int = 0
    tools: list[str] = field(default_factory=list)
    inputs: dict[str, str] = field(default_factory=dict)
    outputs: dict[str, str] = field(default_factory=dict)
    condition: str = ""
    input_defs: list[InputDef] = field(default_factory=list)
    output_defs: list[OutputDef] = field(default_factory=list)
    error_config: ErrorConfig | None = None
    retry_config: RetryConfig | None = None
    step_outputs: list[StepOutput] = field(default_factory=list)
    parallel_group: str = ""
    loop_config: LoopConfig | None = None
    read_config: ReadConfig | None = None
    write_config: WriteConfig | None = None
    tool_execution_config: ToolExecutionConfig | None = None
    agentic_config: AgenticStepConfig | None = None
    is_disabled: bool = False

    @classmethod
    def from_dto(cls, dto: SkillStep) -> WorkflowStep:
        """Convert SkillStep DTO to internal WorkflowStep."""
        return cls(
            id=dto.id,
            name=dto.name,
            instruction=dto.instruction,
            skill_id=dto.skill_id,
            tools=list(dto.tools),
            inputs=dict(dto.inputs),
            outputs=dict(dto.outputs),
            condition=dto.condition,
            input_defs=list(dto.input_defs),
            output_defs=list(dto.output_defs),
            error_config=dto.error_config,
            retry_config=dto.retry_config,
            step_outputs=list(dto.step_outputs),
            parallel_group=dto.parallel_group,
            loop_config=dto.loop_config,
            read_config=dto.read_config,
            write_config=dto.write_config,
            tool_execution_config=dto.tool_execution_config,
            agentic_config=dto.agentic_config,
            is_disabled=dto.is_disabled,
        )

    @property
    def step_type(self) -> str:
        """Determine step type from configuration."""
        if self.skill_id:
            return "skill"
        if self.read_config:
            return "read"
        if self.write_config:
            return "write"
        if self.tool_execution_config:
            return "tool"
        if self.agentic_config:
            return "agentic"
        return "inline"
