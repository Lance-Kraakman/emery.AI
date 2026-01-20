"""
Plan Models

Dataclasses for agent and skill step execution plans.
Plans contain generated detailed execution instructions with tool calls.

Two levels of instructions:
1. Basic Instructions: Human-readable, high-level (stored on entity description/instructions)
2. Plan File: Generated detailed execution plan with tool calls (stored in plan JSONB)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from enum import Enum
import json

if TYPE_CHECKING:
    from ..grpc.generated.agent_worker_pb2 import StoredPlan as StoredPlanProto
    from ..grpc.generated.agent_worker_pb2 import StoredPlanStep as StoredPlanStepProto
    from ..grpc.generated.agent_worker_pb2 import StoredSubPlan as StoredSubPlanProto


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

    @classmethod
    def from_stored_proto(cls, proto: "StoredSubPlanProto") -> "SubPlan":
        """Create SubPlan from StoredSubPlan proto message.

        Used when hydrating stored plans from agentic step configs.
        """
        return cls(
            agent_name=proto.agent_name or "",
            goal=proto.goal or "",
            steps=[PlanStep.from_stored_proto(s) for s in proto.steps],
            context_gathered={},  # Not stored in proto
            planning_observations=proto.planning_observations or None,
        )

    def with_steps(self, steps: List["PlanStep"]) -> "SubPlan":
        """Return new SubPlan with updated steps.

        Used in recursive cascade planning to attach nested sub-plans.
        """
        return SubPlan(
            agent_name=self.agent_name,
            goal=self.goal,
            steps=steps,
            context_gathered=self.context_gathered,
            planning_observations=self.planning_observations,
        )


@dataclass(frozen=True)
class PlanStep:
    """
    Individual step within a plan.

    Represents a single action to be taken during plan execution.
    Can optionally contain a sub_plan from cascading planning.

    For skill templates (autonomous execution):
    - prompt_template: Jinja2 template for the execution prompt, with {{ variables }}
    - required_context: List of variable names needed at runtime

    For OAuth connection requirements:
    - connection_required: App slug (e.g., "slack", "gmail") that needs OAuth connection
      If set, this step is a prerequisite that requires user to connect the app.
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
    # Prompt template fields for autonomous execution
    prompt_template: Optional[str] = None  # Jinja2 template with {{ variables }}
    required_context: List[str] = field(default_factory=list)  # Variables needed at runtime
    # OAuth connection requirement (Phase 2: discover_tools integration)
    connection_required: Optional[str] = None  # App slug requiring connection (e.g., "slack", "gmail")
    # Phase grouping fields for hierarchical planning
    phase_name: Optional[str] = None  # e.g., "Discovery", "Filtering", "Summary"
    phase_order: Optional[int] = None  # e.g., 1, 2, 3 for ordering phases
    replan_after: bool = False  # If True, replan subsequent phases after this step's phase completes

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
            "promptTemplate": self.prompt_template,
            "requiredContext": self.required_context,
            "connectionRequired": self.connection_required,
            "phaseName": self.phase_name,
            "phaseOrder": self.phase_order,
            "replanAfter": self.replan_after,
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
            prompt_template=data.get("promptTemplate", data.get("prompt_template")),
            required_context=data.get("requiredContext", data.get("required_context", [])),
            connection_required=data.get("connectionRequired", data.get("connection_required")),
            phase_name=data.get("phaseName", data.get("phase_name")),
            phase_order=data.get("phaseOrder", data.get("phase_order")),
            replan_after=data.get("replanAfter", data.get("replan_after", False)),
        )

    @classmethod
    def from_stored_proto(cls, proto: "StoredPlanStepProto") -> "PlanStep":
        """Create PlanStep from StoredPlanStep proto message.

        Used when hydrating stored plans from agentic step configs.
        Proto parameters are stored as string map - parse JSON values.
        """
        # Parse parameters: proto stores as Map[str, str], parse JSON values
        parameters: Optional[Dict[str, Any]] = None
        if proto.parameters:
            parameters = {}
            for key, value in proto.parameters.items():
                try:
                    parameters[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    parameters[key] = value

        return cls(
            step_id=proto.step_id or "",
            description=proto.description or "",
            tool_call=proto.tool_call or None,
            parameters=parameters,
            context_tables=list(proto.context_tables),
            status=PlanStepStatus.PENDING.value,  # Fresh execution
            result=None,  # No result yet
            error=None,  # No error yet
            sub_plan=SubPlan.from_stored_proto(proto.sub_plan) if proto.sub_plan.agent_name else None,
            target_agent=proto.target_agent or None,
            prompt_template=proto.prompt_template or None,
            required_context=list(proto.required_context) if proto.required_context else [],
            connection_required=proto.connection_required if hasattr(proto, 'connection_required') and proto.connection_required else None,
            phase_name=proto.phase_name if hasattr(proto, 'phase_name') and proto.phase_name else None,
            phase_order=proto.phase_order if hasattr(proto, 'phase_order') and proto.phase_order else None,
            replan_after=proto.replan_after if hasattr(proto, 'replan_after') else False,
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
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
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
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
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
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
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
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
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
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
        )

    def with_parameters(self, parameters: Dict[str, Any]) -> "PlanStep":
        """Return new PlanStep with updated parameters."""
        return PlanStep(
            step_id=self.step_id,
            description=self.description,
            tool_call=self.tool_call,
            parameters=parameters,
            context_tables=self.context_tables,
            status=PlanStepStatus.PENDING.value,  # Reset to pending for retry
            result=None,
            error=None,
            sub_plan=self.sub_plan,
            target_agent=self.target_agent,
            prompt_template=self.prompt_template,
            required_context=self.required_context,
            connection_required=self.connection_required,
            phase_name=self.phase_name,
            phase_order=self.phase_order,
            replan_after=self.replan_after,
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

    def to_stored_dict(self) -> Dict[str, Any]:
        """Convert Plan to StoredPlan format for persistence.

        Strips runtime fields (status, result, error) keeping only
        the execution blueprint. Used when saving plans to skills.
        """
        return {
            "id": self.id,
            "goal": self.goal,
            "basicInstructions": self.basic_instructions,
            "context": self.context,
            "analysis": self.analysis,
            "steps": [self._step_to_stored(s) for s in self.steps],
            "version": self.version,
            "generatedAt": self.generated_at.isoformat() if self.generated_at else None,
            "approvedAt": self.approved_at.isoformat() if self.approved_at else None,
        }

    def _step_to_stored(self, step: PlanStep) -> Dict[str, Any]:
        """Convert PlanStep to stored format (no runtime fields)."""
        result: Dict[str, Any] = {
            "stepId": step.step_id,
            "description": step.description,
        }
        if step.tool_call:
            result["toolCall"] = step.tool_call
        if step.parameters:
            result["parameters"] = step.parameters
        if step.context_tables:
            result["contextTables"] = step.context_tables
        if step.target_agent:
            result["targetAgent"] = step.target_agent
        if step.prompt_template:
            result["promptTemplate"] = step.prompt_template
        if step.required_context:
            result["requiredContext"] = step.required_context
        if step.connection_required:
            result["connectionRequired"] = step.connection_required
        if step.phase_name:
            result["phaseName"] = step.phase_name
        if step.phase_order is not None:
            result["phaseOrder"] = step.phase_order
        if step.replan_after:
            result["replanAfter"] = step.replan_after
        if step.sub_plan:
            result["subPlan"] = {
                "agentName": step.sub_plan.agent_name,
                "goal": step.sub_plan.goal,
                "steps": [self._step_to_stored(s) for s in step.sub_plan.steps],
                "planningObservations": step.sub_plan.planning_observations,
            }
        return result

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

    @classmethod
    def from_stored_proto(cls, proto: "StoredPlanProto") -> "Plan":
        """Create Plan from StoredPlan proto message.

        Used when executing agentic steps with pre-approved plans.
        Sets status to APPROVED since stored plans are pre-approved.

        Args:
            proto: StoredPlan proto message from AgenticStepConfig.plan

        Returns:
            Plan ready for execution (status=APPROVED)
        """
        generated_at = None
        if proto.generated_at:
            try:
                generated_at = datetime.fromisoformat(proto.generated_at.replace("Z", "+00:00"))
            except ValueError:
                pass  # Invalid timestamp, leave as None

        approved_at = None
        if proto.approved_at:
            try:
                approved_at = datetime.fromisoformat(proto.approved_at.replace("Z", "+00:00"))
            except ValueError:
                pass  # Invalid timestamp, leave as None

        return cls(
            id=proto.id or "",
            goal=proto.goal or "",
            basic_instructions=proto.basic_instructions or "",
            context=proto.context or None,
            analysis=proto.analysis or None,
            steps=[PlanStep.from_stored_proto(s) for s in proto.steps],
            status=PlanStatus.APPROVED.value,  # Pre-approved for execution
            generated_at=generated_at,
            approved_at=approved_at or datetime.now(timezone.utc),  # Set now if not provided
            version=proto.version or 1,
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
            approved_at=datetime.now(timezone.utc),
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
        generated_at=datetime.now(timezone.utc),
        context=context,
        analysis=analysis,
    )


def create_step(
    description: str,
    tool_call: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    context_tables: Optional[List[str]] = None,
    target_agent: Optional[str] = None,
    prompt_template: Optional[str] = None,
    required_context: Optional[List[str]] = None,
    connection_required: Optional[str] = None,
    phase_name: Optional[str] = None,
    phase_order: Optional[int] = None,
    replan_after: bool = False,
) -> PlanStep:
    """
    Factory function to create a new plan step.

    Args:
        description: Human-readable description of what this step does
        tool_call: Tool to execute, e.g., "row_crud:read"
        parameters: Parameters for the tool call
        context_tables: Tables this step needs access to
        target_agent: Name of managed agent to handle this step
        prompt_template: Jinja2 template for autonomous execution
        required_context: Variables needed at runtime for the template
        connection_required: App slug requiring OAuth connection (e.g., "slack", "gmail")
        phase_name: Phase this step belongs to (e.g., "Discovery", "Filtering")
        phase_order: Order of this step's phase (1, 2, 3...)
        replan_after: If True, replan subsequent phases after this step's phase completes

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
        prompt_template=prompt_template,
        required_context=required_context or [],
        connection_required=connection_required,
        phase_name=phase_name,
        phase_order=phase_order,
        replan_after=replan_after,
    )


@dataclass
class RecoveryResult:
    """
    Result of recovery analysis for a failed step.

    Contains corrected parameters and confidence level.
    Used by PlanService.analyze_step_failure() and ExecutionCoordinator.
    """

    confidence: float  # 0.0-1.0
    corrected_parameters: Dict[str, Any]  # Parameters to add/change
    reasoning: str  # LLM's explanation
    questions: List[str] = field(default_factory=list)  # Questions if low confidence

    @property
    def should_auto_fix(self) -> bool:
        """High confidence - auto-execute the fix."""
        return self.confidence >= 0.8

    @property
    def should_propose(self) -> bool:
        """Medium confidence - propose fix for user approval."""
        return 0.5 <= self.confidence < 0.8

    @property
    def should_ask_user(self) -> bool:
        """Low confidence - ask user for guidance."""
        return self.confidence < 0.5
