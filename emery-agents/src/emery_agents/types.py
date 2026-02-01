"""Shared types, enums, and type aliases for the emery_agents package."""

from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional,
    Protocol,
    TypedDict,
    TypeGuard,
    runtime_checkable,
)


class StepType(Enum):
    """Step execution types."""
    CODE_STEP = 0
    TOOL_STEP = 1


class TaskStatus(Enum):
    """Task execution status."""
    TASK_PENDING = 0
    TASK_IN_PROGRESS = 1
    TASK_COMPLETED = 2
    TASK_FAILED = 3
    TASK_CANCELLED = 4
    TASK_TIMEOUT = 5


class WorkerStatus(Enum):
    """Worker health status."""
    WORKER_HEALTHY = 0
    WORKER_BUSY = 1
    WORKER_DEGRADED = 2
    WORKER_UNHEALTHY = 3
    WORKER_SHUTTING_DOWN = 4


AgentId = int
OrganizationId = int
TaskId = str
UserId = str
OwnerId = str
DatabaseId = int
RoleId = int
SkillId = int
CapabilityId = int


class ExecutionMode(Enum):
    """
    Execution mode for agent tasks.

    INTERACTIVE: Chat mode with human-in-the-loop - can pause for approval gates
    AUTONOMOUS: Skill execution - runs without HITL, used for automations/triggers
    """
    INTERACTIVE = "interactive"
    AUTONOMOUS = "autonomous"


class ModelType(Enum):
    """AI model types."""
    CHAT = "chat"
    CODE = "code"
    TOOL_CALLING = "tool_calling"
    FAST = "fast"


class ExecutionResult(TypedDict, total=False):
    """Result from agent execution."""
    status: str
    output: Any
    error: Optional[str]
    logs: List[str]


class ProgressUpdate(TypedDict):
    """Progress update during execution."""
    task_id: str
    status: str
    progress_percent: float
    message: str
    timestamp_ms: int


class ModelConfig(TypedDict, total=False):
    """Configuration for AI model."""
    model_id: str
    max_tokens: int
    temperature: float
    top_p: float


DEFAULT_TIMEOUT_SECONDS = 300
MAX_TASK_RETRIES = 3
DEFAULT_MAX_STEPS = 10


@dataclass
class SkillExecutionResult:
    """Result from skill execution."""
    result: str
    captured_outputs: Optional[Dict[str, Any]] = None


@dataclass
class SkillCallResult:
    """Cached result from a skill execution for memoization.

    Used to prevent duplicate skill calls with identical inputs within
    a single request. The parent agent (chat planner) sometimes calls
    the same skill twice by mistake - memoization returns the cached
    result instead of re-executing.
    """
    call_key: str  # hash of skill_name + inputs
    result: str    # the skill's return value


@dataclass
class ToolInput:
    """Tool input definition."""
    name: str
    type: Literal["text", "image", "audio", "file", "document", "video", "pdf", "number", "boolean"]
    description: str
    required: bool = True


@dataclass
class ToolOutput:
    """Tool output definition."""
    name: str
    type: Literal["text", "image", "audio", "file", "number", "boolean", "json"]
    description: Optional[str] = None


@dataclass
class FileInfo:
    """File metadata for attachments."""
    filename: str
    mime_type: str
    url: Optional[str] = None


@dataclass
class InstructionConfig:
    """Configuration for instruction-based task execution."""
    task: str
    tools: List[Any] = field(default_factory=list)  # List of ToolConfig protos or dicts
    servers: List[Any] = field(default_factory=list)  # List of ServerConfig protos or dicts
    images: List[Any] = field(default_factory=list)  # List of ImageAttachment protos
    attachments: List[Any] = field(default_factory=list)  # List of FileAttachment protos
    model: Optional[str] = None


@runtime_checkable
class AttachmentLike(Protocol):
    """Protocol for attachment-like objects."""
    filename: str
    mime_type: str


@runtime_checkable
class OutputToolProtocol(Protocol):
    """Protocol for OutputTool interface."""
    def was_called(self) -> bool: ...
    def get_captured_values(self) -> Optional[Dict[str, Any]]: ...


@runtime_checkable
class ToolProtocol(Protocol):
    """Minimal tool interface - works for both smolagents and DSPy tools.

    This protocol allows code to work with any tool implementation that has:
    - name: Tool identifier for logging and lookup
    - description: Shown to LLM for tool selection
    - __call__: Callable execution

    Both smolagents.Tool and DSPyToolWrapper implement this interface.
    """
    name: str
    description: str

    def __call__(self, **kwargs: Any) -> str: ...


def is_string_list(value: Any) -> TypeGuard[List[str]]:
    """Type guard for List[str]."""
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def is_nested_list(value: Any) -> TypeGuard[List[List[float]]]:
    """Type guard for nested float lists (embeddings)."""
    return (
        isinstance(value, list) and
        len(value) > 0 and
        isinstance(value[0], list) and
        len(value[0]) > 0 and
        isinstance(value[0][0], (int, float))
    )


def is_dict_list(value: Any) -> TypeGuard[List[Dict[str, Any]]]:
    """Type guard for List[Dict[str, Any]]."""
    return isinstance(value, list) and all(isinstance(item, dict) for item in value)


class APIResponse(TypedDict, total=False):
    """Standard API response structure."""
    success: bool
    data: Dict[str, Any]
    error: Optional[str]
    status_code: int


class RowData(TypedDict, total=False):
    """Row data for table operations."""
    tableId: int
    rowId: Optional[str]
    data: Dict[str, Any]
    dataKeyType: Literal["id", "name"]
