"""
Response Type Definitions

Shared TypedDict structures for gRPC response events.
Consolidated from chat_processing_service.py, step_converter.py,
and coordinator_event_converter.py to avoid duplication.
"""

from enum import Enum
from typing import Literal, TypedDict, Union

# Step types
StepType = Literal[
    "PLANNING", "ACTION", "REASONING", "FINAL", "CODE_EXECUTION", "PHASE", "INFO"
]


class MetadataType(str, Enum):
    """Metadata event type identifiers for frontend routing."""

    GOAL_ACHIEVED = "goal_achieved"
    REPLAN = "replan"
    FINAL_SYNTHESIS = "final_synthesis"
    RECOVERY_ANALYSIS = "recovery_analysis"
    AUTO_FIX_STARTED = "auto_fix_started"
    AUTO_FIX_COMPLETED = "auto_fix_completed"
    PLAN_REJECTED = "plan_rejected"
    PLAN_FEEDBACK = "plan_feedback"
    PHASE_STARTED = "phase_started"
    PHASE_COMPLETED = "phase_completed"
    PLANNING_STARTED = "planning_started"
    PLAN_APPROVED = "plan_approved"
    PLAN_UPDATED = "plan_updated"
    PLAN_CANCELLED = "plan_cancelled"
    INTERRUPT_QUEUED = "interrupt_queued"
    INTERRUPT_RECEIVED = "interrupt_received"
    INTERRUPT_PROCESSING = "interrupt_processing"
    CONTEXT_INJECTED = "context_injected"


class InputType(str, Enum):
    """Input type identifiers for awaiting_input events."""

    PLAN_APPROVAL = "plan_approval"
    RECOVERY_APPROVAL = "recovery_approval"
    APPROVAL = "approval"
    QUESTIONS = "questions"


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
    # Unified message handling metadata
    plan_id: str
    agent_id: str
    agent_name: str
    feedback: str
    # Phase execution metadata
    phase_name: str
    step_count: str
    needs_replan: str
    # Interrupt handling metadata
    phase: str
    message_preview: str
    classification: str
    version: str


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


class QuestionDict(TypedDict, total=False):
    """Question structure for clarification."""

    question: str
    options: list[str]
    context: str
    required: bool


class AwaitingInputDataDict(TypedDict, total=False):
    """Awaiting input data structure."""

    input_type: str
    title: str
    content: str
    options: list[InputOptionDict]
    plan_json: str
    plan_id: str
    questions: list[QuestionDict]


class AwaitingInputResponseDict(TypedDict):
    """Awaiting input response structure."""

    type: Literal["awaiting_input"]
    data: AwaitingInputDataDict


class InterruptedResponseDict(TypedDict):
    """Interrupted response structure."""

    type: Literal["interrupted"]
    message: str


class PermissionRequestMetadata(TypedDict, total=False):
    """Metadata for permission request events."""

    requires_user_action: bool
    can_continue_without: bool


class PermissionRequestResponseDict(TypedDict):
    """
    Permission request event structure.

    Emitted when agent encounters a permission error in interactive mode,
    allowing the UI to prompt the user for access approval.
    """

    type: Literal["permission_request"]
    permission: str
    resource: str
    resource_id: int
    action: str
    context: str
    metadata: PermissionRequestMetadata


class PermissionDeniedMetadata(TypedDict, total=False):
    """Metadata for permission denied events."""

    error_type: str
    recoverable: bool


class PermissionDeniedResponseDict(TypedDict):
    """
    Permission denied event structure.

    Emitted when agent encounters a permission error in autonomous mode,
    providing guidance on what permission is needed.
    """

    type: Literal["permission_denied"]
    permission: str
    resource: str
    resource_id: int
    guidance: str
    metadata: PermissionDeniedMetadata


# Union of all response types
StreamResponseDict = Union[
    StepProgressDict,
    ContentChunkDict,
    ErrorResponseDict,
    InterruptedResponseDict,
    AwaitingInputResponseDict,
    PermissionRequestResponseDict,
    PermissionDeniedResponseDict,
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
    session_reset: bool = False,
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
            "session_reset": session_reset,
        },
    }


def create_permission_request_event(
    permission: str,
    resource: str = "",
    resource_id: int = 0,
    action: str = "access",
    context: str = "",
) -> PermissionRequestResponseDict:
    """
    Create event to trigger permission request UI in interactive mode.

    The frontend will display: "Agent needs [permission] access to continue. [Allow] [Deny]"

    Args:
        permission: Required permission string (e.g., "database:view")
        resource: Resource type (e.g., "database")
        resource_id: Specific resource ID if applicable
        action: Action being attempted (e.g., "view")
        context: Description of what the agent was trying to do

    Returns:
        PermissionRequestResponseDict ready to yield from streaming handlers
    """
    return {
        "type": "permission_request",
        "permission": permission,
        "resource": resource,
        "resource_id": resource_id,
        "action": action,
        "context": context or f"Agent needs '{permission}' permission to continue",
        "metadata": {
            "requires_user_action": True,
            "can_continue_without": False,
        },
    }


def create_permission_denied_event(
    permission: str,
    resource: str = "",
    resource_id: int = 0,
    guidance: str = "",
) -> PermissionDeniedResponseDict:
    """
    Create event for permission denied in autonomous mode.

    The agent receives this and can report to user what permission is needed.

    Args:
        permission: Required permission string (e.g., "database:view")
        resource: Resource type (e.g., "database")
        resource_id: Specific resource ID if applicable
        guidance: Guidance text for resolving the permission issue

    Returns:
        PermissionDeniedResponseDict ready to yield from streaming handlers
    """
    default_guidance = (
        f"This operation requires '{permission}' permission. "
        f"Ask an administrator to grant access."
    )
    return {
        "type": "permission_denied",
        "permission": permission,
        "resource": resource,
        "resource_id": resource_id,
        "guidance": guidance or default_guidance,
        "metadata": {
            "error_type": "PERMISSION_DENIED",
            "recoverable": False,
        },
    }
