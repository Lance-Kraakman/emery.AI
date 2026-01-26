"""
Interruptible Module - DSPy module with HITL interrupt support.

Provides interrupt handling for Human-In-The-Loop workflows where
execution can be paused for user approval and resumed later.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import dspy

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)


class InterruptRequested(Exception):
    """Exception raised when an interrupt is requested during execution."""

    def __init__(self, reason: str, state: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.state = state or {}


class InterruptibleModule(dspy.Module):  # type: ignore[misc]
    """
    Wrapper module that adds interrupt support to any DSPy module.

    This enables HITL workflows where:
    1. Execution can be paused via interrupt_check callback
    2. State is preserved for later resume
    3. Interrupts from nested tools are propagated

    Usage:
        def check_interrupt() -> bool:
            return some_interrupt_flag

        wrapped = InterruptibleModule(
            inner_module=ExecutorModule(tools=tools),
            interrupt_check=check_interrupt,
        )
        try:
            result = wrapped.forward(...)
        except InterruptRequested as e:
            # Handle interrupt, save state for resume
            pass
    """

    def __init__(
        self,
        inner_module: dspy.Module,
        interrupt_check: Callable[[], bool] | None = None,
        on_interrupt: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> None:
        """
        Initialize interruptible wrapper.

        Args:
            inner_module: The DSPy module to wrap
            interrupt_check: Callback that returns True if interrupt requested
            on_interrupt: Optional callback when interrupt is triggered
        """
        super().__init__()
        self.inner = inner_module
        self.interrupt_check = interrupt_check
        self.on_interrupt = on_interrupt
        self.interrupt_switch = False
        self._resume_state: dict[str, Any] | None = None

    def forward(self, **kwargs: Any) -> Any:
        """
        Execute the inner module with interrupt checking.

        Checks for interrupt before and after execution.
        Raises InterruptRequested if interrupt is detected.
        """
        # Check for interrupt before starting
        if self._should_interrupt():
            raise InterruptRequested(
                "Interrupt requested before execution",
                state={"kwargs": kwargs},
            )

        # Check for resume state
        if self._resume_state:
            logger.info("Resuming from previous interrupt state")
            kwargs.update(self._resume_state.get("kwargs", {}))
            self._resume_state = None

        try:
            result = self.inner(**kwargs)
        except Exception as e:
            # Check if this is an interrupt from a nested tool
            if "interrupt" in str(e).lower():
                logger.info(f"Detected interrupt from inner module: {e}")
                self._trigger_interrupt(str(e), {"error": str(e), "kwargs": kwargs})
                raise InterruptRequested(str(e), state={"kwargs": kwargs}) from e
            raise

        # Check for interrupt after execution
        if self._should_interrupt():
            raise InterruptRequested(
                "Interrupt requested after execution",
                state={"result": result, "kwargs": kwargs},
            )

        return result

    def _should_interrupt(self) -> bool:
        """Check if an interrupt has been requested."""
        if self.interrupt_switch:
            return True
        if self.interrupt_check and self.interrupt_check():
            return True
        return False

    def _trigger_interrupt(self, reason: str, state: dict[str, Any]) -> None:
        """Trigger interrupt handling."""
        self.interrupt_switch = True
        if self.on_interrupt:
            self.on_interrupt(reason, state)

    def request_interrupt(self) -> None:
        """Request an interrupt at the next check point."""
        self.interrupt_switch = True
        logger.info("Interrupt requested")

    def clear_interrupt(self) -> None:
        """Clear the interrupt flag."""
        self.interrupt_switch = False

    def set_resume_state(self, state: dict[str, Any]) -> None:
        """Set state to resume from on next forward() call."""
        self._resume_state = state


def wrap_interruptible(
    module: dspy.Module,
    interrupt_check: Callable[[], bool] | None = None,
) -> InterruptibleModule:
    """
    Convenience function to wrap a module with interrupt support.

    Args:
        module: DSPy module to wrap
        interrupt_check: Optional interrupt check callback

    Returns:
        Wrapped InterruptibleModule
    """
    return InterruptibleModule(
        inner_module=module,
        interrupt_check=interrupt_check,
    )
