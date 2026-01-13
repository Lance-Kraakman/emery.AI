"""Step-based skill execution for DAG workflows."""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, asdict, field
from typing import Any, AsyncIterator, Callable, Dict, List, Literal, Optional, Set

from tenacity import (
    AsyncRetrying,
    stop_after_attempt,
    wait_fixed,
    wait_exponential,
    retry_if_exception,
    RetryError
)

from ..grpc.generated import agent_worker_pb2
from ..prompts import render_output_instructions
from ..tools.output_tool import OutputTool
from ..types import SkillExecutionResult
from ..utils.error_classifier import classify_error
from .agent_factory import AgentFactory, AgentConfig
from .tool_loader import UnifiedToolLoader

logger = logging.getLogger(__name__)


# Simple condition pattern: "value operator value"
_CONDITION_PATTERN = re.compile(
    r'^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$'
)


def _flatten_json(obj: Any, prefix: str = '', max_depth: int = 5) -> Dict[str, Any]:
    """Flatten nested JSON object into flat key-value structure.

    Used for converting tool responses into named outputs.
    Nested keys are joined with underscores.
    """
    result: Dict[str, Any] = {}

    if max_depth <= 0 or obj is None:
        if prefix:
            result[prefix] = obj
        return result

    if not isinstance(obj, dict):
        if prefix:
            result[prefix] = obj
        else:
            result['result'] = obj
        return result

    for key, value in obj.items():
        new_key = f"{prefix}_{key}" if prefix else key

        if value is None:
            result[new_key] = None
        elif isinstance(value, (str, int, float, bool)):
            result[new_key] = value
        elif isinstance(value, list):
            # Store arrays as-is (JSON)
            result[new_key] = value
        elif isinstance(value, dict):
            # Recurse into nested objects
            nested = _flatten_json(value, new_key, max_depth - 1)
            result.update(nested)
        else:
            result[new_key] = str(value)

    return result


# =============================================================================
# Internal Dataclasses - Clean types for step execution
# =============================================================================

@dataclass
class StepProgress:
    """Progress update for a single step in a step-based workflow."""
    step: int
    total: int
    id: str  # Step UUID for context keying
    name: str  # Display name
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    result: Optional[str] = None
    error: Optional[str] = None
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
class ErrorConfig:
    """Error handling configuration for a step."""
    continue_on_error: bool = False
    error_output_var: str = "__error__"


@dataclass
class RetryConfig:
    """Retry configuration for error recovery."""
    max_attempts: int = 3
    backoff_ms: int = 1000
    backoff_type: Literal["fixed", "exponential", "linear"] = "exponential"


@dataclass
class StepOutput:
    """Step output routing - determines which steps to execute based on outcome."""
    type: Literal["success", "error", "condition", "default"]
    condition: str = ""
    next_steps: List[str] = field(default_factory=list)


@dataclass
class LoopConfig:
    """Loop configuration for iteration support."""
    type: Literal["for_each", "while", "until"]
    items_var: str = ""          # For for_each: variable containing array
    current_item_var: str = "item"  # Variable name for current item
    condition: str = ""          # For while/until: condition expression
    max_iterations: int = 100    # Safety limit


@dataclass
class ReadConfig:
    """Read configuration for direct table read steps."""
    mode: str = "single_row"
    source_table_id: int = 0
    row_id_source: Optional[Any] = None  # Proto RowIdSource
    query_filters: List[Any] = field(default_factory=list)  # Proto QueryFilter
    query_limit: int = 100
    field_mappings: List[Any] = field(default_factory=list)  # Proto ReadFieldMapping


@dataclass
class WriteConfig:
    """Write configuration for direct table write steps."""
    target_table_id: int = 0
    row_action: str = "create"
    field_mappings: List[Any] = field(default_factory=list)
    update_match: Optional[Any] = None


@dataclass
class ToolExecutionConfig:
    """Tool execution configuration for direct tool call steps."""
    tool_id: str = ""
    input_mappings: List[Any] = field(default_factory=list)
    output_table_id: Optional[int] = None  # Table to store flattened outputs


@dataclass
class TaskModelConfig:
    """Task model configuration for direct inference steps."""
    model_id: str = ""
    task_type: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InputDef:
    """Input definition for a step."""
    name: str
    required: bool = False
    type: str = "text"


@dataclass
class OutputDef:
    """Output definition for a step."""
    name: str
    type: str = "text"


