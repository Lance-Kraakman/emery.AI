"""
Question Mapper

Converts ClarifyingQuestion dataclass objects to structured dicts for serialization.
Used by coordinator_streaming, chat_processing_service, and coordinator_event_converter.
"""

from typing import Any, Dict, List, TYPE_CHECKING

if TYPE_CHECKING:
    from emery_agents.services.execution_coordinator import ClarifyingQuestion


def format_clarifying_questions(questions: "List[ClarifyingQuestion]") -> List[Dict[str, Any]]:
    """
    Format ClarifyingQuestion objects as structured data for serialization.

    Args:
        questions: List of ClarifyingQuestion dataclass objects

    Returns:
        List of dicts with questionId, question, questionType, required, allowOther,
        and optional options/context
    """
    questions_data: List[Dict[str, Any]] = []
    for i, q in enumerate(questions):
        q_dict: Dict[str, Any] = {
            "questionId": f"q_{i}",
            "question": q.question,
            "questionType": q.question_type,  # 'text' | 'single_select' | 'multi_select'
            "required": q.required,
            "allowOther": q.allow_other,  # Show "Or type your own..." option
        }
        if q.options:
            q_dict["options"] = q.options
        if q.context:
            q_dict["context"] = q.context
        questions_data.append(q_dict)
    return questions_data
