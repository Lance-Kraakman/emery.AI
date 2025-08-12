"""
Emery Python Client Library

This package provides a Python client for integrating with Emery agents
and their OAuth credential delegation system.
"""

from .client import EmeryPythonClient
from .data_types import (
    AgentCapabilities,
    ConnectedService,
    AvailableAction,
    ExecutionResult,
    ProxyResult,
)

__version__ = "0.1.0"
__all__ = [
    "EmeryPythonClient",
    "AgentCapabilities", 
    "ConnectedService",
    "AvailableAction",
    "ExecutionResult",
    "ProxyResult",
]