"""
Agents Module

Agent-related services.

- AgentFactory: Factory for creating agents with configuration
- AgentAPIService: Fetches agents/skills from Next.js API

NOTE: Agent execution now handled by services.executors.router.ExecutionRouter.
"""

from emery_agents.api import AgentAPIService

from .factory import AgentConfig, AgentFactory

__all__ = [
    "AgentConfig",
    "AgentFactory",
    "AgentAPIService",
]
