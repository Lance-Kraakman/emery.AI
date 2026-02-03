"""
Context Module

Context and configuration management for agent execution.

- SessionConfig: Auth/identity configuration (immutable per session)
- WorkspaceContext: Workspace data (databases, tables, apps, agents, skills, views)
- ContextResolver: Resolves context mappings for execution
- ContextSyncService: Bidirectional sync between local workspace and dynamic tables
"""

from .models import (
    ConversationMessage,
    SessionConfig,
    WorkspaceContext,
    format_conversation_history,
)
from .resolver import ContextResolver
from .sync import ContextSyncService, ContextSyncServiceFactory
from .manager import (
    set_current_context,
    get_current_context,
    execution_scope,
)


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
]
