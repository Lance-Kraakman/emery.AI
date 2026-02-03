"""
Ask Question Tool - Allows agents to gather clarifying questions from users.

Ported from tools/ask_question_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class ClarificationRequestedException(Exception):
    """
    Raised when a clarifying question is asked to interrupt agent execution.

    This exception should be caught by the caller (plan_step_executor) to
    return the questions to the user instead of continuing execution.
    """

    def __init__(self, questions: list[dict[str, Any]]):
        self.questions = questions
        super().__init__(f"Clarification requested: {len(questions)} question(s)")


class QuestionCollector:
    """
    Stateful container for collecting questions during execution.

    Used by the ask_clarifying_questions tool function.
    """

    def __init__(self) -> None:
        self.collected_questions: list[dict[str, Any]] = []

    def get_questions(self) -> list[dict[str, Any]]:
        """Retrieve all collected questions."""
        return self.collected_questions

    def has_questions(self) -> bool:
        """Check if any questions have been collected."""
        return len(self.collected_questions) > 0

    def reset(self) -> None:
        """Reset collected state for reuse."""
        self.collected_questions = []


def create_ask_question_tool(
    collector: QuestionCollector,
) -> Callable[[list[dict[str, Any]]], str]:
    """
    Factory: Create ask_clarifying_questions function with collector captured in closure.

    Args:
        collector: QuestionCollector instance to store collected questions

    Returns:
        ask_clarifying_questions function that DSPy ReAct can use
    """

    def ask_clarifying_questions(
        questions: list[dict[str, Any]],
    ) -> str:
        """Gather ALL clarifying questions from the user in a single call.

        IMPORTANT:
        - Include all questions you need in ONE call
        - After calling this tool, STOP and do not call any other tools
        - Wait for user response before continuing

        When to use:
        - Unclear intent: "What would you like help with?"
        - Missing details: "What tables/fields do you need?"
        - Technical decisions: "Should we use soft deletes?"
        - Scope clarification: "Any other requirements?"

        Args:
            questions: List of question objects. Each has:
                - question (str, required): The question to ask
                - question_type (str): "text", "single_select", or "multi_select"
                - options (list[str]): Options for select types
                - context (str): Why you need this information
                - required (bool): Whether answer is required (default: True)
                - allow_other (bool): Allow custom input (default: True)

        Returns:
            Stop signal string instructing agent to wait for user response

        Raises:
            ClarificationRequestedException: Always raised to interrupt execution
        """
        # Already called in this run? Ignore retry, return stop signal
        if collector.collected_questions:
            logger.debug("Tool already called in this run, ignoring retry")
            return (
                "[ALREADY_RECORDED] Questions already recorded. "
                "STOP now and wait for user response. Do not call any other tools."
            )

        if not questions:
            raise ValueError("questions list cannot be empty")

        for q in questions:
            question_text = q.get("question", "")
            if not question_text:
                continue

            # Infer question_type from options if not specified
            options = q.get("options")
            question_type = q.get("question_type")
            if question_type is None:
                question_type = "single_select" if options else "text"

            question_data = {
                "question": question_text,
                "question_type": question_type,
                "options": options,
                "context": q.get("context"),
                "required": q.get("required", True),
                "allow_other": q.get("allow_other", True),
            }

            collector.collected_questions.append(question_data)

            option_count = len(q.get("options", []) or [])
            option_info = f" ({option_count} options)" if option_count else " (free text)"
            logger.info(f"❓ Question recorded{option_info}: {question_text[:60]}...")

        logger.info(
            f"📤 Collected {len(collector.collected_questions)} question(s), "
            "interrupting execution"
        )

        # Raise exception to interrupt agent execution immediately
        raise ClarificationRequestedException(collector.collected_questions)

    return ask_clarifying_questions
