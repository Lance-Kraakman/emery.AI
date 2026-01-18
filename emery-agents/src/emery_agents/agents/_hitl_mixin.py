"""HITL state management mixin for interrupt-aware agents."""

import logging
from typing import Optional, Generator, Any, Dict, TYPE_CHECKING, Protocol

from smolagents.utils import AgentError
from smolagents.memory import FinalAnswerStep
from smolagents.agents import RunResult

from ..services.context_manager import get_current_context
from ..tools.tool_modes import ToolMode

logger = logging.getLogger(__name__)


if TYPE_CHECKING:
    class _HITLMixinBase(Protocol):
        """Protocol for attributes expected from the class this mixin is mixed into."""
        managed_agents: Dict[str, Any]
        logger: Any
        interrupt_switch: bool
else:
    _HITLMixinBase = object


class HITLMixin(_HITLMixinBase):
    """Tracks interrupted agent state and handles approval-based resume."""

    _interrupted_agent_name: Optional[str] = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize HITL state. Passes args/kwargs through for cooperative MI."""
        super().__init__(*args, **kwargs)
        self._interrupted_agent_name = None

    def _is_approval_response(self, task: str) -> bool:
        """
        Only accept structured 'approve' from UI button.

        AIDEV-NOTE: No natural language parsing - user must click "Approve" button.
        Any other text is feedback that routes to orchestrator for re-routing.
        """
        return task.lower().strip() == "approve"

    def _yield_final_answer(self, result: str) -> Generator[FinalAnswerStep, None, None]:
        """Wrap result as FinalAnswerStep for streaming mode."""
        yield FinalAnswerStep(output=result)

    def _handle_hitl_resume(self, task: str, stream: bool = False) -> Optional[RunResult]:
        """Route approval to interrupted agent. Returns None if no pending interrupt."""
        if not self._interrupted_agent_name:
            return None

        # Check if this is feedback (not approval) - clear state and let orchestrator handle
        if not self._is_approval_response(task):
            logger.info(f"📝 Feedback received (not approval), clearing interrupt state for orchestrator routing")
            self._interrupted_agent_name = None
            self.interrupt_switch = False
            return None  # Orchestrator will process feedback and can route to different agent

        agent_name = self._interrupted_agent_name
        logger.info(f"📋 HITL Resume: Routing '{task[:50]}...' directly to {agent_name}")

        # Switch to EXECUTION mode after approval - mutations now allowed
        ctx = get_current_context()
        if ctx:
            ctx.tool_mode = ToolMode.EXECUTION
            logger.info(f"✅ HITL: Switched to EXECUTION mode - mutations now allowed")

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
