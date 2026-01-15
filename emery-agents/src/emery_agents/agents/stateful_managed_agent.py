"""
StatefulManagedAgent - CodeAgent with HITL state persistence.

Overrides __call__ to pass reset=False, preserving memory between calls.
This enables Human-in-the-Loop workflows where the agent:
1. Creates a plan and interrupts
2. User approves
3. Agent resumes with full memory of the plan

Uses CodeAgent (not ToolCallingAgent) for better planning capabilities.
CodeAgent writes tool calls as Python code, enabling more flexible reasoning.
executor_type="local" runs generated code in the same container.

AIDEV-NOTE: Regular managed agents reset memory on each call because
smolagents' MultiStepAgent.__call__ calls run() without passing reset=False.
This subclass fixes that by passing reset=False to preserve state.
"""

import logging
from typing import Any, Callable, Optional, Dict, Union, cast

from jinja2 import Template, StrictUndefined
from smolagents import CodeAgent
from smolagents.agents import RunResult
from smolagents.memory import ActionStep, PlanningStep, FinalAnswerStep
from smolagents.utils import truncate_content

from ..prompts import get_managed_agent_templates, get_planning_templates, get_hitl_templates
from ..services.context_manager import get_current_context
from ..utils.step_utils import step_to_progress_dict, RawProgressDict

logger = logging.getLogger(__name__)


def populate_template(template: str, variables: Dict[str, Any]) -> str:
    """Render a Jinja2 template with variables."""
    compiled_template = Template(template, undefined=StrictUndefined)
    return compiled_template.render(**variables)


