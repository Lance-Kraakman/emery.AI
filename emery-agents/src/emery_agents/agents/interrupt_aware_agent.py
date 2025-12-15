"""Agents that propagate interrupts from managed agents for HITL workflows."""

import logging
from typing import Any

from smolagents import ToolCallingAgent, CodeAgent
from smolagents.utils import AgentError, AgentToolExecutionError
from smolagents.agents import RunResult

from ._hitl_mixin import HITLMixin

logger = logging.getLogger(__name__)


class InterruptAwareToolCallingAgent(HITLMixin, ToolCallingAgent):
    """ToolCallingAgent that propagates interrupts and handles HITL resume via mixin."""

    def __init__(self, *args, **kwargs):
        HITLMixin.__init__(self)
        super().__init__(*args, **kwargs)

    def run(self, task: str, **kwargs) -> RunResult | str:
        """Try HITL resume first, then normal flow."""
        resume_result = self._handle_hitl_resume(task, stream=kwargs.get('stream', False))
        if resume_result is not None:
            return resume_result
        return super().run(task, **kwargs)

    def execute_tool_call(self, tool_name: str, arguments: dict[str, str] | str) -> Any:
        """Execute tool, re-raising interrupts as AgentError for HITL propagation."""
        try:
            return super().execute_tool_call(tool_name, arguments)
        except AgentToolExecutionError as e:
            if "interrupted" in str(e).lower():
                logger.info(f"⏸️ Detected interrupt from managed agent '{tool_name}', propagating")
                self._handle_interrupt(tool_name)
                raise AgentError("Agent interrupted.", self.logger) from e
            raise


class InterruptAwareCodeAgent(HITLMixin, CodeAgent):
    """CodeAgent that propagates interrupts and handles HITL resume via mixin."""

    def __init__(self, *args, **kwargs):
        HITLMixin.__init__(self)
        super().__init__(*args, **kwargs)

    def run(self, task: str, **kwargs) -> RunResult | str:
        """Try HITL resume first, then normal flow."""
        resume_result = self._handle_hitl_resume(task, stream=kwargs.get('stream', False))
        if resume_result is not None:
            return resume_result
        return super().run(task, **kwargs)

    def python_executor(self, code: str, **kwargs) -> Any:
        """Execute code, re-raising interrupts as AgentError for HITL propagation."""
        try:
            return super().python_executor(code, **kwargs)
        except Exception as e:
            if "interrupted" in str(e).lower():
                for agent_name in self.managed_agents:
                    if agent_name in code or agent_name in str(e):
                        logger.info(f"⏸️ Detected interrupt from managed agent '{agent_name}', propagating")
                        self._handle_interrupt(agent_name)
                        break
                else:
                    self.interrupt_switch = True
                raise AgentError("Agent interrupted.", self.logger) from e
            raise
