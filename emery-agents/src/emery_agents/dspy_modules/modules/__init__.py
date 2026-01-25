"""
DSPy Modules for the Emery agent system.

Modules wrap Signatures with inference strategies (ChainOfThought, ReAct, etc.)
"""

from emery_agents.dspy_modules.modules.planner import PlannerModule
from emery_agents.dspy_modules.modules.executor import ExecutorModule
from emery_agents.dspy_modules.modules.evaluator import EvaluatorModule

__all__ = [
    "PlannerModule",
    "ExecutorModule",
    "EvaluatorModule",
]
