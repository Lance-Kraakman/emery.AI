"""
Infrastructure layer - concrete implementations and external integrations.

AIDEV-NOTE: Infrastructure layer implements domain interfaces.
Contains repository implementations, external service integrations, and framework adapters.
"""

from .workspace import ContextCache, TableMetadata, WorkspaceConfig

__all__ = [
    "WorkspaceConfig",
    "ContextCache",
    "TableMetadata",
]
