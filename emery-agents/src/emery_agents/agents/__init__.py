"""
Managed Agents Module

Contains specialized managed agents that can be used as sub-agents
within the main chat agent via smolagents' managed_agents pattern.

AIDEV-NOTE: Agents use native smolagents features:
- planning_interval: Generate plans at regular intervals
- step_callbacks: Interrupt for human-in-the-loop approval
- reset=False: Preserve memory between messages
"""

from .skill_builder_agent import (
    create_skill_builder_agent,
    create_planning_callback,
)
from .document_builder_agent import (
    create_document_builder_agent,
)
from .evaluator_agent import (
    create_evaluator_agent,
    create_evaluator_factory,
)
from .stateful_managed_agent import StatefulManagedAgent
from .interrupt_aware_agent import InterruptAwareToolCallingAgent, InterruptAwareCodeAgent

__all__ = [
    "create_skill_builder_agent",
    "create_planning_callback",
    "create_document_builder_agent",
    "create_evaluator_agent",
    "create_evaluator_factory",
    "StatefulManagedAgent",
    "InterruptAwareToolCallingAgent",
    "InterruptAwareCodeAgent",
]
