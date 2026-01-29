"""
Execution Evolution Tracking

Tracks how execution context evolves across plan steps.
Detects degradation (information loss) and enables recovery.

Part of the ACE (Agentic Context Engineering) pattern:
- Monitors context changes between steps
- Warns when information is being lost
- Maintains snapshots for recovery
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class ExecutionChangeType(Enum):
    """Types of changes in execution context between steps."""
    ADDITION = "addition"        # New information added
    MODIFICATION = "modification"  # Existing info changed
    REMOVAL = "removal"          # Information removed/lost


@dataclass(frozen=True)
class ExecutionDelta:
    """
    A single change in execution context between steps.

    Used to track what information is being added, modified, or lost
    during execution.
    """
    delta_id: str
    change_type: ExecutionChangeType
    key: str                     # What changed (e.g., "step_123_result")
    before_value: Optional[str]  # Value before (None for additions)
    after_value: Optional[str]   # Value after (None for removals)
    step_id: str                 # Step that caused this change
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_information_loss(self) -> bool:
        """
        Check if this change represents information loss.

        Loss is detected when:
        - Information is removed entirely
        - Information is significantly shortened (>50% reduction)
        """
        if self.change_type == ExecutionChangeType.REMOVAL:
            return True

        if self.change_type == ExecutionChangeType.MODIFICATION:
            before_len = len(self.before_value) if self.before_value else 0
            after_len = len(self.after_value) if self.after_value else 0
            # More than 50% reduction in content
            if before_len > 0 and after_len < before_len * 0.5:
                return True

        return False

    @property
    def size_change(self) -> int:
        """Calculate the change in content size (negative = shrinkage)."""
        before_len = len(self.before_value) if self.before_value else 0
        after_len = len(self.after_value) if self.after_value else 0
        return after_len - before_len

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "delta_id": self.delta_id,
            "change_type": self.change_type.value,
            "key": self.key,
            "before_value": self.before_value[:100] if self.before_value else None,
            "after_value": self.after_value[:100] if self.after_value else None,
            "step_id": self.step_id,
            "timestamp": self.timestamp.isoformat(),
            "is_information_loss": self.is_information_loss,
            "size_change": self.size_change,
        }


@dataclass(frozen=True)
class ExecutionSnapshot:
    """
    Full snapshot of execution context at a point in time.

    Used for recovery when context degradation is detected.

    Note: While this dataclass is frozen, context_state is a Dict which
    is mutable. Callers should not modify the dict after creation.
    For true immutability, make a deep copy before modifying.
    """
    snapshot_id: str
    step_id: str                 # Step after which snapshot was taken
    timestamp: datetime
    context_state: Dict[str, Any]  # Full context dump (treat as immutable)
    summary: str                 # Token-efficient summary

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "snapshot_id": self.snapshot_id,
            "step_id": self.step_id,
            "timestamp": self.timestamp.isoformat(),
            "summary": self.summary,
            "context_keys": list(self.context_state.keys()),
        }


@dataclass
class ExecutionEvolutionTracker:
    """
    Tracks how execution context evolves across plan steps.

    Detects degradation (information loss) and enables recovery.

    Maintains:
    - Delta log: All changes between steps
    - Snapshots: Full context dumps for recovery (last 5)
    - Degradation warnings: When information loss is detected
    """
    task_id: str
    deltas: List[ExecutionDelta] = field(default_factory=list)
    snapshots: List[ExecutionSnapshot] = field(default_factory=list)
    degradation_warnings: List[str] = field(default_factory=list)

    # Metrics
    total_additions: int = 0
    total_modifications: int = 0
    total_removals: int = 0

    # Configuration
    max_snapshots: int = 5
    degradation_threshold: float = 0.3  # >30% losses = degradation

    def record_context_change(
        self,
        step_id: str,
        key: str,
        before_value: Optional[Any],
        after_value: Optional[Any],
    ) -> ExecutionDelta:
        """
        Record a context change and detect degradation.

        Args:
            step_id: Step that caused this change
            key: What changed (e.g., "step_123_result")
            before_value: Value before change
            after_value: Value after change

        Returns:
            The recorded ExecutionDelta
        """
        # Determine change type
        if before_value is None and after_value is not None:
            change_type = ExecutionChangeType.ADDITION
            self.total_additions += 1
        elif before_value is not None and after_value is None:
            change_type = ExecutionChangeType.REMOVAL
            self.total_removals += 1
        else:
            change_type = ExecutionChangeType.MODIFICATION
            self.total_modifications += 1

        # Convert values to strings for comparison
        before_str = str(before_value) if before_value is not None else None
        after_str = str(after_value) if after_value is not None else None

        delta = ExecutionDelta(
            delta_id=str(uuid.uuid4())[:8],
            change_type=change_type,
            key=key,
            before_value=before_str,
            after_value=after_str,
            step_id=step_id,
        )

        self.deltas.append(delta)

        # Check for information loss
        if delta.is_information_loss:
            warning = f"Information loss in '{key}' at step {step_id}"
            self.degradation_warnings.append(warning)

        return delta

    def take_snapshot(
        self,
        step_id: str,
        context_state: Dict[str, Any],
        summary: str,
    ) -> ExecutionSnapshot:
        """
        Take a full context snapshot for recovery.

        Args:
            step_id: Step after which snapshot is taken
            context_state: Full context to preserve
            summary: Token-efficient summary

        Returns:
            The created ExecutionSnapshot
        """
        snapshot = ExecutionSnapshot(
            snapshot_id=str(uuid.uuid4())[:8],
            step_id=step_id,
            timestamp=datetime.utcnow(),
            context_state=dict(context_state),  # Copy
            summary=summary,
        )

        self.snapshots.append(snapshot)

        # Keep only last N snapshots
        if len(self.snapshots) > self.max_snapshots:
            self.snapshots = self.snapshots[-self.max_snapshots:]

        return snapshot

    def detect_degradation(self) -> bool:
        """
        Check if context is degrading (too much information loss).

        Returns True if >30% of recent changes are losses.
        """
        if not self.deltas:
            return False

        # Check recent deltas (last 10)
        recent_deltas = self.deltas[-10:]
        loss_count = sum(1 for d in recent_deltas if d.is_information_loss)

        return loss_count > len(recent_deltas) * self.degradation_threshold

    def get_evolution_summary(self) -> str:
        """Get a summary of context evolution for evaluator."""
        lines = [
            "Context Evolution Summary:",
            f"- Additions: {self.total_additions}",
            f"- Modifications: {self.total_modifications}",
            f"- Removals: {self.total_removals}",
        ]

        if self.degradation_warnings:
            lines.append(f"- Warnings: {len(self.degradation_warnings)}")
            for warning in self.degradation_warnings[-3:]:
                lines.append(f"  ! {warning}")

        if self.detect_degradation():
            lines.append("  ** DEGRADATION DETECTED - Consider recovery **")

        return "\n".join(lines)

    def get_recent_deltas(self, limit: int = 10) -> List[ExecutionDelta]:
        """Get most recent deltas."""
        return self.deltas[-limit:] if self.deltas else []

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "task_id": self.task_id,
            "deltas_count": len(self.deltas),
            "snapshots_count": len(self.snapshots),
            "total_additions": self.total_additions,
            "total_modifications": self.total_modifications,
            "total_removals": self.total_removals,
            "degradation_warnings": self.degradation_warnings,
            "is_degrading": self.detect_degradation(),
            "recent_deltas": [d.to_dict() for d in self.get_recent_deltas(5)],
        }
