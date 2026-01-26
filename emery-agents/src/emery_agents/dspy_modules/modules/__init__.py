"""
DSPy Modules for the Emery agent system.

Modules wrap Signatures with inference strategies (ChainOfThought, ReAct, etc.)
"""

from emery_agents.dspy_modules.modules.planner import PlannerModule
from emery_agents.dspy_modules.modules.executor import (
    ExecutorModule,
    SimpleExecutorModule,
    DelegatingExecutorModule,
)
from emery_agents.dspy_modules.modules.evaluator import EvaluatorModule
from emery_agents.dspy_modules.modules.step_tracker import (
    StepType,
    TokenUsage,
    ToolCall,
    TrackedStep,
    StepTracker,
)
from emery_agents.dspy_modules.modules.interruptible import (
    InterruptibleModule,
    InterruptRequested,
    wrap_interruptible,
)
from emery_agents.dspy_modules.modules.extractor import OutputExtractorModule

__all__ = [
    "PlannerModule",
    "ExecutorModule",
    "SimpleExecutorModule",
    "DelegatingExecutorModule",
    "EvaluatorModule",
    "StepType",
    "TokenUsage",
    "ToolCall",
    "TrackedStep",
    "StepTracker",
    "InterruptibleModule",
    "InterruptRequested",
    "wrap_interruptible",
    "OutputExtractorModule",
]
