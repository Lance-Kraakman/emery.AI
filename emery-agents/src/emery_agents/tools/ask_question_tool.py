"""
Ask Question Tool - Allows sub-agents to gather clarifying questions from users.

Instead of hoping agents ask questions in plan text and parsing with regex,
agents explicitly call this tool to record structured questions for the user.

AIDEV-NOTE: This enables intentional question-asking during planning.
Sub-agents call ask_clarifying_questions with a list of questions.
Questions are collected, then checked after agent run completes.
"""

import logging
from typing import Any, Dict, List

from smolagents import Tool

logger = logging.getLogger(__name__)


class AskQuestionTool(Tool):  # type: ignore[misc]
    """
    Tool for sub-agents to gather clarifying questions from users.

    The agent calls this tool during planning when it needs:
    - Business requirements clarification
    - Technical decisions (which approach?)
    - Scope clarification (include X?)

    Questions are collected and checked after the agent run completes.
    The tool returns a stop signal - the agent should stop after calling this.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "ask_clarifying_questions"
    description = """Gather ALL clarifying questions from the user in a single call.

IMPORTANT:
- Include all questions you need in ONE call
- After calling this tool, STOP and do not call any other tools
- Wait for user response before continuing

When to use:
- Unclear intent: "What would you like help with?"
- Missing details: "What tables/fields do you need?"
- Technical decisions: "Should we use soft deletes?"
- Scope clarification: "Any other requirements?"

Format:
- Use "question_type": "single_select" for single choice (default when options provided)
- Use "question_type": "multi_select" for multiple selections
- Use "question_type": "text" for open-ended free text (default when no options)
- Use "context" to explain why you need the information
- Set "allow_other": false to disable custom input (default: true, like Claude)

Example (gather multiple questions at once):
{
    "questions": [
        {"question": "What features do you need?", "question_type": "multi_select", "options": ["Auth", "Database", "API", "UI"]},
        {"question": "Which framework?", "question_type": "single_select", "options": ["React", "Vue", "Angular"]},
        {"question": "Any specific requirements or constraints?", "question_type": "text"}
    ]
}

Example (single open-ended question):
{
    "questions": [
        {"question": "Describe what you're trying to build."}
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
                    "question_type": {
                        "type": "string",
                        "enum": ["text", "single_select", "multi_select"],
                        "description": "Type of question: text (free-form), single_select (one option), multi_select (multiple options). Default: 'text' if no options, 'single_select' if options provided.",
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of answer options for single_select or multi_select. Omit for text questions.",
                    },
                    "context": {
                        "type": "string",
                        "description": "Why you need this information. Helps user understand the impact.",
                    },
                    "required": {
                        "type": "boolean",
                        "description": "Whether this question must be answered. Defaults to true.",
                    },
                    "allow_other": {
                        "type": "boolean",
                        "description": "Show 'Or type your own...' option for custom answers. Default: true (like Claude).",
                    },
                },
                "required": ["question"],
            },
            "description": "List of questions to ask the user. Each question has: question (required), question_type, options, context, required, allow_other.",
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
            Stop signal string instructing agent to wait for user response
        """
        # Already called in this run? Ignore retry, return stop signal
        if self.collected_questions:
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

            self.collected_questions.append(question_data)

            option_count = len(q.get("options", []) or [])
            option_info = f" ({option_count} options)" if option_count else " (free text)"
            logger.info(f"❓ Question recorded{option_info}: {question_text[:60]}...")

        logger.info(f"📤 Collected {len(self.collected_questions)} question(s), waiting for user")

        # Return stop signal - do NOT raise exception (smolagents treats exceptions as errors)
        return (
            f"[QUESTIONS_COLLECTED] {len(self.collected_questions)} question(s) recorded. "
            "STOP now and wait for user response. Do not call any other tools."
        )

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
