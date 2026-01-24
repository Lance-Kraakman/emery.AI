"""
Planning Agent with early exit on clarifying questions.

AIDEV-NOTE: Standard ToolCallingAgent runs for max_steps even after questions
are collected. This subclass checks for questions after each step and sets
interrupt_switch to stop early, saving wasted LLM calls.
"""

import logging
from typing import Any, Generator, Optional, List

from smolagents import ToolCallingAgent

from ..tools.ask_question_tool import AskQuestionTool

logger = logging.getLogger(__name__)


class PlanningAgent(ToolCallingAgent):  # type: ignore[misc]
    """
    ToolCallingAgent that stops early when clarifying questions are collected.

    After each step, checks if the ask_question_tool has questions.
    If so, sets interrupt_switch to stop at next iteration.

    This saves 13-14 LLM calls when the planner needs clarification,
    since standard ToolCallingAgent would run for all max_steps.
    """

    def __init__(
        self,
        *args: Any,
        ask_question_tool: Optional[AskQuestionTool] = None,
        **kwargs: Any,
    ) -> None:
        """
        Initialize planning agent.

        Args:
            ask_question_tool: Reference to the question tool to check for collected questions
            *args, **kwargs: Passed to ToolCallingAgent
        """
        super().__init__(*args, **kwargs)
        self._ask_question_tool = ask_question_tool

    def _run_stream(
        self,
        task: str,
        max_steps: int,
        images: Optional[List[Any]] = None,
    ) -> Generator[Any, None, None]:
        """
        Override to check for questions after each step.

        If questions are collected, sets interrupt_switch to stop
        at the start of the next iteration.
        """
        for output in super()._run_stream(task, max_steps, images):
            yield output

            # After each step output, check if questions were collected
            if self._ask_question_tool and self._ask_question_tool.has_questions():
                if not self.interrupt_switch:  # type: ignore[has-type]
                    logger.info("🛑 Questions collected, stopping planner early")
                self.interrupt_switch = True  # Stop at start of next iteration
