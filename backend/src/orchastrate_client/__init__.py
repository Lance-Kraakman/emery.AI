"""
Orchastrate Python Client Library

This package provides a Python client for integrating with Orchastrate agents
and their OAuth credential delegation system.
"""

from .client import OrchastratePythonClient
from .types import (
    AgentCapabilities,
    ConnectedService,
    AvailableAction,
    ExecutionResult,
    ProxyResult,
)

__version__ = "0.1.0"
__all__ = [
    "OrchastratePythonClient",
    "AgentCapabilities", 
    "ConnectedService",
    "AvailableAction",
    "ExecutionResult",
    "ProxyResult",
]