"""
Ask Question Tool - Allows sub-agents to ask structured clarifying questions.

Instead of hoping agents ask questions in plan text and parsing with regex,
agents explicitly call this tool to record structured questions for the user.

AIDEV-NOTE: This enables intentional question-asking during planning.
Sub-agents call ask_clarifying_question with question, options, and context.
Questions are collected and batched for presentation to user.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)


class AskQuestionTool(Tool):  # type: ignore[misc]
    """
    Tool for sub-agents to ask structured clarifying questions.

    The agent calls this tool during planning when it needs:
    - Business requirements clarification
    - Technical decisions (which approach?)
    - Scope clarification (include X?)

    Questions are collected and presented to user in a batched UI.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "ask_clarifying_question"
    description = """Ask the user a clarifying question during planning.

Call this BEFORE finalizing your plan when you need information to proceed.

When to use:
- Business requirements: "What health metrics should we track?"
- Technical decisions: "Should we use soft deletes or hard deletes?"
- Scope clarification: "How many years of history to keep?"
- Missing information: "What fields should the Client table have?"

Provide options when possible - makes it easier for the user to answer quickly.
Explain context so user understands why you need this information.

Example:
{
    "question": "Should health history include mental health tracking?",
    "options": ["Yes, include mental health fields", "No, physical health only"],
    "context": "This affects the HealthHistory table schema design"
}
"""

    inputs = {
        "question": {
            "type": "string",
            "description": "The question to ask the user. Be specific and clear.",
        },
        "options": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Optional list of answer options for multiple choice. Omit for free-text answer.",
            "nullable": True,
        },
        "context": {
            "type": "string",
            "description": "Why you need this information. Helps user understand the impact of their answer.",
            "nullable": True,
        },
        "required": {
            "type": "boolean",
            "description": "Whether this question must be answered before proceeding. Defaults to true.",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.collected_questions: List[Dict[str, Any]] = []

    def forward(
        self,
        question: str,
        options: Optional[List[str]] = None,
        context: Optional[str] = None,
        required: Optional[bool] = None,
    ) -> str:
        """
        Record a clarifying question.

        Args:
            question: The question text to ask the user
            options: Optional list of answer options for multiple choice
            context: Why this information is needed
            required: Whether answer is required (defaults to True)

        Returns:
            Confirmation message
        """
        is_required = required if required is not None else True

        question_data = {
            "question": question,
            "options": options,
            "context": context,
            "required": is_required,
        }

        self.collected_questions.append(question_data)

        option_count = len(options) if options else 0
        option_info = f" ({option_count} options)" if options else " (free text)"

        logger.info(f"❓ Question recorded{option_info}: {question[:60]}...")
        if context:
            logger.debug(f"   Context: {context[:80]}...")

        return f"Question recorded: {question}"

    def get_questions(self) -> List[Dict[str, Any]]:
        """
        Retrieve all collected questions.

        Returns:
            List of question dicts with 'question', 'options', 'context', 'required' keys
        """
        return self.collected_questions

    def has_questions(self) -> bool:
        """Check if any questions have been collected."""
        return len(self.collected_questions) > 0

    def reset(self) -> None:
        """Reset collected state for reuse."""
        self.collected_questions = []
