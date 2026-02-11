"""
Context Module

Context and configuration management for agent execution.

- SessionConfig: Auth/identity configuration (immutable per session)
- WorkspaceContext: Workspace data (databases, tables, apps, agents, skills, views)
- ContextResolver: Resolves context mappings for execution
- ContextSyncService: Bidirectional sync between local workspace and dynamic tables
"""

from .manager import (
    clear_human_skill_awaiting,
    execution_scope,
    get_current_context,
    get_human_skill_awaiting,
    set_current_context,
    signal_human_skill_awaiting,
)
from .models import (
    ConversationMessage,
    SessionConfig,
    WorkspaceContext,
    format_conversation_history,
)
from .resolver import ContextResolver
from .sync import ContextSyncService, ContextSyncServiceFactory

__all__ = [
    "ConversationMessage",
    "SessionConfig",
    "WorkspaceContext",
    "format_conversation_history",
    "ContextResolver",
    "ContextSyncService",
    "ContextSyncServiceFactory",
    "set_current_context",
    "get_current_context",
    "execution_scope",
    "signal_human_skill_awaiting",
    "get_human_skill_awaiting",
    "clear_human_skill_awaiting",
]
