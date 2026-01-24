"""
Ask Question Tool - Allows sub-agents to gather clarifying questions from users.

Instead of hoping agents ask questions in plan text and parsing with regex,
agents explicitly call this tool to record structured questions for the user.

AIDEV-NOTE: This enables intentional question-asking during planning.
Sub-agents call ask_clarifying_questions with a list of questions.
Questions are submitted immediately and the agent stops to wait for user response.
"""

import logging
from typing import Any, Dict, List

from smolagents import Tool

logger = logging.getLogger(__name__)


class AgentStopWithQuestionsException(Exception):
    """Raised to stop agent execution after questions are recorded.

    When an agent calls ask_clarifying_questions, this exception is raised
    to immediately stop the agent loop and return the collected questions
    to the user.
    """

    def __init__(self, questions: List[Dict[str, Any]]):
        self.questions = questions
        super().__init__(f"Collected {len(questions)} question(s), awaiting user response")


class AskQuestionTool(Tool):  # type: ignore[misc]
    """
    Tool for sub-agents to gather clarifying questions from users.

    The agent calls this tool during planning when it needs:
    - Business requirements clarification
    - Technical decisions (which approach?)
    - Scope clarification (include X?)

    Calling this tool immediately submits all questions and waits for user response.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "ask_clarifying_questions"
    description = """Gather clarifying questions from the user during planning.

Call this BEFORE finalizing your plan when you need information to proceed.
This submits all questions and waits for user response.

When to use:
- Business requirements: "What health metrics should we track?"
- Technical decisions: "Should we use soft deletes or hard deletes?"
- Scope clarification: "How many years of history to keep?"
- Missing information: "What fields should the Client table have?"

Provide options when possible - makes it easier for the user to answer quickly.
Explain context so user understands why you need this information.

Example (single question):
{
    "questions": [
        {
            "question": "What would you like help with today?",
            "options": ["Create or modify data tables", "Build an automation", "Create an app"],
            "context": "I want to understand what you're trying to accomplish"
        }
    ]
}

Example (multiple questions):
{
    "questions": [
        {"question": "What tables do you need?", "options": ["Customers", "Orders", "Products", "Custom"]},
        {"question": "Should we add audit fields (created_at, updated_at)?", "options": ["Yes", "No"]}
    ]
}
"""

    inputs = {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question to ask the user. Be specific and clear.",
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of answer options for multiple choice. Omit for free-text answer.",
                    },
                    "context": {
                        "type": "string",
                        "description": "Why you need this information. Helps user understand the impact.",
                    },
                    "required": {
                        "type": "boolean",
                        "description": "Whether this question must be answered. Defaults to true.",
                    },
                },
                "required": ["question"],
            },
            "description": "List of questions to ask the user. Each question has: question (required), options, context, required.",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.collected_questions: List[Dict[str, Any]] = []

    def forward(
        self,
        questions: List[Dict[str, Any]],
    ) -> str:
        """
        Gather clarifying questions from the user.

        Args:
            questions: List of question objects with 'question', 'options', 'context', 'required'

        Returns:
            Never returns - always raises exception to stop agent

        Raises:
            AgentStopWithQuestionsException: Stops agent to wait for user response
        """
        if not questions:
            raise ValueError("questions list cannot be empty")

        for q in questions:
            question_text = q.get("question", "")
            if not question_text:
                continue

            question_data = {
                "question": question_text,
                "options": q.get("options"),
                "context": q.get("context"),
                "required": q.get("required", True),
            }

            self.collected_questions.append(question_data)

            option_count = len(q.get("options", []) or [])
            option_info = f" ({option_count} options)" if option_count else " (free text)"
            logger.info(f"❓ Question recorded{option_info}: {question_text[:60]}...")

        logger.info(f"📤 Submitting {len(self.collected_questions)} question(s) to user")
        raise AgentStopWithQuestionsException(self.collected_questions)

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