@dataclass
class Step:
    """Internal representation of a workflow step."""
    id: str  # Stable UUID for references (used for step_context keys)
    name: str  # Display name (user-editable)
    instruction: str = ""
    skill_id: int = 0
    tools: List[str] = field(default_factory=list)
    inputs: Dict[str, str] = field(default_factory=dict)
    outputs: Dict[str, str] = field(default_factory=dict)
    condition: str = ""
    input_defs: List[InputDef] = field(default_factory=list)
    output_defs: List[OutputDef] = field(default_factory=list)
    error_config: Optional[ErrorConfig] = None
    retry_config: Optional[RetryConfig] = None
    step_outputs: List[StepOutput] = field(default_factory=list)
    parallel_group: str = ""  # Steps with same group execute concurrently
    loop_config: Optional[LoopConfig] = None  # For iteration support
    # Step-level execution configs (for inline execution nodes)
    read_config: Optional[ReadConfig] = None
    write_config: Optional[WriteConfig] = None
    tool_execution_config: Optional[ToolExecutionConfig] = None
    task_model_config: Optional[TaskModelConfig] = None

    @classmethod
    def from_proto(cls, proto: 'agent_worker_pb2.SkillStep') -> 'Step':
        """Convert proto SkillStep to internal Step."""
        # Parse error config
        error_config = None
        if proto.error_config and proto.error_config.continue_on_error:
            error_config = ErrorConfig(
                continue_on_error=proto.error_config.continue_on_error,
                error_output_var=proto.error_config.error_output_var or "__error__"
            )

        # Parse retry config
        retry_config = None
        if proto.retry_config and proto.retry_config.max_attempts > 0:
            retry_config = RetryConfig(
                max_attempts=proto.retry_config.max_attempts,
                backoff_ms=proto.retry_config.backoff_ms or 1000,
                backoff_type=proto.retry_config.backoff_type or "exponential"
            )

        # Parse step outputs
        step_outputs = []
        for output in proto.step_outputs:
            step_outputs.append(StepOutput(
                type=output.type or "default",
                condition=output.condition or "",
                next_steps=list(output.next_steps)
            ))

        # Parse input/output defs
        input_defs = [
            InputDef(name=d.name, required=d.required, type=d.type or "text")
            for d in proto.input_defs
        ]
        output_defs = [
            OutputDef(name=d.name, type=d.type or "text")
            for d in proto.output_defs
        ]

        # Parse loop config
        loop_config = None
        if proto.loop_config and proto.loop_config.type:
            loop_config = LoopConfig(
                type=proto.loop_config.type,
                items_var=proto.loop_config.items_var or "",
                current_item_var=proto.loop_config.current_item_var or "item",
                condition=proto.loop_config.condition or "",
                max_iterations=proto.loop_config.max_iterations or 100
            )

        # Parse step-level execution configs
        read_config = None
        if proto.HasField('read_config') and proto.read_config.source_table_id:
            read_config = ReadConfig(
                mode=proto.read_config.mode or "single_row",
                source_table_id=proto.read_config.source_table_id,
                row_id_source=proto.read_config.row_id_source if proto.read_config.HasField('row_id_source') else None,
                query_filters=list(proto.read_config.query_filters),
                query_limit=proto.read_config.query_limit or 100,
                field_mappings=list(proto.read_config.field_mappings)
            )

        write_config = None
        if proto.HasField('write_config') and proto.write_config.target_table_id:
            write_config = WriteConfig(
                target_table_id=proto.write_config.target_table_id,
                row_action=proto.write_config.row_action or "create",
                field_mappings=list(proto.write_config.field_mappings),
                update_match=proto.write_config.update_match if proto.write_config.HasField('update_match') else None
            )

        tool_execution_config = None
        if proto.HasField('tool_execution_config') and proto.tool_execution_config.tool_id:
            tool_execution_config = ToolExecutionConfig(
                tool_id=proto.tool_execution_config.tool_id,
                input_mappings=list(proto.tool_execution_config.input_mappings),
                output_table_id=proto.tool_execution_config.output_table_id if proto.tool_execution_config.HasField('output_table_id') else None
            )

        task_model_config = None
        if proto.HasField('task_model_config') and proto.task_model_config.model_id:
            task_model_config = TaskModelConfig(
                model_id=proto.task_model_config.model_id,
                task_type=proto.task_model_config.task_type or "",
                parameters=dict(proto.task_model_config.parameters)
            )

        return cls(
            id=proto.id,
            name=proto.name,
            instruction=proto.instruction or "",
            skill_id=proto.skill_id,
            tools=list(proto.tools),
            inputs=dict(proto.inputs),
            outputs=dict(proto.outputs),
            condition=proto.condition or "",
            input_defs=input_defs,
            output_defs=output_defs,
            error_config=error_config,
            retry_config=retry_config,
            step_outputs=step_outputs,
            parallel_group=proto.parallel_group or "",
            loop_config=loop_config,
            read_config=read_config,
            write_config=write_config,
            tool_execution_config=tool_execution_config,
            task_model_config=task_model_config
        )


# =============================================================================
# Helper Functions
# =============================================================================

def _is_retryable_error(exception: Exception) -> bool:
    """Check if an error should be retried using the error classifier."""
    classified = classify_error(exception)
    return classified.auto_retry


def _get_wait_strategy(config: RetryConfig):
    """Get tenacity wait strategy based on config."""
    if config.backoff_type == "exponential":
        return wait_exponential(
            multiplier=config.backoff_ms / 1000,
            min=config.backoff_ms / 1000,
            max=60
        )
    elif config.backoff_type == "linear":
        return wait_exponential(
            multiplier=config.backoff_ms / 1000,
            min=config.backoff_ms / 1000,
            max=60,
            exp_base=1.5
        )
    else:  # fixed
        return wait_fixed(config.backoff_ms / 1000)


# =============================================================================
# Step Executor Service
# =============================================================================