class StatefulManagedAgent(CodeAgent):  # type: ignore[misc]
    """
    A managed agent that preserves memory between calls for HITL workflows.

    Key difference from regular CodeAgent:
    - __call__ passes reset=False to run()
    - Memory persists between calls
    - Can track whether we're in "waiting for approval" state

    Uses CodeAgent (not ToolCallingAgent) for better planning capabilities.
    CodeAgent writes tool calls as Python code, which provides more flexible
    reasoning for complex multi-step plans.

    Usage:
        agent = StatefulManagedAgent(tools=..., model=..., ...)
        agent.name = "skill_builder"
        agent.description = "..."

        # First call: Creates plan, interrupts
        # agent.__call__("modify skill") -> raises interrupt

        # Second call: Resumes with memory intact
        # agent.__call__("yes proceed") -> executes with full context
    """

    def __init__(
        self,
        *args: Any,
        executor_type: str = "local",
        progress_callback: Optional[Callable[[RawProgressDict], None]] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(*args, executor_type=executor_type, **kwargs)
        # Track HITL state
        self._waiting_for_approval = False
        # Progress callback for streaming nested steps to parent
        self._progress_callback = progress_callback

        # Override managed_agent templates to use plain text instead of verbose markdown
        # smolagents default forces "### 1. Task outcome (short version):" etc. which is too verbose
        # Templates are in prompts/base/managed_agent_task.j2 and managed_agent_report.j2
        self.prompt_templates["managed_agent"] = get_managed_agent_templates()

        # Override planning templates with concise format
        # smolagents default uses verbose "Here are the facts I know..." format
        # Templates are in prompts/planning/
        self.prompt_templates["planning"] = get_planning_templates()

        # Load HITL resume templates for _build_resume_task
        # Templates are in prompts/hitl/
        self._hitl_templates = get_hitl_templates()

        # Debug: Log system prompt to verify instructions are included
        logger.info(f"📋 {self.__class__.__name__} system_prompt length: {len(self.system_prompt)}")
        logger.info(f"📋 System prompt preview (first 500 chars):\n{self.system_prompt[:500]}")

    def __call__(self, task: str, **kwargs: Any) -> str:
        """
        Override to preserve memory between calls (reset=False) and inject
        resume context when user approves a plan.

        Key changes from smolagents' default behavior:
        1. Pass reset=False to preserve memory for HITL workflows
        2. On approval, inject explicit "EXECUTE NOW" instructions with the plan
        3. Disable planning_interval on resume to prevent re-planning
        """
        # Check if this is a resumption after approval
        is_resumption = self._is_approval_response(task)

        if is_resumption and self._waiting_for_approval:
            logger.info(f"📋 Resuming {self.name} with approval: {task[:50]}...")
            self._waiting_for_approval = False

            # CRITICAL: Inject explicit execution instructions with the plan
            task = self._build_resume_task(task)
            logger.info(f"📋 Injected resume task ({len(task)} chars)")

        # Build the full task prompt (same as smolagents)
        full_task = populate_template(
            self.prompt_templates["managed_agent"]["task"],
            variables=dict(name=self.name, task=task),
        )

        try:
            # Disable planning on resume to prevent re-planning
            original_planning_interval: Optional[int] = self.planning_interval  # type: ignore[has-type]
            if is_resumption:
                self.planning_interval = None
                logger.info(f"📋 Disabled planning_interval for resume execution")

            try:
                # KEY CHANGE: Use stream=True for progress streaming + reset=False for HITL
                # AIDEV-NOTE: Get progress_callback from ExecutionContext (set by parent)
                # This enables late binding - callback is set after agent is created
                context = get_current_context()
                active_callback = context.progress_callback if context else self._progress_callback

                if active_callback:
                    result = None
                    step_index = 0
                    logger.info(f"🔄 {self.name}: Starting streaming execution with progress callback")

                    for step in self.run(full_task, reset=False, stream=True, **kwargs):
                        # Emit progress callback for each step
                        step_dict = self._step_to_progress_dict(step, step_index)
                        if step_dict:
                            active_callback(step_dict)  # type: ignore[arg-type]
                            logger.debug(f"📤 {self.name}: Emitted step {step_index}: {step_dict.get('step_name')}")

                        # Capture final result
                        if isinstance(step, FinalAnswerStep):
                            result = step.output
                        elif isinstance(step, RunResult):
                            result = step.output

                        step_index += 1

                    # Fallback if no explicit final answer
                    if result is None:
                        result = self.memory.steps[-1] if self.memory.steps else ""
                        logger.info(f"🔄 {self.name}: Using fallback result from memory")

                    logger.info(f"✅ {self.name}: Completed streaming execution ({step_index} steps)")
                    report = result
                else:
                    # Original non-streaming execution
                    result = self.run(full_task, reset=False, **kwargs)
                    # Format result same as smolagents
                    if isinstance(result, RunResult):
                        report = result.output
                    else:
                        report = result
            finally:
                # Restore planning interval
                if is_resumption:
                    self.planning_interval = original_planning_interval

            answer = populate_template(
                self.prompt_templates["managed_agent"]["report"],
                variables=dict(name=self.name, final_answer=report)
            )

            # Add summary if enabled
            if self.provide_run_summary:
                answer += "\n\nFor more detail, find below a summary of this agent's work:\n<summary_of_work>\n"
                for message in self.write_memory_to_messages(summary_mode=True):
                    content = message.content
                    answer += "\n" + truncate_content(str(content)) + "\n---"
                answer += "\n</summary_of_work>"

            return answer

        except Exception as e:
            # Check if this was an interrupt (HITL pause)
            if "interrupted" in str(e).lower():
                self._waiting_for_approval = True
                logger.info(f"⏸️ {self.name} interrupted, waiting for approval")
            raise

    def _is_approval_response(self, task: str) -> bool:
        """
        Check if task is a structured approval response from UI button.

        AIDEV-NOTE: Only accepts structured response from AwaitingInputCard.
        No natural language parsing - user must click "Approve" button
        or type custom feedback which is NOT an approval.
        """
        task_lower = task.lower().strip()
        # ONLY accept structured approval from button click
        return task_lower == "approve"

    def _build_resume_task(self, approval: str) -> str:
        """
        Build a task that explicitly instructs the model to execute its previous plan.

        CRITICAL: This is the key to making HITL work. When the user says "yes proceed",
        we don't just pass that through - we inject explicit instructions telling the
        model to EXECUTE the plan it made, not create a new one.

        Args:
            approval: The user's approval response (e.g., "yes proceed")

        Returns:
            A task string with explicit execution instructions and the plan content
        """
        # Find the PlanningStep in memory to get the plan
        plan_content = self._get_plan_from_memory()

        if not plan_content:
            # Fallback - just pass approval through with generic instructions
            logger.warning(f"⚠️ No plan found in memory for resume, using generic instructions")
            return populate_template(
                self._hitl_templates["resume_fallback"],
                {"approval": approval}
            )

        # Build resume task with explicit execution instructions
        return populate_template(
            self._hitl_templates["resume_with_plan"],
            {"approval": approval, "plan_content": plan_content}
        )

    def _get_plan_from_memory(self) -> str | None:
        """
        Extract the most recent plan from agent memory.

        Looks for PlanningStep objects in memory and returns the plan content.

        Returns:
            The plan content string, or None if no plan found
        """
        for step in reversed(self.memory.steps):
            # Check for PlanningStep (has 'plan' attribute)
            if hasattr(step, 'plan') and step.plan:
                logger.info(f"📋 Found plan in memory ({len(step.plan)} chars)")
                return step.plan  # type: ignore[no-any-return]
        return None

    def reset_state(self) -> None:
        """
        Manually reset agent state and memory.

        Call this when starting a completely new skill modification request,
        not when resuming from an interrupt.
        """
        self.memory.reset()
        self._waiting_for_approval = False
        logger.info(f"🔄 {self.name} state fully reset")

    def _step_to_progress_dict(self, step: Any, index: int) -> Optional[RawProgressDict]:
        """Delegate to shared utility for step-to-dict conversion."""
        return step_to_progress_dict(step, index, self.name or "managed_agent")
