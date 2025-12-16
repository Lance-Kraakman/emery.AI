"""
Shared utilities for emery-agents.

Modules:
- _async_utils: Run async code from sync contexts
- error_classifier: Classify and handle agent errors
- error_messages: Error message templates
"""

from ._async_utils import run_async_in_thread

__all__ = [
    "run_async_in_thread",
]
