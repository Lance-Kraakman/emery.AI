"""
InterruptAwareToolCallingAgent - Propagates interrupts from managed agents and handles HITL resume.

smolagents wraps ALL exceptions from managed agents as AgentToolExecutionError.
This subclass detects interrupts and re-raises them so they propagate correctly.

AIDEV-NOTE: Pattern matches smolagents' official plan_customization example:
    if "interrupted" in str(e).lower():

This enables Human-in-the-Loop (HITL) workflows where managed agents can
interrupt execution to wait for user approval before proceeding.

HITL Resume Flow:
1. Main agent calls managed agent (skill_builder)
2. Managed agent creates plan, interrupts
3. This class catches interrupt, stores interrupted_agent_name, propagates
4. User approves ("yes")
5. On next run(), this class detects pending approval and calls managed agent
   directly with user's raw message, bypassing LLM task formulation
"""

import logging
from typing import Any

from smolagents import ToolCallingAgent
from smolagents.utils import AgentError, AgentToolExecutionError
from smolagents.agents import RunResult

logger = logging.getLogger(__name__)


class InterruptAwareToolCallingAgent(ToolCallingAgent):
    """
    ToolCallingAgent that propagates interrupts from managed agents and handles HITL resume.

    When a managed agent calls agent.interrupt(), smolagents catches the
    AgentError and wraps it as AgentToolExecutionError. This subclass
    detects that case and re-raises the interrupt so it propagates up
    to the caller for proper HITL handling.

    On resume (next message after interrupt), this class detects the pending
    approval and routes directly to the interrupted managed agent instead of
    letting the LLM formulate a new task description.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Track which managed agent is waiting for approval
        self._interrupted_agent_name: str | None = None

    def run(self, task: str, **kwargs) -> RunResult | str:
        """
        Override run to handle HITL resume flow.

        If a managed agent was interrupted and the user is responding with approval,
        route directly to that managed agent instead of going through LLM.

        Args:
            task: The user's message/task
            **kwargs: Additional arguments for run

        Returns:
            Agent execution result
        """
        # Check if we're resuming from an interrupt
        if self._interrupted_agent_name and self._is_approval_response(task):
            agent_name = self._interrupted_agent_name
            logger.info(f"📋 HITL Resume: Routing '{task[:50]}...' directly to {agent_name}")

            # Clear the interrupt state before calling
            self._interrupted_agent_name = None
            self.interrupt_switch = False

            # Get the managed agent and call it directly with the user's approval
            if agent_name in self.managed_agents:
                managed_agent = self.managed_agents[agent_name]
                try:
                    # Call managed agent directly with user's raw approval message
                    # The StatefulManagedAgent will detect this as approval and execute the plan
                    result = managed_agent(task)
                    logger.info(f"✅ HITL Resume: {agent_name} completed successfully")

                    # AIDEV-NOTE: If streaming mode, return generator yielding FinalAnswerStep.
                    # Otherwise, iterating over a string yields individual characters!
                    if kwargs.get('stream', False):
                        return self._yield_final_answer(result)
                    return result
                except Exception as e:
                    if "interrupted" in str(e).lower():
                        # Another interrupt - store and propagate
                        self._interrupted_agent_name = agent_name
                        logger.info(f"⏸️ HITL Resume: {agent_name} interrupted again")
                        raise AgentError("Agent interrupted.", self.logger) from e
                    raise
            else:
                logger.warning(f"⚠️ Interrupted agent '{agent_name}' not found in managed_agents")
                self._interrupted_agent_name = None

        # Normal flow - let parent handle it
        return super().run(task, **kwargs)

    def _yield_final_answer(self, result: str):
        """
        Yield a single FinalAnswerStep for streaming mode HITL resume.

        When stream=True, agent.run() must return a generator yielding step objects.
        This wraps the managed agent's string result in a FinalAnswerStep.
        """
        from smolagents.memory import FinalAnswerStep
        yield FinalAnswerStep(output=result)

    def _is_approval_response(self, task: str) -> bool:
        """
        Check if task is a user approval response.

        Returns True for short responses that indicate approval like "yes", "proceed", etc.
        """
        approval_words = {
            "yes", "proceed", "apply", "approve", "ok", "okay", "go ahead",
            "do it", "confirm", "continue", "execute", "approved", "y",
            "yes proceed", "yes please", "go", "sure", "yep", "yeah"
        }

        task_lower = task.lower().strip()

        # Check if task is just an approval word/phrase
        if task_lower in approval_words:
            return True

        # Check if task starts with approval word followed by punctuation or space
        for word in approval_words:
            if task_lower.startswith(word) and (
                len(task_lower) == len(word) or
                task_lower[len(word)] in " .,!?;:"
            ):
                return True

        return False

    def execute_tool_call(self, tool_name: str, arguments: dict[str, str] | str) -> Any:
        """
        Execute a tool or managed agent, propagating interrupts.

        Args:
            tool_name: Name of the tool or managed agent to execute.
            arguments: Arguments passed to the tool call.

        Returns:
            Tool execution result.

        Raises:
            AgentError: If the managed agent was interrupted (for HITL).
            AgentToolExecutionError: For other tool execution errors.
        """
        try:
            return super().execute_tool_call(tool_name, arguments)
        except AgentToolExecutionError as e:
            # Check if this was an interrupt from a managed agent
            # Pattern matches smolagents' official plan_customization example
            if "interrupted" in str(e).lower():
                logger.info(f"⏸️ Detected interrupt from managed agent '{tool_name}', propagating")
                # Track which agent was interrupted for HITL resume
                if tool_name in self.managed_agents:
                    self._interrupted_agent_name = tool_name
                    logger.info(f"📋 Stored interrupted agent: {tool_name}")
                # SET THE FLAG so next iteration check in _run_stream breaks out
                # smolagents catches AgentError at line 562 and continues the loop,
                # but the interrupt_switch check at line 511 will stop it next iteration
                self.interrupt_switch = True
                # Re-raise as AgentError so it propagates up for HITL handling
                raise AgentError("Agent interrupted.", self.logger) from e
            raise
