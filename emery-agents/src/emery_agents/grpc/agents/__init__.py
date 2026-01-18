"""
Agent Factory Module

Provides centralized creation of managed agents for the chat processing service.
"""

from .managed_agents_factory import ManagedAgentsFactory, ManagedAgentConfig

__all__ = ["ManagedAgentsFactory", "ManagedAgentConfig"]
