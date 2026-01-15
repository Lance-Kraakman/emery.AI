"""
Plan Models

Dataclasses for agent and skill step execution plans.
Plans contain generated detailed execution instructions with tool calls.

Two levels of instructions:
1. Basic Instructions: Human-readable, high-level (stored on entity description/instructions)
2. Plan File: Generated detailed execution plan with tool calls (stored in plan JSONB)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class PlanStepStatus(str, Enum):
    """Status of a plan step during execution."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class PlanStatus(str, Enum):
    """Status of the overall plan."""
    DRAFT = "draft"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


# Forward reference for SubPlan (defined after PlanStep)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from typing import ForwardRef


@dataclass(frozen=True)
class SubPlan:
    """
    Detailed execution plan from a managed agent.

    Generated during cascading planning when a sub-agent runs
    in planning-only mode. Attached to parent PlanStep.
    """
    agent_name: str  # "schema_builder", "skill_builder", etc.
    goal: str
    steps: List["PlanStep"]
    context_gathered: Dict[str, Any] = field(default_factory=dict)
    planning_observations: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agentName": self.agent_name,
            "goal": self.goal,
            "steps": [s.to_dict() for s in self.steps],
            "contextGathered": self.context_gathered,
            "planningObservations": self.planning_observations,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SubPlan":
        """Create from dictionary."""
        return cls(
            agent_name=data.get("agentName", data.get("agent_name", "")),
            goal=data.get("goal", ""),
            steps=[PlanStep.from_dict(s) for s in data.get("steps", [])],
            context_gathered=data.get("contextGathered", data.get("context_gathered", {})),
            planning_observations=data.get("planningObservations", data.get("planning_observations")),
        )


