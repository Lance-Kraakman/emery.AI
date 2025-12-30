"""Step-based skill execution for DAG workflows."""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Dict, List, Literal, Optional, Set

from ..grpc.generated import agent_worker_pb2
from ..types import SkillExecutionResult
from .agent_factory import AgentFactory, AgentConfig
from .tool_loader import UnifiedToolLoader

logger = logging.getLogger(__name__)


# Simple condition pattern: "value operator value"
# Supports: >, <, >=, <=, ==, !=
_CONDITION_PATTERN = re.compile(
    r'^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$'
)


@dataclass
class StepProgress:
    """Progress update for a single step in a step-based workflow."""
    step: int
    total: int
    name: str
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    result: Optional[str] = None
    error: Optional[str] = None


class StepExecutorService:
    """Execute skills with step-based workflows (DAG execution).

    Handles execution_type='agent' skills that have a steps[] configuration.
    Each step can either:
    - Execute an inline instruction with a sub-agent
    - Delegate to another skill by skill_id

    Data is passed between steps via a shared step_context using
    {{variable}} syntax in inputs/outputs.
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader,
        agent_factory: AgentFactory,
        skill_executor_callback: Optional[Callable] = None
    ):
        """Initialize step executor.

        Args:
            tool_loader: Tool loader for creating step-specific tools
            agent_factory: Factory for creating sub-agents per step
            skill_executor_callback: Callback to execute delegated skills
        """
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
        """Execute steps sequentially, passing data between them.

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
        # Initialize step context with initial inputs
        step_context: Dict[str, Any] = dict(initial_inputs)
        # Create execution stack for this call chain if not provided
        execution_stack = _execution_stack if _execution_stack is not None else set()

        total_steps = len(steps)
        logger.info(f"🚀 Starting step-based execution with {total_steps} steps")

        for i, step in enumerate(steps):
            step_name = step.name or f"step_{i + 1}"
            step_number = i + 1

            # Yield running status
            yield StepProgress(
                step=step_number,
                total=total_steps,
                name=step_name,
                status="running"
            )

            try:
                # Check condition if specified (future feature)
                if step.condition:
                    condition_result = self._evaluate_condition(step.condition, step_context)
                    if not condition_result:
                        logger.info(f"⏭️ Step {step_name}: condition not met, skipping")
                        yield StepProgress(
                            step=step_number,
                            total=total_steps,
                            name=step_name,
                            status="skipped",
                            result="Skipped (condition not met)"
                        )
                        continue

                # Resolve inputs from step_context
                # Use explicit input mappings if provided, otherwise auto-resolve from inputDefs
                input_mappings = dict(step.inputs)
                if not input_mappings and step.input_defs:
                    # Auto-generate mappings: each inputDef.name looks for same-named context var
                    input_mappings = {id.name: f"{{{{{id.name}}}}}" for id in step.input_defs}
                    logger.debug(f"📥 Auto-generated input mappings from inputDefs: {list(input_mappings.keys())}")
                step_inputs = self._resolve_inputs(input_mappings, step_context)
                logger.info(f"📥 Step {step_name}: resolved {len(step_inputs)} inputs")

                if step.skill_id:
                    # Execute referenced skill
                    result = await self._execute_skill_step(
                        step=step,
                        step_inputs=step_inputs,
                        available_skills=available_skills,
                        org_model=org_model,
                        api_key=api_key,
                        organization_id=organization_id,
                        execution_stack=execution_stack
                    )
                else:
                    # Execute inline instruction with sub-agent
                    result = await self._execute_inline_step(
                        step=step,
                        step_inputs=step_inputs,
                        step_context=step_context,
                        org_model=org_model
                    )

                # Capture outputs to step_context
                # Use explicit output mappings if provided, otherwise auto-generate from outputDefs
                output_mappings = dict(step.outputs)
                if not output_mappings and step.output_defs:
                    # Auto-generate mappings: each outputDef.name maps to itself
                    output_mappings = {od.name: od.name for od in step.output_defs}
                    logger.debug(f"📤 Auto-generated output mappings from outputDefs: {list(output_mappings.keys())}")
                self._capture_outputs(output_mappings, result, step_context)

                result_str = str(result)[:500] if result else "No result"
                logger.info(f"✅ Step {step_name}: completed")

                yield StepProgress(
                    step=step_number,
                    total=total_steps,
                    name=step_name,
                    status="completed",
                    result=result_str
                )

            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Step {step_name} failed: {error_msg}")

                yield StepProgress(
                    step=step_number,
                    total=total_steps,
                    name=step_name,
                    status="failed",
                    error=error_msg
                )

                # Stop execution on failure (can be made configurable later)
                raise

        logger.info(f"🏁 Step-based execution complete: {total_steps} steps")

    async def _execute_skill_step(
        self,
        step: 'agent_worker_pb2.SkillStep',
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

        # Circular dependency detection - only check skills currently executing in this chain
        if skill_id in execution_stack:
            raise ValueError(
                f"Circular dependency detected: skill {skill_id} ({skill_config.name}) "
                f"is already executing in current chain"
            )

        logger.info(f"🔗 Delegating to skill: {skill_config.name} (id={skill_id})")

        if not self.skill_executor_callback:
            raise ValueError("No skill executor callback configured for skill delegation")

        # Add to execution stack for this call chain
        execution_stack.add(skill_id)
        try:
            # Execute via callback (handles operation/tool/write/agent routing)
            result = self.skill_executor_callback(
                skill_config=skill_config,
                runtime_inputs=step_inputs,
                capture_outputs=True  # We need outputs for chaining
            )

            # Await if the callback returns a coroutine
            if asyncio.iscoroutine(result):
                result = await result

            # Handle SkillExecutionResult
            if isinstance(result, SkillExecutionResult):
                # Return captured outputs if available, otherwise the result string
                if result.captured_outputs:
                    return result.captured_outputs
                return result.result

            return result
        finally:
            # Remove from stack when this skill completes
            execution_stack.discard(skill_id)

    async def _execute_inline_step(
        self,
        step: 'agent_worker_pb2.SkillStep',
        step_inputs: Dict[str, Any],
        step_context: Dict[str, Any],
        org_model: Optional[str]
    ) -> Any:
        """Execute a step with inline instruction using a sub-agent."""
        # Inject context into instruction
        instruction = self._inject_context(step.instruction, step_context)

        logger.info(f"📝 Inline step instruction: {instruction[:100]}...")

        # Load only the tools specified for this step
        step_tools = []
        if step.tools:
            try:
                # Create tool configs from tool names
                from ..grpc.generated.agent_worker_pb2 import ToolConfig
                tool_configs = [
                    ToolConfig(name=tool_name)
                    for tool_name in step.tools
                ]
                step_tools = self.tool_loader.load_tools_from_configs(
                    tool_configs=tool_configs,
                    api_key=None,
                    api_key_mode="user"
                )
                logger.info(f"🔧 Loaded {len(step_tools)} tools for step")
            except Exception as e:
                logger.warning(f"Failed to load some step tools: {e}")

        # Add inputs to the task
        task_parts = [instruction]
        if step_inputs:
            task_parts.append("\n\nInputs:")
            for key, value in step_inputs.items():
                task_parts.append(f"- {key}: {value}")

        task = "\n".join(task_parts)

        # Create sub-agent for this step
        agent_config = AgentConfig(
            tools=step_tools,
            org_model=org_model,
            max_steps=5,  # Limit steps per inline execution
            agent_name=f"step_{step.name}",
            agent_description=f"Sub-agent for step: {step.name}",
            enable_caching=False,
            context_type="autonomous"
        )

        sub_agent = self.agent_factory.create_agent(agent_config)

        # Execute
        result = sub_agent.run(task=task, stream=False, reset=True)

        return result

    def _resolve_inputs(
        self,
        input_mappings: Dict[str, str],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve input mappings from step_context.

        Args:
            input_mappings: Map of param_name -> "{{source_var}}" or literal
            context: Current step context with resolved values

        Returns:
            Resolved input values
        """
        resolved = {}
        for param_name, source in input_mappings.items():
            if source.startswith("{{") and source.endswith("}}"):
                # Variable reference
                var_name = source[2:-2].strip()
                if var_name in context:
                    resolved[param_name] = context[var_name]
                else:
                    logger.warning(f"Variable '{var_name}' not found in step context")
            else:
                # Literal value
                resolved[param_name] = source
        return resolved

    def _capture_outputs(
        self,
        output_mappings: Dict[str, str],
        result: Any,
        context: Dict[str, Any]
    ) -> None:
        """Capture outputs to step_context.

        Args:
            output_mappings: Map of output_name -> target_var_name
            result: The step result (can be dict, string, or other)
            context: Step context to update
        """
        if not output_mappings:
            return

        for output_name, target_var in output_mappings.items():
            if isinstance(result, dict):
                # Extract from dict
                if output_name in result:
                    context[target_var] = result[output_name]
                else:
                    # If output_name is "result", use the whole dict
                    if output_name == "result":
                        context[target_var] = result
            else:
                # For non-dict results, use the whole result
                context[target_var] = result

        logger.debug(f"📤 Captured outputs: {list(output_mappings.values())}")

    def _inject_context(self, instruction: str, context: Dict[str, Any]) -> str:
        """Replace {{var}} placeholders in instruction."""
        result = instruction
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in result:
                # Convert value to string for injection
                if isinstance(value, (dict, list)):
                    value_str = json.dumps(value)
                else:
                    value_str = str(value)
                result = result.replace(placeholder, value_str)
        return result

    def _evaluate_condition(self, condition: str, context: Dict[str, Any]) -> bool:
        """Safely evaluate simple conditions like '{{count}} > 0'.

        Supports: >, <, >=, <=, ==, !=
        For complex conditions, returns True (execute the step).
        """
        # Inject context first
        expr = self._inject_context(condition, context)

        # Match simple comparison: "left op right"
        match = _CONDITION_PATTERN.match(expr.strip())
        if not match:
            # If no comparison found, treat as truthy check
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
        # Try as int
        try:
            return int(value_str)
        except ValueError:
            pass

        # Try as float
        try:
            return float(value_str)
        except ValueError:
            pass

        # Handle boolean/null strings
        lower = value_str.lower()
        if lower == 'true':
            return True
        if lower == 'false':
            return False
        if lower in ('none', 'null'):
            return None

        # Handle quoted strings
        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return value_str[1:-1]

        # Return as string
        return value_str


def execute_steps_sync(
    step_executor: StepExecutorService,
    steps: List['agent_worker_pb2.SkillStep'],
    available_skills: Dict[int, 'agent_worker_pb2.SkillConfig'],
    initial_inputs: Dict[str, Any],
    org_model: Optional[str] = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> SkillExecutionResult:
    """Synchronous wrapper for step execution.

    Collects all step progress and returns final result.
    """
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

    # Build captured outputs from all completed steps
    captured = {}
    for progress in results:
        if progress.status == "completed" and progress.result:
            captured[progress.name] = progress.result

    return SkillExecutionResult(
        result=final_result or "Steps completed",
        captured_outputs=captured if captured else None
    )