class StepExecutorService:
    """Execute skills with DAG-based workflows.

    Supports:
    - Sequential execution (steps without output routing)
    - Output-based routing (steps with step_outputs)
    - Error handling with continue_on_error
    - Retry with configurable backoff
    - Conditional branching based on step results
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader,
        agent_factory: AgentFactory,
        skill_executor_callback: Optional[Callable] = None
    ):
        self.tool_loader = tool_loader
        self.agent_factory = agent_factory
        self.skill_executor_callback = skill_executor_callback

    async def execute_steps(
        self,
        steps: List['agent_worker_pb2.SkillStep'],
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
        initial_inputs: Dict[str, Any],
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        _execution_stack: Optional[Set[int]] = None
    ) -> AsyncIterator[StepProgress]:
        """Execute steps as a DAG workflow.

        Args:
            steps: List of SkillStep proto messages
            available_skills: Map of skill_id to SkillConfig for delegation
            initial_inputs: Initial inputs to seed the step_context
            org_model: Organization default model
            api_key: API key for authenticated calls
            organization_id: Organization ID for RLS context
            _execution_stack: Internal - tracks skills in current call chain

        Yields:
            StepProgress updates as each step executes
        """
        # Convert proto steps to internal Step objects
        internal_steps = [Step.from_proto(s) for s in steps]
        step_by_name: Dict[str, Step] = {s.name: s for s in internal_steps}

        # Initialize execution state
        step_context: Dict[str, Any] = dict(initial_inputs)
        execution_stack = _execution_stack if _execution_stack is not None else set()
        executed_steps: Set[str] = set()
        total_steps = len(internal_steps)

        logger.info(f"🚀 Starting DAG execution with {total_steps} steps")

        # Start with the first step
        pending_steps: List[str] = [internal_steps[0].name] if internal_steps else []
        step_counter = 0

        while pending_steps:
            # Get batch of steps to execute (parallel group or single)
            batch = self._get_parallel_batch(pending_steps, step_by_name, executed_steps)

            if not batch:
                continue

            if len(batch) > 1:
                # Parallel execution
                logger.info(f"⚡ Executing {len(batch)} steps in parallel: {[s.name for s in batch]}")
                async for progress in self._execute_parallel_batch(
                    batch=batch,
                    step_counter=step_counter,
                    total_steps=total_steps,
                    step_context=step_context,
                    available_skills=available_skills,
                    execution_stack=execution_stack,
                    org_model=org_model,
                    api_key=api_key,
                    organization_id=organization_id,
                    internal_steps=internal_steps,
                    pending_steps=pending_steps,
                    executed_steps=executed_steps
                ):
                    yield progress
                step_counter += len(batch)
            else:
                # Single step execution
                step = batch[0]
                step_name = step.name
                step_counter += 1
                executed_steps.add(step_name)

                # Yield running status
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="running"
                )

                # Check entry condition
                if step.condition:
                    if not self._evaluate_condition(step.condition, step_context):
                        logger.info(f"⏭️ Step {step_name}: condition not met, skipping")
                        yield StepProgress(
                            step=step_counter,
                            total=total_steps,
                            id=step.id,
                            name=step_name,
                            status="skipped",
                            result="Condition not met"
                        )
                        self._queue_next_steps(
                            step, internal_steps, pending_steps, executed_steps,
                            "success", step_context
                        )
                        continue

                # Execute the step
                retries_attempted = 0
                execution_status: Literal["success", "error"] = "success"

                try:
                    result, retries_attempted = await self._execute_step(
                        step=step,
                        step_context=step_context,
                        available_skills=available_skills,
                        execution_stack=execution_stack,
                        org_model=org_model,
                        api_key=api_key,
                        organization_id=organization_id
                    )

                    # Capture outputs
                    self._capture_outputs(step, result, step_context)

                    result_str = str(result)[:500] if result else "No result"
                    logger.info(f"✅ Step {step_name}: completed")

                    yield StepProgress(
                        step=step_counter,
                        total=total_steps,
                        id=step.id,
                        name=step_name,
                        status="completed",
                        result=result_str,
                        retries_attempted=retries_attempted
                    )

                except Exception as e:
                    error_msg = str(e)
                    error_type = type(e).__name__
                    execution_status = "error"

                    if retries_attempted > 0:
                        logger.error(f"❌ Step {step_name} failed after {retries_attempted} retries: {error_msg}")
                    else:
                        logger.error(f"❌ Step {step_name} failed: {error_msg}")

                    # Store error in context
                    step_error = StepError(
                        message=error_msg,
                        error_type=error_type,
                        step_name=step_name,
                        timestamp=time.time(),
                        retries_attempted=retries_attempted
                    )

                    error_var = step.error_config.error_output_var if step.error_config else "__error__"
                    step_context[error_var] = asdict(step_error)
                    step_context.setdefault("__errors__", {})[step_name] = asdict(step_error)

                    # Check if we should continue
                    continue_on_error = step.error_config and step.error_config.continue_on_error

                    if continue_on_error:
                        logger.info(f"⚠️ Step {step_name} failed but continuing (continue_on_error=True)")
                        yield StepProgress(
                            step=step_counter,
                            total=total_steps,
                            id=step.id,
                            name=step_name,
                            status="failed",
                            error=error_msg,
                            continued_after_error=True,
                            retries_attempted=retries_attempted
                        )
                    else:
                        yield StepProgress(
                            step=step_counter,
                            total=total_steps,
                            id=step.id,
                            name=step_name,
                            status="failed",
                            error=error_msg,
                            retries_attempted=retries_attempted
                        )
                        raise

                # Queue next steps based on outputs
                self._queue_next_steps(
                    step, internal_steps, pending_steps, executed_steps,
                    execution_status, step_context
                )

        logger.info(f"🏁 DAG execution complete: {step_counter} steps executed")

    def _get_parallel_batch(
        self,
        pending_steps: List[str],
        step_by_name: Dict[str, Step],
        executed_steps: Set[str]
    ) -> List[Step]:
        """Get batch of steps to execute - either parallel group or single step."""
        while pending_steps:
            step_name = pending_steps.pop(0)

            # Skip if already executed
            if step_name in executed_steps:
                continue

            step = step_by_name.get(step_name)
            if not step:
                continue

            # If step has a parallel group, find all other pending steps in same group
            if step.parallel_group:
                batch = [step]
                remaining = []

                for other_name in pending_steps:
                    if other_name in executed_steps:
                        continue
                    other_step = step_by_name.get(other_name)
                    if other_step and other_step.parallel_group == step.parallel_group:
                        batch.append(other_step)
                    else:
                        remaining.append(other_name)

                # Update pending_steps to remove batched items
                pending_steps.clear()
                pending_steps.extend(remaining)

                return batch

            return [step]

        return []

    async def _execute_parallel_batch(
        self,
        batch: List[Step],
        step_counter: int,
        total_steps: int,
        step_context: Dict[str, Any],
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
        execution_stack: Set[int],
        org_model: Optional[str],
        api_key: Optional[str],
        organization_id: Optional[int],
        internal_steps: List[Step],
        pending_steps: List[str],
        executed_steps: Set[str]
    ) -> AsyncIterator[StepProgress]:
        """Execute a batch of steps in parallel using asyncio.gather."""
        # Mark all as executed
        for step in batch:
            executed_steps.add(step.name)

        # Yield running status for all
        for i, step in enumerate(batch):
            yield StepProgress(
                step=step_counter + i + 1,
                total=total_steps,
                id=step.id,
                name=step.name,
                status="running"
            )

        # Create tasks for parallel execution
        async def execute_one(step: Step) -> tuple[Step, Any, int, Optional[Exception]]:
            """Execute single step and return result or exception."""
            try:
                result, retries = await self._execute_step(
                    step=step,
                    step_context=step_context,
                    available_skills=available_skills,
                    execution_stack=execution_stack,
                    org_model=org_model,
                    api_key=api_key,
                    organization_id=organization_id
                )
                return step, result, retries, None
            except Exception as e:
                return step, None, 0, e

        # Execute all in parallel
        tasks = [execute_one(step) for step in batch]
        results = await asyncio.gather(*tasks)

        # Process results
        for i, (step, result, retries, error) in enumerate(results):
            step_num = step_counter + i + 1

            if error is None:
                # Success
                self._capture_outputs(step, result, step_context)
                result_str = str(result)[:500] if result else "No result"
                logger.info(f"✅ Step {step.name}: completed (parallel)")

                yield StepProgress(
                    step=step_num,
                    total=total_steps,
                    id=step.id,
                    name=step.name,
                    status="completed",
                    result=result_str,
                    retries_attempted=retries
                )

                self._queue_next_steps(
                    step, internal_steps, pending_steps, executed_steps,
                    "success", step_context
                )
            else:
                # Error
                error_msg = str(error)
                error_type = type(error).__name__
                logger.error(f"❌ Step {step.name} failed (parallel): {error_msg}")

                step_error = StepError(
                    message=error_msg,
                    error_type=error_type,
                    step_name=step.name,
                    timestamp=time.time(),
                    retries_attempted=retries
                )

                error_var = step.error_config.error_output_var if step.error_config else "__error__"
                step_context[error_var] = asdict(step_error)
                step_context.setdefault("__errors__", {})[step.name] = asdict(step_error)

                continue_on_error = step.error_config and step.error_config.continue_on_error

                if continue_on_error:
                    yield StepProgress(
                        step=step_num,
                        total=total_steps,
                        id=step.id,
                        name=step.name,
                        status="failed",
                        error=error_msg,
                        continued_after_error=True,
                        retries_attempted=retries
                    )
                    self._queue_next_steps(
                        step, internal_steps, pending_steps, executed_steps,
                        "error", step_context
                    )
                else:
                    yield StepProgress(
                        step=step_num,
                        total=total_steps,
                        id=step.id,
                        name=step.name,
                        status="failed",
                        error=error_msg,
                        retries_attempted=retries
                    )
                    raise error

    def _queue_next_steps(
        self,
        current_step: Step,
        all_steps: List[Step],
        pending_steps: List[str],
        executed_steps: Set[str],
        execution_status: Literal["success", "error"],
        context: Dict[str, Any]
    ) -> None:
        """Determine and queue next steps based on outputs or sequential order."""
        next_step_names: List[str] = []

        if current_step.step_outputs:
            # Use output-based routing
            next_step_names = self._get_next_steps_from_outputs(
                current_step, execution_status, context
            )
        else:
            # Sequential: find the next step in the array
            try:
                current_idx = next(
                    i for i, s in enumerate(all_steps) if s.name == current_step.name
                )
                if current_idx + 1 < len(all_steps):
                    next_step_names = [all_steps[current_idx + 1].name]
            except StopIteration:
                pass

        # Add to pending (avoid duplicates and already executed)
        for name in next_step_names:
            if name not in executed_steps and name not in pending_steps:
                pending_steps.append(name)
                logger.debug(f"📍 Queued next step: {name}")

    def _get_next_steps_from_outputs(
        self,
        step: Step,
        execution_status: Literal["success", "error"],
        context: Dict[str, Any]
    ) -> List[str]:
        """Determine next steps based on step outputs and execution status."""
        next_steps: List[str] = []
        default_steps: List[str] = []

        for output in step.step_outputs:
            if output.type == "success" and execution_status == "success":
                next_steps.extend(output.next_steps)
                logger.debug(f"📍 Success output: routing to {output.next_steps}")

            elif output.type == "error" and execution_status == "error":
                next_steps.extend(output.next_steps)
                logger.debug(f"📍 Error output: routing to {output.next_steps}")

            elif output.type == "condition" and output.condition:
                if self._evaluate_condition(output.condition, context):
                    next_steps.extend(output.next_steps)
                    logger.debug(f"📍 Condition '{output.condition}' matched: routing to {output.next_steps}")

            elif output.type == "default":
                default_steps.extend(output.next_steps)

        # Use default if no other matches
        if not next_steps and default_steps:
            next_steps = default_steps
            logger.debug(f"📍 Using default output: {default_steps}")

        return next_steps

    async def _execute_step(
        self,
        step: Step,
        step_context: Dict[str, Any],
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
        execution_stack: Set[int],
        org_model: Optional[str],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> tuple[Any, int]:
        """Execute a single step with optional retry and loop support.

        Returns:
            Tuple of (result, retries_attempted)
        """
        # Handle loop execution if configured
        if step.loop_config:
            return await self._execute_step_with_loop(
                step=step,
                step_context=step_context,
                available_skills=available_skills,
                execution_stack=execution_stack,
                org_model=org_model,
                api_key=api_key,
                organization_id=organization_id
            )

        # Resolve inputs
        input_mappings = step.inputs
        if not input_mappings and step.input_defs:
            input_mappings = {d.name: f"{{{{{d.name}}}}}" for d in step.input_defs}
        step_inputs = self._resolve_inputs(input_mappings, step_context)
        logger.info(f"📥 Step {step.name}: resolved {len(step_inputs)} inputs")

        async def _do_execute() -> Any:
            if step.skill_id:
                return await self._execute_skill_step(
                    step, step_inputs, available_skills, org_model,
                    api_key, organization_id, execution_stack
                )
            elif step.read_config:
                return await self._execute_read_step(
                    step, step_inputs, api_key, organization_id
                )
            elif step.write_config:
                return await self._execute_write_step(
                    step, step_inputs, api_key, organization_id
                )
            elif step.tool_execution_config:
                return await self._execute_tool_step(
                    step, step_inputs, api_key, organization_id
                )
            elif step.task_model_config:
                return await self._execute_operation_step(
                    step, step_inputs, api_key, organization_id
                )
            else:
                return await self._execute_inline_step(
                    step, step_inputs, step_context, org_model
                )

        retries_attempted = 0

        if step.retry_config and step.retry_config.max_attempts > 1:
            max_attempts = step.retry_config.max_attempts
            try:
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(max_attempts),
                    wait=_get_wait_strategy(step.retry_config),
                    retry=retry_if_exception(_is_retryable_error),
                    reraise=True
                ):
                    with attempt:
                        retries_attempted = attempt.retry_state.attempt_number - 1
                        if retries_attempted > 0:
                            logger.info(f"🔄 Retry {retries_attempted}/{max_attempts - 1} for step {step.name}")
                        result = await _do_execute()
                return result, retries_attempted
            except RetryError as e:
                retries_attempted = max_attempts - 1
                raise e.last_attempt.exception()
        else:
            result = await _do_execute()
            return result, 0

    async def _execute_step_with_loop(
        self,
        step: Step,
        step_context: Dict[str, Any],
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
        execution_stack: Set[int],
        org_model: Optional[str],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> tuple[Any, int]:
        """Execute a step with loop iteration.

        Supports:
        - for_each: Iterate over array in items_var
        - while: Repeat while condition is true
        - until: Repeat until condition is true

        Returns:
            Tuple of (accumulated results, total retries)
        """
        loop_config = step.loop_config
        if not loop_config:
            raise ValueError("Loop config required for loop execution")

        loop_type = loop_config.type
        max_iterations = loop_config.max_iterations
        current_item_var = loop_config.current_item_var or "item"
        results: List[Any] = []
        total_retries = 0

        logger.info(f"🔁 Starting {loop_type} loop for step {step.name} (max: {max_iterations})")

        # Create a step copy without loop_config to avoid infinite recursion
        step_without_loop = Step(
            name=step.name,
            instruction=step.instruction,
            skill_id=step.skill_id,
            tools=step.tools,
            inputs=step.inputs,
            outputs=step.outputs,
            condition=step.condition,
            input_defs=step.input_defs,
            output_defs=step.output_defs,
            error_config=step.error_config,
            retry_config=step.retry_config,
            step_outputs=step.step_outputs,
            parallel_group=step.parallel_group,
            loop_config=None  # Remove loop config to prevent recursion
        )

        if loop_type == "for_each":
            # Get items from context
            items_var = loop_config.items_var
            if not items_var:
                raise ValueError("for_each loop requires items_var")

            items = step_context.get(items_var, [])
            if not isinstance(items, (list, tuple)):
                logger.warning(f"items_var '{items_var}' is not a list, wrapping as single item")
                items = [items] if items else []

            iteration_count = min(len(items), max_iterations)
            logger.info(f"🔁 for_each: iterating over {iteration_count} items from '{items_var}'")

            for i, item in enumerate(items[:max_iterations]):
                # Set loop variables in context
                step_context[current_item_var] = item
                step_context["__loop_index__"] = i
                step_context["__loop_iteration__"] = i + 1

                logger.info(f"🔁 Iteration {i + 1}/{iteration_count}: {current_item_var}={str(item)[:50]}")

                result, retries = await self._execute_step(
                    step=step_without_loop,
                    step_context=step_context,
                    available_skills=available_skills,
                    execution_stack=execution_stack,
                    org_model=org_model,
                    api_key=api_key,
                    organization_id=organization_id
                )
                results.append(result)
                total_retries += retries

            # Clean up loop variables
            step_context.pop(current_item_var, None)
            step_context.pop("__loop_index__", None)
            step_context.pop("__loop_iteration__", None)

        elif loop_type == "while":
            # Repeat while condition is true
            condition = loop_config.condition
            if not condition:
                raise ValueError("while loop requires condition")

            iteration = 0
            while iteration < max_iterations:
                if not self._evaluate_condition(condition, step_context):
                    logger.info(f"🔁 while loop: condition '{condition}' is false, stopping")
                    break

                step_context["__loop_index__"] = iteration
                step_context["__loop_iteration__"] = iteration + 1

                logger.info(f"🔁 while iteration {iteration + 1}: condition=true")

                result, retries = await self._execute_step(
                    step=step_without_loop,
                    step_context=step_context,
                    available_skills=available_skills,
                    execution_stack=execution_stack,
                    org_model=org_model,
                    api_key=api_key,
                    organization_id=organization_id
                )
                results.append(result)
                total_retries += retries
                iteration += 1

            if iteration >= max_iterations:
                logger.warning(f"🔁 while loop: reached max iterations ({max_iterations})")

            step_context.pop("__loop_index__", None)
            step_context.pop("__loop_iteration__", None)

        elif loop_type == "until":
            # Repeat until condition becomes true
            condition = loop_config.condition
            if not condition:
                raise ValueError("until loop requires condition")

            iteration = 0
            while iteration < max_iterations:
                step_context["__loop_index__"] = iteration
                step_context["__loop_iteration__"] = iteration + 1

                logger.info(f"🔁 until iteration {iteration + 1}")

                result, retries = await self._execute_step(
                    step=step_without_loop,
                    step_context=step_context,
                    available_skills=available_skills,
                    execution_stack=execution_stack,
                    org_model=org_model,
                    api_key=api_key,
                    organization_id=organization_id
                )
                results.append(result)
                total_retries += retries
                iteration += 1

                # Check condition after execution
                if self._evaluate_condition(condition, step_context):
                    logger.info(f"🔁 until loop: condition '{condition}' is now true, stopping")
                    break

            if iteration >= max_iterations:
                logger.warning(f"🔁 until loop: reached max iterations ({max_iterations})")

            step_context.pop("__loop_index__", None)
            step_context.pop("__loop_iteration__", None)

        else:
            raise ValueError(f"Unknown loop type: {loop_type}")

        logger.info(f"🔁 Loop completed: {len(results)} iterations, {total_retries} total retries")

        # Store results array in context
        step_context[f"{step.name}_results"] = results

        return results, total_retries

    async def _execute_skill_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
        org_model: Optional[str],
        api_key: Optional[str],
        organization_id: Optional[int],
        execution_stack: Set[int]
    ) -> Any:
        """Execute a step that references another skill."""
        skill_id = step.skill_id
        skill_config = available_skills.get(skill_id)

        if not skill_config:
            raise ValueError(f"Skill {skill_id} not found in available skills")

        if skill_id in execution_stack:
            raise ValueError(
                f"Circular dependency detected: skill {skill_id} ({skill_config.name}) "
                f"is already executing in current chain"
            )

        logger.info(f"🔗 Delegating to skill: {skill_config.name} (id={skill_id})")

        if not self.skill_executor_callback:
            raise ValueError("No skill executor callback configured for skill delegation")

        execution_stack.add(skill_id)
        try:
            result = self.skill_executor_callback(
                skill_config=skill_config,
                runtime_inputs=step_inputs,
                capture_outputs=True
            )

            if asyncio.iscoroutine(result):
                result = await result

            if isinstance(result, SkillExecutionResult):
                return result.captured_outputs if result.captured_outputs else result.result

            return result
        finally:
            execution_stack.discard(skill_id)

    async def _execute_inline_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        step_context: Dict[str, Any],
        org_model: Optional[str]
    ) -> Any:
        """Execute a step with inline instruction using a sub-agent."""
        instruction = self._inject_context(step.instruction, step_context)
        logger.info(f"📝 Inline step instruction: {instruction[:100]}...")

        step_tools = []
        if step.tools:
            try:
                from ..grpc.generated.agent_worker_pb2 import ToolConfig
                tool_configs = [ToolConfig(name=name) for name in step.tools]
                step_tools = self.tool_loader.load_tools_from_configs(
                    tool_configs=tool_configs,
                    api_key=None,
                    api_key_mode="user"
                )
                logger.info(f"🔧 Loaded {len(step_tools)} tools for step")
            except Exception as e:
                logger.warning(f"Failed to load some step tools: {e}")

        # Add OutputTool if step has output_defs
        output_tool = None
        if step.output_defs:
            proto_outputs = [{'name': d.name, 'type': d.type} for d in step.output_defs]
            output_tool = OutputTool(skill_outputs=proto_outputs)
            step_tools.append(output_tool)
            logger.info(f"📤 Added OutputTool for {len(step.output_defs)} step outputs")

        task_parts = [instruction]
        if step_inputs:
            task_parts.append("\n\nInputs:")
            for key, value in step_inputs.items():
                task_parts.append(f"- {key}: {value}")

        # Add output instructions if OutputTool was added
        if output_tool:
            output_instructions = render_output_instructions(
                [{'name': d.name, 'type': d.type} for d in step.output_defs]
            )
            if output_instructions:
                task_parts.append(f"\n\n{output_instructions}")

        task = "\n".join(task_parts)

        agent_config = AgentConfig(
            tools=step_tools,
            org_model=org_model,
            max_steps=5,
            agent_name=f"step_{step.name}",
            agent_description=f"Sub-agent for step: {step.name}",
            enable_caching=False,
            context_type="autonomous"
        )

        sub_agent = self.agent_factory.create_agent(agent_config)
        result = sub_agent.run(task=task, stream=False, reset=True)

        # Return captured outputs if OutputTool was used
        if output_tool and output_tool.was_called():
            captured = output_tool.get_captured_values()
            logger.info(f"📤 Step {step.name} captured outputs: {list(captured.keys())}")
            return captured

        return result

    async def _execute_read_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> Dict[str, Any]:
        """Execute a direct table read step (no LLM)."""
        import os
        import httpx

        read_config = step.read_config
        if not read_config or not read_config.source_table_id:
            raise ValueError(f"Read step '{step.name}' missing source_table_id")

        table_id = read_config.source_table_id
        mode = read_config.mode or "single_row"

        logger.info(f"📖 Step {step.name}: table read -> table {table_id} ({mode})")

        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        base_url = f"{nextjs_base}/api"

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        async with httpx.AsyncClient(timeout=30.0) as client:
            if mode == "single_row":
                row_id = self._resolve_row_id_source(read_config.row_id_source, step_inputs)
                if not row_id:
                    raise ValueError("Could not resolve row ID for single_row read")

                response = await client.get(
                    f"{base_url}/rows/{table_id}/{row_id}",
                    headers=headers
                )
                if response.status_code >= 400:
                    raise ValueError(f"Table read failed: {response.text[:500]}")

                row = response.json()
                rows = [row] if row else []
            else:  # query mode
                filters = self._build_query_filters(read_config.query_filters, step_inputs)
                limit = read_config.query_limit or 100

                params = {"limit": limit}
                for i, f in enumerate(filters):
                    params[f"filter[field_{f['field_id']}]"] = f"{f['operator']}:{f['value']}"

                response = await client.get(
                    f"{base_url}/rows/{table_id}",
                    headers=headers,
                    params=params
                )
                if response.status_code >= 400:
                    raise ValueError(f"Table query failed: {response.text[:500]}")

                result = response.json()
                rows = result.get("rows", []) if isinstance(result, dict) else result

            # Map fields to output variables
            outputs = {}
            for mapping in read_config.field_mappings:
                field_key = f"field_{mapping.source_field_id}"
                target_var = mapping.target_variable

                if mode == "single_row" and rows:
                    outputs[target_var] = rows[0].get(field_key)
                else:
                    outputs[target_var] = [r.get(field_key) for r in rows]

            logger.info(f"✅ Step {step.name}: read complete, {len(outputs)} outputs")
            return outputs

    async def _execute_write_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> Dict[str, Any]:
        """Execute a direct table write step (no LLM)."""
        import os
        import httpx

        write_config = step.write_config
        if not write_config or not write_config.target_table_id:
            raise ValueError(f"Write step '{step.name}' missing target_table_id")

        table_id = write_config.target_table_id
        row_action = write_config.row_action or "create"

        logger.info(f"📝 Step {step.name}: table write -> table {table_id} ({row_action})")

        # Build field values from mappings
        field_values = {}
        for mapping in write_config.field_mappings:
            skill_input = mapping.skill_input_name
            field_id = str(mapping.target_field_id)
            if skill_input in step_inputs:
                field_values[field_id] = step_inputs[skill_input]

        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        base_url = f"{nextjs_base}/api"

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        async with httpx.AsyncClient(timeout=30.0) as client:
            if row_action == "create":
                response = await client.post(
                    f"{base_url}/rows",
                    headers=headers,
                    json={"tableId": table_id, "data": field_values}
                )
            elif row_action == "update":
                if not write_config.update_match:
                    raise ValueError("Write step update mode requires update_match")
                match_input = write_config.update_match.skill_input_name
                match_field_id = str(write_config.update_match.target_field_id)
                if match_input not in step_inputs:
                    raise ValueError(f"Update match input '{match_input}' not in step inputs")
                match_value = step_inputs[match_input]
                response = await client.put(
                    f"{base_url}/rows",
                    headers=headers,
                    json={
                        "tableId": table_id,
                        "matchField": match_field_id,
                        "matchValue": match_value,
                        "data": field_values
                    }
                )
            else:
                raise ValueError(f"Unknown row_action: {row_action}")

            if response.status_code >= 400:
                raise ValueError(f"Table write failed: {response.text[:500]}")

            result = response.json()
            logger.info(f"✅ Step {step.name}: write complete")
            return result

    async def _execute_tool_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> Any:
        """Execute a direct tool call step (no LLM).

        If output_table_id is configured, the JSON response is flattened
        and returned as named outputs matching table columns.
        """
        tool_config = step.tool_execution_config
        if not tool_config or not tool_config.tool_id:
            raise ValueError(f"Tool step '{step.name}' missing tool_id")

        tool_id = tool_config.tool_id
        logger.info(f"🔧 Step {step.name}: tool execution -> {tool_id}")

        # Build tool inputs from mappings
        tool_inputs = {}
        for mapping in tool_config.input_mappings:
            if mapping.skill_input_name:
                value = step_inputs.get(mapping.skill_input_name)
                if value is not None:
                    tool_inputs[mapping.tool_param] = value
            elif mapping.static_value:
                tool_inputs[mapping.tool_param] = mapping.static_value

        # Load the specific Pipedream tool
        from ..grpc.generated.agent_worker_pb2 import ToolConfig as ProtoToolConfig
        proto_tool_config = ProtoToolConfig(name=tool_id, tool_type="pipedream", config={})

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=[proto_tool_config],
            api_key=api_key,
            api_key_mode="user"
        )

        if not tools:
            raise ValueError(f"Failed to load tool: {tool_id}")

        tool = tools[0]
        result = tool.forward(**tool_inputs)
        logger.info(f"✅ Step {step.name}: tool execution complete")

        # Convert result to dict if needed
        if isinstance(result, dict):
            result_dict = result
        elif isinstance(result, str):
            result_dict = {"result": result}
        else:
            result_dict = {"result": str(result)}

        # If output table is configured, flatten the response for named outputs
        # The flattened keys become available as workflow variables (e.g., {{tool_1.threadId}})
        if tool_config.output_table_id:
            flattened = _flatten_json(result_dict)
            logger.info(f"📊 Step {step.name}: flattened to {len(flattened)} outputs for table {tool_config.output_table_id}")
            return flattened

        return result_dict

    async def _execute_operation_step(
        self,
        step: Step,
        step_inputs: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[int]
    ) -> Any:
        """Execute a direct inference step (no LLM orchestration)."""
        from ..clients import HuggingFaceInferenceClient, TaskResult
        from ..utils import run_async_in_thread

        task_config = step.task_model_config
        if not task_config or not task_config.model_id:
            raise ValueError(f"Operation step '{step.name}' missing model_id")

        model_id = task_config.model_id
        task_type = task_config.task_type
        parameters = task_config.parameters

        logger.info(f"🚀 Step {step.name}: direct inference -> {model_id} ({task_type})")

        client = HuggingFaceInferenceClient()

        if not client.supports_task_type(task_type):
            raise ValueError(f"Task type '{task_type}' not supported")

        # Execute inference (sync wrapper for async client)
        result: TaskResult = run_async_in_thread(
            client.execute_task(
                model_id=model_id,
                task_type=task_type,
                inputs=step_inputs,
                parameters=parameters
            )
        )

        logger.info(f"✅ Step {step.name}: inference complete")

        if result.is_text:
            return {"result": str(result.data)}
        elif result.is_structured:
            return result.data
        else:
            return {"result": f"Binary result: {len(result.data)} bytes"}

    def _resolve_row_id_source(
        self,
        row_id_source: Any,
        step_inputs: Dict[str, Any]
    ) -> Optional[str]:
        """Resolve row ID from source configuration."""
        if not row_id_source:
            return None

        source_type = row_id_source.type
        if source_type == "static":
            return row_id_source.static_id
        elif source_type == "skill_input":
            input_name = row_id_source.skill_input
            return str(step_inputs.get(input_name, ""))
        elif source_type == "skill_output":
            return row_id_source.skill_output
        else:
            logger.warning(f"Unknown row_id_source type: {source_type}")
            return None

    def _build_query_filters(
        self,
        query_filters: List[Any],
        step_inputs: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Build query filters from config."""
        filters = []
        for qf in query_filters:
            field_id = qf.field_id
            operator = qf.operator

            value_source = qf.value_source
            if value_source.type == "static":
                value = value_source.static_id
            elif value_source.type == "skill_input":
                value = step_inputs.get(value_source.skill_input, "")
            else:
                value = ""

            filters.append({
                "field_id": field_id,
                "operator": operator,
                "value": value
            })

        return filters

    def _resolve_inputs(
        self,
        input_mappings: Dict[str, str],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve input mappings from step_context."""
        resolved = {}
        for param_name, source in input_mappings.items():
            if source.startswith("{{") and source.endswith("}}"):
                var_name = source[2:-2].strip()
                if var_name in context:
                    resolved[param_name] = context[var_name]
                else:
                    logger.warning(f"Variable '{var_name}' not found in step context")
            else:
                resolved[param_name] = source
        return resolved

    def _capture_outputs(
        self,
        step: Step,
        result: Any,
        context: Dict[str, Any]
    ) -> None:
        """Capture outputs to step_context."""
        output_mappings = step.outputs
        if not output_mappings and step.output_defs:
            output_mappings = {d.name: d.name for d in step.output_defs}

        if not output_mappings:
            return

        for output_name, target_var in output_mappings.items():
            if isinstance(result, dict):
                if output_name in result:
                    context[target_var] = result[output_name]
                elif output_name == "result":
                    context[target_var] = result
            else:
                context[target_var] = result

        logger.debug(f"📤 Captured outputs: {list(output_mappings.values())}")

    def _inject_context(self, instruction: str, context: Dict[str, Any]) -> str:
        """Replace {{var}} placeholders in instruction."""
        result = instruction
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in result:
                if isinstance(value, (dict, list)):
                    value_str = json.dumps(value)
                else:
                    value_str = str(value)
                result = result.replace(placeholder, value_str)
        return result

    def _evaluate_condition(self, condition: str, context: Dict[str, Any]) -> bool:
        """Safely evaluate simple conditions like '{{count}} > 0'."""
        expr = self._inject_context(condition, context)

        match = _CONDITION_PATTERN.match(expr.strip())
        if not match:
            logger.debug(f"Condition '{expr}' - treating as truthy check")
            return bool(expr.strip())

        left_str, op, right_str = match.groups()
        left = self._parse_value(left_str.strip())
        right = self._parse_value(right_str.strip())

        try:
            if op == '>':
                return left > right
            elif op == '<':
                return left < right
            elif op == '>=':
                return left >= right
            elif op == '<=':
                return left <= right
            elif op == '==':
                return left == right
            elif op == '!=':
                return left != right
        except Exception as e:
            logger.warning(f"Condition comparison failed '{condition}': {e}")
            return False

        return False

    def _parse_value(self, value_str: str) -> Any:
        """Parse a string value into appropriate Python type."""
        try:
            return int(value_str)
        except ValueError:
            pass

        try:
            return float(value_str)
        except ValueError:
            pass

        lower = value_str.lower()
        if lower == 'true':
            return True
        if lower == 'false':
            return False
        if lower in ('none', 'null'):
            return None

        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return value_str[1:-1]

        return value_str


# =============================================================================
# Synchronous Wrapper
# =============================================================================

def execute_steps_sync(
    step_executor: StepExecutorService,
    steps: List['agent_worker_pb2.SkillStep'],
    available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
    initial_inputs: Dict[str, Any],
    org_model: Optional[str] = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> SkillExecutionResult:
    """Synchronous wrapper for step execution."""
    from ..utils import run_async_in_thread

    async def collect_results():
        results = []
        final_result = None

        async for progress in step_executor.execute_steps(
            steps=steps,
            available_skills=available_skills,
            initial_inputs=initial_inputs,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id
        ):
            results.append(progress)
            if progress.status == "completed":
                final_result = progress.result

        return results, final_result

    results, final_result = run_async_in_thread(collect_results())

    captured = {}
    for progress in results:
        if progress.status == "completed" and progress.result:
            captured[progress.id] = progress.result  # Key by ID for output source mapping

    return SkillExecutionResult(
        result=final_result or "Steps completed",
        captured_outputs=captured if captured else None
    )