@dataclass(frozen=True)
class PlanStep:
    """
    Individual step within a plan.

    Represents a single action to be taken during plan execution.
    Can optionally contain a sub_plan from cascading planning.
    """
    step_id: str
    description: str
    tool_call: Optional[str] = None  # e.g., "row_crud:read", "tool_executor"
    parameters: Optional[Dict[str, Any]] = None
    context_tables: List[str] = field(default_factory=list)
    status: str = PlanStepStatus.PENDING.value
    result: Optional[str] = None
    error: Optional[str] = None
    # Cascading planning fields
    sub_plan: Optional["SubPlan"] = None  # Detailed plan from sub-agent
    target_agent: Optional[str] = None  # Detected agent for this step

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "stepId": self.step_id,
            "description": self.description,
            "toolCall": self.tool_call,
            "parameters": self.parameters,
            "contextTables": self.context_tables,
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "subPlan": self.sub_plan.to_dict() if self.sub_plan else None,
            "targetAgent": self.target_agent,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlanStep":
        """Create from dictionary."""
        sub_plan_data = data.get("subPlan", data.get("sub_plan"))
        return cls(
            step_id=data.get("stepId", data.get("step_id", "")),
            description=data.get("description", ""),
            tool_call=data.get("toolCall", data.get("tool_call")),
            parameters=data.get("parameters"),
            context_tables=data.get("contextTables", data.get("context_tables", [])),
            status=data.get("status", PlanStepStatus.PENDING.value),
            result=data.get("result"),
            error=data.get("error"),
            sub_plan=SubPlan.from_dict(sub_plan_data) if sub_plan_data else None,
            target_agent=data.get("targetAgent", data.get("target_agent")),
        )

    def mark_in_progress(self) -> "PlanStep":
        """Mark step as in progress."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=self.parameters,
            context_tables=self.context_tables,
            status=PlanStepStatus.IN_PROGRESS.value,
            result=self.result,
            error=self.error,
            sub_plan=self.sub_plan,
            target_agent=self.target_agent,
        )

    def mark_completed(self, result: Optional[str] = None) -> "PlanStep":
        """Mark step as completed with optional result."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=self.parameters,
            context_tables=self.context_tables,
            status=PlanStepStatus.COMPLETED.value,
            result=result or self.result,
            error=None,
            sub_plan=self.sub_plan,
            target_agent=self.target_agent,
        )

    def mark_failed(self, error: str) -> "PlanStep":
        """Mark step as failed with error message."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=self.parameters,
            context_tables=self.context_tables,
            status=PlanStepStatus.FAILED.value,
            result=self.result,
            error=error,
            sub_plan=self.sub_plan,
            target_agent=self.target_agent,
        )

    def with_sub_plan(self, sub_plan: "SubPlan") -> "PlanStep":
        """Return new PlanStep with attached sub_plan."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=self.parameters,
            context_tables=self.context_tables,
            status=self.status,
            result=self.result,
            error=self.error,
            sub_plan=sub_plan,
            target_agent=sub_plan.agent_name,
        )

    def with_target_agent(self, agent_name: str) -> "PlanStep":
        """Return new PlanStep with target_agent set."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=self.parameters,
            context_tables=self.context_tables,
            status=self.status,
            result=self.result,
            error=self.error,
            sub_plan=self.sub_plan,
            target_agent=agent_name,
        )


@dataclass(frozen=True)
class Plan:
    """
    Agent Plan - orchestration logic for how an agent executes.

    Generated from basic instructions (agent description/instructions).
    Contains step-by-step tool calls for execution.
    """
    id: str
    goal: str
    basic_instructions: str
    steps: List[PlanStep]
    status: str = PlanStatus.DRAFT.value
    generated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    version: int = 1
    # Context-first planning fields
    context: Optional[str] = None  # What was discovered (existing databases, tables, etc.)
    analysis: Optional[str] = None  # Analysis/reasoning about what will be done

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "goal": self.goal,
            "basicInstructions": self.basic_instructions,
            "steps": [s.to_dict() for s in self.steps],
            "status": self.status,
            "generatedAt": self.generated_at.isoformat() if self.generated_at else None,
            "approvedAt": self.approved_at.isoformat() if self.approved_at else None,
            "version": self.version,
            "context": self.context,
            "analysis": self.analysis,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Plan":
        """Create from dictionary."""
        generated_at = None
        if data.get("generatedAt"):
            generated_at = datetime.fromisoformat(data["generatedAt"].replace("Z", "+00:00"))
        elif data.get("generated_at"):
            generated_at = datetime.fromisoformat(data["generated_at"].replace("Z", "+00:00"))

        approved_at = None
        if data.get("approvedAt"):
            approved_at = datetime.fromisoformat(data["approvedAt"].replace("Z", "+00:00"))
        elif data.get("approved_at"):
            approved_at = datetime.fromisoformat(data["approved_at"].replace("Z", "+00:00"))

        return cls(
            id=data.get("id", ""),
            goal=data.get("goal", ""),
            basic_instructions=data.get("basicInstructions", data.get("basic_instructions", "")),
            steps=[PlanStep.from_dict(s) for s in data.get("steps", [])],
            status=data.get("status", PlanStatus.DRAFT.value),
            generated_at=generated_at,
            approved_at=approved_at,
            version=data.get("version", 1),
            context=data.get("context"),
            analysis=data.get("analysis"),
        )

    def approve(self) -> "Plan":
        """Create approved copy of the plan."""
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=self.steps,
            status=PlanStatus.APPROVED.value,
            generated_at=self.generated_at,
            approved_at=datetime.utcnow(),
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    def start_execution(self) -> "Plan":
        """Mark plan as executing."""
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=self.steps,
            status=PlanStatus.EXECUTING.value,
            generated_at=self.generated_at,
            approved_at=self.approved_at,
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    def complete(self) -> "Plan":
        """Mark plan as completed."""
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=self.steps,
            status=PlanStatus.COMPLETED.value,
            generated_at=self.generated_at,
            approved_at=self.approved_at,
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    def fail(self) -> "Plan":
        """Mark plan as failed."""
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=self.steps,
            status=PlanStatus.FAILED.value,
            generated_at=self.generated_at,
            approved_at=self.approved_at,
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    def get_pending_steps(self) -> List[PlanStep]:
        """Get all pending steps."""
        return [s for s in self.steps if s.status == PlanStepStatus.PENDING.value]

    def get_next_step(self) -> Optional[PlanStep]:
        """Get the next pending step."""
        pending = self.get_pending_steps()
        return pending[0] if pending else None

    def update_step(self, step_id: str, updated_step: PlanStep) -> "Plan":
        """Return new plan with updated step."""
        new_steps = [
            updated_step if s.step_id == step_id else s
            for s in self.steps
        ]
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=new_steps,
            status=self.status,
            generated_at=self.generated_at,
            approved_at=self.approved_at,
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    def with_steps(self, steps: List[PlanStep]) -> "Plan":
        """Return new plan with replaced steps list."""
        return Plan(
            id=self.id,
            goal=self.goal,
            basic_instructions=self.basic_instructions,
            steps=steps,
            status=self.status,
            generated_at=self.generated_at,
            approved_at=self.approved_at,
            version=self.version,
            context=self.context,
            analysis=self.analysis,
        )

    @property
    def is_complete(self) -> bool:
        """Check if all steps are completed."""
        return all(
            s.status in (PlanStepStatus.COMPLETED.value, PlanStepStatus.SKIPPED.value)
            for s in self.steps
        )

    @property
    def has_failed(self) -> bool:
        """Check if any step has failed."""
        return any(s.status == PlanStepStatus.FAILED.value for s in self.steps)


@dataclass(frozen=True)
class StepPlan(Plan):
    """
    Skill Step Plan - detailed execution plan for agentic steps.

    Extends Plan with parent skill context.
    Used for steps that have LLM decision-making (executionType: 'agentic').
    """
    parent_skill_id: int = 0
    parent_step_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data["parentSkillId"] = self.parent_skill_id
        data["parentStepId"] = self.parent_step_id
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StepPlan":
        """Create from dictionary."""
        base = Plan.from_dict(data)
        return cls(
            id=base.id,
            goal=base.goal,
            basic_instructions=base.basic_instructions,
            steps=base.steps,
            status=base.status,
            generated_at=base.generated_at,
            approved_at=base.approved_at,
            version=base.version,
            parent_skill_id=data.get("parentSkillId", data.get("parent_skill_id", 0)),
            parent_step_id=data.get("parentStepId", data.get("parent_step_id", "")),
        )


def create_plan(
    goal: str,
    basic_instructions: str,
    steps: Optional[List[PlanStep]] = None,
    context: Optional[str] = None,
    analysis: Optional[str] = None,
) -> Plan:
    """
    Factory function to create a new plan.

    Args:
        goal: High-level goal this plan achieves
        basic_instructions: Original instructions this plan was generated from
        steps: Optional list of plan steps
        context: What was discovered (existing databases, tables, etc.)
        analysis: Analysis/reasoning about what will be done

    Returns:
        A new Plan instance in draft status
    """
    import uuid
    return Plan(
        id=str(uuid.uuid4()),
        goal=goal,
        basic_instructions=basic_instructions,
        steps=steps or [],
        status=PlanStatus.DRAFT.value,
        generated_at=datetime.utcnow(),
        context=context,
        analysis=analysis,
    )


def create_step(
    description: str,
    tool_call: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    context_tables: Optional[List[str]] = None,
    target_agent: Optional[str] = None,
) -> PlanStep:
    """
    Factory function to create a new plan step.

    Args:
        description: Human-readable description of what this step does
        tool_call: Tool to execute, e.g., "row_crud:read"
        parameters: Parameters for the tool call
        context_tables: Tables this step needs access to
        target_agent: Name of managed agent to handle this step

    Returns:
        A new PlanStep instance in pending status
    """
    import uuid
    return PlanStep(
        step_id=str(uuid.uuid4()),
        description=description,
        tool_call=tool_call,
        parameters=parameters,
        context_tables=context_tables or [],
        status=PlanStepStatus.PENDING.value,
        target_agent=target_agent,
    )
