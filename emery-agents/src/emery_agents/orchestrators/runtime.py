"""
RuntimeContext — Non-Serializable Runtime Objects

Container for runtime objects that cannot be checkpointed by LangGraph.
Bound to graph nodes via closures in create_session_graph().

LangGraph checkpoints state using msgpack/JSON serialization (JsonPlusSerializer).
Non-serializable objects (tools, capability registries, DSPy modules, protobuf objects)
must NOT be in checkpointed state. Instead, they live here and are bound to graph nodes
via Python closures when the session graph is created.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional

from PIL import Image as PILImage

from emery_agents.services.context import ConversationMessage, format_conversation_history

# Re-export so existing `from ..runtime import ConversationMessage` still works
__all__ = ["ConversationMessage", "format_conversation_history", "RuntimeContext"]


@dataclass
class RuntimeContext:
    """Typed container for non-serializable runtime objects.

    Bound to graph nodes via closures in create_session_graph().
    NOT checkpointed — lives in memory for the session duration.

    Fields:
        tools: Callable tool instances (with inference clients, closures)
        managed_agents: Agent descriptors for delegation
        api_key: Auth key for API calls
        org_id: Organization ID string
        org_model: Optional model override
        capability_registry: Stateful service with HF embeddings (NOT serializable)
        conversation_history: Chat history for context
        user_id: User ID for memory scoping
        workspace_type: "agents" or "users" — determines PII filtering
        workspace_id: Agent ID or user ID for workspace path resolution
        memory_service: MemoryService instance for persistent memory (NOT serializable)
        plan_file_repository: PlanFileRepository for filesystem-based plan persistence
    """
    tools: List[Any] = field(default_factory=list)
    managed_agents: List[Any] = field(default_factory=list)
    api_key: str = ""
    org_id: str = ""
    org_model: Optional[str] = None
    capability_registry: Optional[Any] = None
    conversation_history: Optional[List[ConversationMessage]] = None
    user_id: Optional[str] = None
    workspace_type: Optional[str] = None
    workspace_id: Optional[str] = None
    memory_service: Optional[Any] = None
    plan_file_repository: Optional[Any] = None
    images: List[PILImage.Image] = field(default_factory=list)
