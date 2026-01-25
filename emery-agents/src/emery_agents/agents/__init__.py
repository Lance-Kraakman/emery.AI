"""
Agents Module

Contains core agent utilities that are still used by the system.
Most builder agents have been replaced by DSPy modules in dspy_modules/modules/agents/.

AIDEV-NOTE: This module is being deprecated. New code should use:
- dspy_modules/modules/agents/ for builder agents
- grpc/agents/agent_models.py for ChatAgent/AgentDescriptor
"""

from .evaluator_agent import (
    EvaluationTool,
    create_evaluator_agent,
    create_evaluator_factory,
)
from .interrupt_classifier import (
    InterruptClassification,
    InterruptClassificationTool,
    create_interrupt_classifier,
    create_interrupt_classifier_factory,
    build_classification_prompt,
)
from .research_emery_agent import create_research_emery_agent
from .agent_executor_agent import create_agent_executor
from .interrupt_aware_agent import InterruptAwareToolCallingAgent, InterruptAwareCodeAgent
from .planning_agent import PlanningAgent

__all__ = [
    # Evaluator
    "EvaluationTool",
    "create_evaluator_agent",
    "create_evaluator_factory",
    # Interrupt classification
    "InterruptClassification",
    "InterruptClassificationTool",
    "create_interrupt_classifier",
    "create_interrupt_classifier_factory",
    "build_classification_prompt",
    # Research
    "create_research_emery_agent",
    # Agent execution
    "create_agent_executor",
    # Interrupt-aware agents (still used by agent_factory)
    "InterruptAwareToolCallingAgent",
    "InterruptAwareCodeAgent",
    # Planning
    "PlanningAgent",
]
