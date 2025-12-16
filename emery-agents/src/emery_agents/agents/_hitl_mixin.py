"""HITL state management mixin for interrupt-aware agents."""

import logging
from typing import Optional, Set, Generator

from smolagents.utils import AgentError
from smolagents.memory import FinalAnswerStep
from smolagents.agents import RunResult

logger = logging.getLogger(__name__)

APPROVAL_WORDS: Set[str] = {
    "yes", "proceed", "apply", "approve", "ok", "okay", "go ahead",
    "do it", "confirm", "continue", "execute", "approved", "y",
    "yes proceed", "yes please", "go", "sure", "yep", "yeah"
}


class HITLMixin:
    """Tracks interrupted agent state and handles approval-based resume."""

    _interrupted_agent_name: Optional[str] = None

    def __init__(self, *args, **kwargs) -> None:
        """Initialize HITL state. Passes args/kwargs through for cooperative MI."""
        super().__init__(*args, **kwargs)
        self._interrupted_agent_name = None

    def _is_approval_response(self, task: str) -> bool:
        """Check if task matches approval words like 'yes', 'proceed', etc."""
        task_lower = task.lower().strip()
        if task_lower in APPROVAL_WORDS:
            return True
        for word in APPROVAL_WORDS:
            if task_lower.startswith(word) and (
                len(task_lower) == len(word) or
                task_lower[len(word)] in " .,!?;:"
            ):
                return True

        return False

    def _yield_final_answer(self, result: str) -> Generator[FinalAnswerStep, None, None]:
        """Wrap result as FinalAnswerStep for streaming mode."""
        yield FinalAnswerStep(output=result)

    def _handle_hitl_resume(self, task: str, stream: bool = False) -> Optional[RunResult]:
        """Route approval to interrupted agent. Returns None if no pending interrupt."""
        if not self._interrupted_agent_name or not self._is_approval_response(task):
            return None

        agent_name = self._interrupted_agent_name
        logger.info(f"📋 HITL Resume: Routing '{task[:50]}...' directly to {agent_name}")

        self._interrupted_agent_name = None
        self.interrupt_switch = False

        if agent_name in self.managed_agents:
            managed_agent = self.managed_agents[agent_name]
            try:
                result = managed_agent(task)
                logger.info(f"✅ HITL Resume: {agent_name} completed successfully")

                if stream:
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

        return None

    def _handle_interrupt(self, agent_name: str) -> None:
        """Store interrupted agent and set interrupt switch."""
        if agent_name in self.managed_agents:
            self._interrupted_agent_name = agent_name
            logger.info(f"📋 Stored interrupted agent: {agent_name}")
        self.interrupt_switch = True
