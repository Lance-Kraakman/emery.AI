"""
Agents Module - DSPy-based agents.

This module provides DSPy modules for agent execution.
All agents now use DSPy's ChainOfThought, ReAct, and other strategies.

AIDEV-NOTE: Migration complete. All agents are now DSPy modules.
- ExecutorModule replaces ToolCallingAgent
- PlannerModule replaces planning agents
- EvaluatorModule replaces evaluator agents
- InterruptibleModule wraps any module for HITL support
"""

from .research_emery_agent import create_research_emery_agent
from .agent_executor_agent import (
    create_agent_executor,
    create_agent_executor_from_api,
)
from .interrupt_aware_agent import (
    InterruptibleModule,
    InterruptRequested,
    create_interruptible_executor,
    wrap_interruptible,
)
from ._hitl_mixin import HITLState, handle_hitl_resume, is_approval_response

__all__ = [
    # Research
    "create_research_emery_agent",
    # Agent execution
    "create_agent_executor",
    "create_agent_executor_from_api",
    # Interrupt-aware (DSPy wrappers)
    "InterruptibleModule",
    "InterruptRequested",
    "create_interruptible_executor",
    "wrap_interruptible",
    # HITL utilities
    "HITLState",
    "handle_hitl_resume",
    "is_approval_response",
]
