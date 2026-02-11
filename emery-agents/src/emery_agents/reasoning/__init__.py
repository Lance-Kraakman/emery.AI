"""
DSPy modules for the Emery agent system.

This package replaces Jinja2 templates with DSPy Signatures and Modules,
providing typed I/O contracts and automatic prompt optimization.
"""

from emery_agents.reasoning.config import DSPyModelProvider, configure_dspy

__all__ = ["configure_dspy", "DSPyModelProvider"]
