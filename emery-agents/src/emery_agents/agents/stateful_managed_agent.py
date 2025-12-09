"""
StatefulManagedAgent - Managed agent with HITL state persistence.

Overrides __call__ to pass reset=False, preserving memory between calls.
This enables Human-in-the-Loop workflows where the agent:
1. Creates a plan and interrupts
2. User approves
3. Agent resumes with full memory of the plan

AIDEV-NOTE: Regular managed agents reset memory on each call because
smolagents' MultiStepAgent.__call__ calls run() without passing reset=False.
This subclass fixes that by passing reset=False to preserve state.
"""

import logging
from typing import Any

from jinja2 import Template, StrictUndefined
from smolagents import ToolCallingAgent
from smolagents.agents import RunResult
from smolagents.utils import truncate_content

logger = logging.getLogger(__name__)


def populate_template(template: str, variables: dict[str, Any]) -> str:
    """Render a Jinja2 template with variables."""
    compiled_template = Template(template, undefined=StrictUndefined)
    return compiled_template.render(**variables)


class StatefulManagedAgent(ToolCallingAgent):
    """
    A managed agent that preserves memory between calls for HITL workflows.

    Key difference from regular ToolCallingAgent:
    - __call__ passes reset=False to run()
    - Memory persists between calls
    - Can track whether we're in "waiting for approval" state

    Usage:
        agent = StatefulManagedAgent(tools=..., model=..., ...)
        agent.name = "skill_builder"
        agent.description = "..."

        # First call: Creates plan, interrupts
        # agent.__call__("modify skill") -> raises interrupt

        # Second call: Resumes with memory intact
        # agent.__call__("yes proceed") -> executes with full context
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Track HITL state
        self._waiting_for_approval = False

    def __call__(self, task: str, **kwargs):
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
            original_planning_interval = self.planning_interval
            if is_resumption:
                self.planning_interval = None
                logger.info(f"📋 Disabled planning_interval for resume execution")

            try:
                # KEY CHANGE: Pass reset=False to preserve memory
                result = self.run(full_task, reset=False, **kwargs)
            finally:
                # Restore planning interval
                if is_resumption:
                    self.planning_interval = original_planning_interval

            # Format result same as smolagents
            if isinstance(result, RunResult):
                report = result.output
            else:
                report = result

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
        Check if task is a user approval response.

        Returns True for responses like "yes", "proceed", "apply", etc.
        """
        approval_words = {
            "yes", "proceed", "apply", "approve", "ok", "okay", "go ahead",
            "do it", "confirm", "continue", "execute", "approved"
        }

        # Extract just the user's task part (strip manager prompt boilerplate)
        task_lower = task.lower().strip()

        # Check if task is just an approval word
        if task_lower in approval_words:
            return True

        # Check if task starts with approval
        for word in approval_words:
            if task_lower.startswith(word):
                return True

        return False

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
            return f"""The user has approved. Now execute the requested changes.

User said: "{approval}"

IMPORTANT:
- Use the skill_crud tool to make the changes
- Do NOT just describe what you will do - actually do it
- After making changes, verify by reading the skill again
- Report actual success or failure with details"""

        # Build resume task with explicit execution instructions
        return f"""The user has APPROVED your plan. Now EXECUTE the changes immediately.

User said: "{approval}"

YOUR PREVIOUS PLAN:
{plan_content}

CRITICAL INSTRUCTIONS:
1. Do NOT create a new plan - the plan above is already approved
2. Do NOT just describe what you will do
3. IMMEDIATELY call skill_crud(method="update", skill_id=<id>, data={{...}}) with the exact changes from your plan
4. After the update, call skill_crud(method="read", skill_id=<id>) to verify the changes were applied
5. Then call final_answer with the actual result (success with details, or failure with error)

Execute NOW - the user is waiting for the skill to be updated."""

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
                return step.plan
        return None

    def reset_state(self):
        """
        Manually reset agent state and memory.

        Call this when starting a completely new skill modification request,
        not when resuming from an interrupt.
        """
        self.memory.reset()
        self._waiting_for_approval = False
        logger.info(f"🔄 {self.name} state fully reset")
