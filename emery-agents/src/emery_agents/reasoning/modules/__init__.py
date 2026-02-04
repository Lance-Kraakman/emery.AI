"""
DSPy Modules for the Emery agent system.

Modules wrap Signatures with inference strategies (ChainOfThought, ReAct, etc.)
"""

from emery_agents.reasoning.modules.planner import PlannerModule
from emery_agents.reasoning.modules.executor import (
    ExecutorModule,
    SimpleExecutorModule,
    DelegatingExecutorModule,
)
from emery_agents.reasoning.modules.evaluator import EvaluatorModule
from emery_agents.reasoning.modules.step_tracker import (
    StepType,
    TokenUsage,
    ToolCall,
    TrackedStep,
    StepTracker,
)
from emery_agents.reasoning.modules.interruptible import (
    InterruptibleModule,
    InterruptRequested,
    wrap_interruptible,
)
from emery_agents.reasoning.modules.extractor import OutputExtractorModule
from emery_agents.reasoning.modules.input_extractor import InputExtractorModule
from emery_agents.reasoning.modules.classifier import TaskClassifierModule

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
    "InputExtractorModule",
    "TaskClassifierModule",
]
