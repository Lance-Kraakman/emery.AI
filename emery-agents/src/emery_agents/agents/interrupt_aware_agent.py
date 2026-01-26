"""
Interrupt-aware DSPy executors for HITL workflows.

These wrappers add interrupt handling to DSPy execution modules,
enabling Human-In-The-Loop workflows where execution can be paused
for user approval and resumed later.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from ..dspy_modules.modules import (
    ExecutorModule,
    InterruptibleModule,
    InterruptRequested,
    wrap_interruptible,
)

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)


def create_interruptible_executor(
    tools: list[Callable[..., Any]],
    max_iters: int = 10,
    interrupt_check: Callable[[], bool] | None = None,
    on_interrupt: Callable[[str, dict[str, Any]], None] | None = None,
) -> InterruptibleModule:
    """
    Create an ExecutorModule wrapped with interrupt support.

    This enables HITL workflows where:
    1. Execution can be paused via interrupt_check callback
    2. State is preserved for later resume
    3. Interrupts from nested tools are propagated

    Args:
        tools: List of callable tools for the executor
        max_iters: Maximum ReAct iterations
        interrupt_check: Callback that returns True if interrupt requested
        on_interrupt: Optional callback when interrupt is triggered

    Returns:
        InterruptibleModule wrapping an ExecutorModule
    """
    executor = ExecutorModule(execution_tools=tools, max_iters=max_iters)
    return InterruptibleModule(
        inner_module=executor,
        interrupt_check=interrupt_check,
        on_interrupt=on_interrupt,
    )


__all__ = [
    "create_interruptible_executor",
    "InterruptibleModule",
    "InterruptRequested",
    "wrap_interruptible",
]
