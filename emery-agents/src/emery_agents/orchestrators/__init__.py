"""
Orchestrators Module

LangGraph-based orchestration patterns for agent execution.

Patterns:
- plan_execute: Two-phase planning -> approval -> execution (replaces ExecutionCoordinator)
- plan_only: Plan generation without execution (for skill editor)

Architecture:
- RuntimeContext: Non-serializable runtime objects (tools, registries, services)
- Session-scoped graphs: Each session gets a graph with RuntimeContext bound via closures
- State: Only serializable data (primitives, dicts, dataclasses) in checkpointed state
"""

from .graphs.plan_execute import create_session_graph, create_session_plan_only_graph
from .runtime import RuntimeContext

__all__ = [
    "create_session_graph",
    "create_session_plan_only_graph",
    "RuntimeContext",
]
