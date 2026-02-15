"""
PlanningRegistry - searchable registry of planning patterns.

Provides semantic search to find relevant planning strategies based on
task description. Replaces static PLANNING_GUIDANCE strings with dynamic,
searchable patterns.
"""

from __future__ import annotations

import logging

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern
from emery_agents.services.analysis import get_embeddings_batch

logger = logging.getLogger(__name__)


class PlanningRegistry:
    """
    Registry of planning patterns.

    Stores planning strategies for different task types.
    Each pattern includes strategy, examples, and auto-approve policy.

    Note: Semantic search is handled by PatternRetriever in reasoning/modules/retrievers.py.
    This registry provides storage, registration, and lookup by ID/capability.

    Usage:
        registry = PlanningRegistry()

        # Register patterns at startup
        registry.register(PlanningPattern(
            id="plan:schema_design",
            name="Database Schema Design",
            description="Planning patterns for creating tables and fields",
            triggers=["create table", "database schema"],
            capability_ids=["agent:schema_builder"],
            strategy="1. Identify entities...",
            auto_approve_policy=AutoApprovePolicy.CONFIRM,
        ))

        # Get all patterns (for PatternRetriever)
        all_patterns = registry.all()

        # Get patterns for a capability
        patterns = registry.get_for_capability("agent:schema_builder")
    """

    def __init__(self) -> None:
        self._patterns: dict[str, PlanningPattern] = {}
        self._embeddings: dict[str, tuple[float, ...]] = {}

    def register(self, pattern: PlanningPattern) -> None:
        """Register a planning pattern."""
        self._patterns[pattern.id] = pattern
        # Store pre-computed embedding if present
        if pattern.embedding:
            self._embeddings[pattern.id] = pattern.embedding

    def unregister(self, pattern_id: str) -> bool:
        """Remove a pattern from the registry. Returns True if found."""
        if pattern_id in self._patterns:
            del self._patterns[pattern_id]
            self._embeddings.pop(pattern_id, None)
            return True
        return False

    def get(self, pattern_id: str) -> PlanningPattern | None:
        """Get a specific pattern by ID."""
        return self._patterns.get(pattern_id)

    def all(self) -> list[PlanningPattern]:
        """Return all registered patterns."""
        return list(self._patterns.values())

    def count(self) -> int:
        """Return total number of registered patterns."""
        return len(self._patterns)

    def get_for_capability(self, capability_id: str) -> list[PlanningPattern]:
        """
        Get all patterns that apply to a capability.

        Args:
            capability_id: Capability ID (e.g., "agent:schema_builder")

        Returns:
            List of patterns that include this capability
        """
        return [p for p in self._patterns.values() if capability_id in p.capability_ids]

    def get_by_policy(self, policy: AutoApprovePolicy) -> list[PlanningPattern]:
        """
        Get all patterns with a specific auto-approve policy.

        Args:
            policy: AutoApprovePolicy to filter by

        Returns:
            List of patterns with matching policy
        """
        return [p for p in self._patterns.values() if p.auto_approve_policy == policy]

    # --- Embedding management ---

    def load_embeddings(self, embeddings: dict[str, tuple[float, ...]]) -> int:
        """
        Bulk-load pre-computed embeddings into the registry.

        Only loads embeddings for patterns that exist in the registry.
        Used to load cached embeddings at startup.

        Returns:
            Number of embeddings loaded
        """
        loaded = 0
        for pattern_id, emb in embeddings.items():
            if pattern_id in self._patterns:
                self._embeddings[pattern_id] = emb
                loaded += 1
        return loaded

    def precompute_embeddings(self) -> int:
        """
        Compute embeddings for all patterns that don't have them yet.

        Uses batch embedding API for efficiency.

        Returns:
            Number of embeddings computed
        """
        patterns_without_emb = [
            p for p in self._patterns.values() if p.id not in self._embeddings
        ]

        if not patterns_without_emb:
            return 0

        # Build searchable text for each pattern
        texts = [
            f"{p.name} {p.description} {' '.join(p.triggers)} {' '.join(p.capability_ids)}"
            for p in patterns_without_emb
        ]
        embeddings = get_embeddings_batch(texts)

        for pattern, emb in zip(patterns_without_emb, embeddings):
            self._embeddings[pattern.id] = emb

        logger.info(f"Pre-computed {len(patterns_without_emb)} pattern embeddings")
        return len(patterns_without_emb)

    def format_as_guidance(self, patterns: list[PlanningPattern]) -> str:
        """
        Format patterns as planning guidance string for the planner.

        Generates a string included in the planner's planning_context field.

        Args:
            patterns: Patterns to format

        Returns:
            Formatted guidance string
        """
        if not patterns:
            return ""

        parts = []
        for pattern in patterns:
            parts.append(pattern.to_planning_guidance())

        return "\n\n".join(parts)
