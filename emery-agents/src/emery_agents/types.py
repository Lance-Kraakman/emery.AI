"""
Consolidated Types and Enums

Simplified from DDD value objects - using direct types (int, str) instead of wrapper classes.
Includes all enums and type aliases for the emery_agents package.
"""

from enum import Enum
from typing import TypedDict, Optional, List, Dict, Any


# ============================================================================
# Enums (from core/types.py)
# ============================================================================

class StepType(Enum):
    """Step execution types matching protobuf StepType."""
    CODE_STEP = 0
    TOOL_STEP = 1


class TaskStatus(Enum):
    """Task execution status matching protobuf TaskStatus."""
    TASK_PENDING = 0
    TASK_IN_PROGRESS = 1
    TASK_COMPLETED = 2
    TASK_FAILED = 3
    TASK_CANCELLED = 4
    TASK_TIMEOUT = 5


class WorkerStatus(Enum):
    """Worker health status matching protobuf WorkerStatus."""
    WORKER_HEALTHY = 0
    WORKER_BUSY = 1
    WORKER_DEGRADED = 2
    WORKER_UNHEALTHY = 3
    WORKER_SHUTTING_DOWN = 4


# ============================================================================
# Type Aliases (simplified from DDD value objects)
# ============================================================================

# Instead of AgentId(int), just use int
AgentId = int
OrganizationId = str  # Changed from int to str to match TaskRequest
TaskId = str
UserId = str
OwnerId = str
DatabaseId = int
RoleId = int
SkillId = int
CapabilityId = int


# ============================================================================
# Execution Mode Type
# ============================================================================

class ExecutionMode(Enum):
    """Execution mode for agent tasks."""
    SKILL = "skill"
    INSTRUCTION = "instruction"
    CAPABILITY = "capability"  # Legacy


# ============================================================================
# Model Types (from infrastructure/ai)
# ============================================================================

class ModelType(Enum):
    """AI model types for different use cases."""
    CHAT = "chat"                    # General conversation
    CODE = "code"                    # Code generation
    TOOL_CALLING = "tool_calling"    # Tool execution
    FAST = "fast"                    # Quick responses


# ============================================================================
# TypedDict Definitions
# ============================================================================

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


# ============================================================================
# Constants
# ============================================================================

DEFAULT_TIMEOUT_SECONDS = 300
MAX_TASK_RETRIES = 3
DEFAULT_MAX_STEPS = 10
