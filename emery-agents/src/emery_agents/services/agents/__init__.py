"""
Agents Module

Agent-related services.

- AgentExecutor: Import directly from services.agents.executor (heavy, causes circular if eager)
- AgentFactory: Factory for creating agents with configuration
- AgentAPIService: Fetches agents/skills from Next.js API
"""

from emery_agents.api import AgentAPIService

from .factory import AgentConfig, AgentFactory

__all__ = [
    "AgentConfig",
    "AgentFactory",
    "AgentAPIService",
]
