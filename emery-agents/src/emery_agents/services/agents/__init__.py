"""
Agents Module

Agent-related services.

- AgentExecutor: Main agent task executor (DSPy ReAct-based)
- AgentFactory: Factory for creating agents with configuration
- AgentAPIService: Fetches agents/skills from Next.js API
"""

from .executor import AgentExecutor
from .factory import AgentConfig, AgentFactory
from .api import AgentData, SkillData, AgentAPIService


__all__ = [
    "AgentExecutor",
    "AgentConfig",
    "AgentFactory",
    "AgentData",
    "SkillData",
    "AgentAPIService",
]
