"""
Response Type Definitions

Shared TypedDict structures for gRPC response events.
Consolidated from chat_processing_service.py, step_converter.py,
and coordinator_event_converter.py to avoid duplication.
"""

from typing import List, Literal, TypedDict, Union


# Step types
StepType = Literal["PLANNING", "ACTION", "REASONING", "FINAL", "CODE_EXECUTION"]


class StepMetadata(TypedDict, total=False):
    """Metadata for execution steps."""
    tool: str
    arguments: str
    observations: str
    error: str
    skill_name: str
    skill_status: str
    skill_message: str
    step_id: str
    result: str
    type: str
    replan_number: str
    success: str
    confidence: str
    # Cascade planning and unified message handling metadata
    plan_id: str
    agent_name: str
    total_sub_plans: str
    feedback: str


class StepProgressDict(TypedDict):
    """Step progress event structure."""
    type: Literal["step_progress"]
    step_type: StepType
    step_name: str
    content: str
    metadata: StepMetadata
    step_index: int


class ContentChunkDict(TypedDict):
    """Content chunk event structure."""
    type: Literal["content_chunk"]
    content: str


class ErrorDetailsDict(TypedDict, total=False):
    """Error details metadata."""
    severity: str


class ErrorDataDict(TypedDict):
    """Error data structure."""
    error_code: str
    error_message: str
    error_details: ErrorDetailsDict
    hint: str
    can_retry: bool
    auto_retry: bool
    session_reset: bool


class ErrorResponseDict(TypedDict):
    """Error response event structure."""
    type: Literal["error"]
    error: ErrorDataDict


class InputOptionDict(TypedDict, total=False):
    """Option for awaiting input questions."""
    id: str
    label: str
    description: str


class AwaitingInputDataDict(TypedDict, total=False):
    """Awaiting input data structure."""
    input_type: str
    title: str
    content: str
    options: List[InputOptionDict]
    plan_json: str


class AwaitingInputResponseDict(TypedDict):
    """Awaiting input response structure."""
    type: Literal["awaiting_input"]
    data: AwaitingInputDataDict


class InterruptedResponseDict(TypedDict):
    """Interrupted response structure."""
    type: Literal["interrupted"]
    message: str


# Union of all response types
StreamResponseDict = Union[
    StepProgressDict,
    ContentChunkDict,
    ErrorResponseDict,
    InterruptedResponseDict,
    AwaitingInputResponseDict,
]


# ============================================================================
# Factory Functions
# ============================================================================

def create_error_response(
    error_code: str,
    error_message: str,
    severity: str = "recoverable",
    hint: str = "",
    can_retry: bool = True,
    auto_retry: bool = False,
    session_reset: bool = False
) -> ErrorResponseDict:
    """
    Create a standardized error response dict.

    Args:
        error_code: Machine-readable error code
        error_message: Human-readable error description
        severity: Error severity level (recoverable, warning, fatal)
        hint: Optional hint for resolution
        can_retry: Whether the operation can be retried
        auto_retry: Whether to auto-retry the operation
        session_reset: Whether session state should be reset

    Returns:
        ErrorResponseDict ready to yield from streaming handlers
    """
    return {
        "type": "error",
        "error": {
            "error_code": error_code,
            "error_message": error_message,
            "error_details": {"severity": severity},
            "hint": hint,
            "can_retry": can_retry,
            "auto_retry": auto_retry,
            "session_reset": session_reset
        }
    }
