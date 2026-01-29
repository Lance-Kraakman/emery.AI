"""
Agent Models Module

Provides DSPy-compatible agent models for the chat processing service.
Execution happens via DSPy ExecutorModule, not smolagents agent.run().

AIDEV-NOTE: ManagedAgentsFactory has been deleted. Use ChatAgent and AgentDescriptor instead.
"""

from .agent_models import ChatAgent, AgentMemory, MemoryStep, AgentDescriptor, get_builder_descriptors

__all__ = [
    "ChatAgent",
    "AgentMemory",
    "MemoryStep",
    "AgentDescriptor",
    "get_builder_descriptors",
]
