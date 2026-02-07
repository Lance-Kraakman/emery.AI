"""
PlanningRegistry - searchable registry of planning patterns.

Provides semantic search to find relevant planning strategies based on
task description. Replaces static PLANNING_GUIDANCE strings with dynamic,
searchable patterns.
"""

from __future__ import annotations

import logging
from typing import Optional

from emery_agents.services.analysis import get_embedding, get_embeddings_batch, cosine_similarity
from emery_agents.planning.pattern import PlanningPattern, AutoApprovePolicy

logger = logging.getLogger(__name__)


class PlanningRegistry:
    """
    Searchable registry of planning patterns.

    Provides semantic search to find relevant planning strategies for a task.
    Each pattern includes strategy, examples, and auto-approve policy.

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

        # Semantic search for relevant patterns
        patterns = registry.search("create a contacts table", limit=3)
        for pattern in patterns:
            print(pattern.strategy)
            print(pattern.auto_approve_policy)
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

    def get(self, pattern_id: str) -> Optional[PlanningPattern]:
        """Get a specific pattern by ID."""
        return self._patterns.get(pattern_id)

    def all(self) -> list[PlanningPattern]:
        """Return all registered patterns."""
        return list(self._patterns.values())

    def count(self) -> int:
        """Return total number of registered patterns."""
        return len(self._patterns)

    # --- Search methods ---

    @staticmethod
    def _pattern_text(pattern: PlanningPattern) -> str:
        """Build searchable text from pattern metadata."""
        parts = [
            pattern.name,
            pattern.description,
            " ".join(pattern.triggers),
            " ".join(pattern.capability_ids),
        ]
        return " ".join(parts)

    def _get_embedding(self, pattern: PlanningPattern) -> tuple[float, ...]:
        """Get embedding for pattern, computing on-demand if needed."""
        if pattern.id not in self._embeddings:
            pattern_text = self._pattern_text(pattern)
            self._embeddings[pattern.id] = get_embedding(pattern_text)
        return self._embeddings[pattern.id]

    def search(
        self,
        query: str,
        *,
        capability_id: Optional[str] = None,
        limit: int = 3,
    ) -> list[PlanningPattern]:
        """
        Semantic search for relevant planning patterns.

        Args:
            query: Task description to match against
            capability_id: Optional - filter to patterns for this capability
            limit: Maximum results to return

        Returns:
            List of matching patterns ranked by relevance
        """
        candidates = list(self._patterns.values())

        # Filter by capability if specified
        if capability_id:
            candidates = [
                p for p in candidates
                if capability_id in p.capability_ids
            ]

        if not candidates:
            return []

        try:
            query_embedding = get_embedding(query)

            scored: list[tuple[float, PlanningPattern]] = []
            for pattern in candidates:
                pattern_embedding = self._get_embedding(pattern)
                score = cosine_similarity(query_embedding, pattern_embedding)
                scored.append((score, pattern))

            scored.sort(key=lambda x: x[0], reverse=True)

            results = [pattern for _, pattern in scored[:limit]]
            logger.debug(f"Pattern search '{query}' -> {len(results)} results")
            return results

        except Exception as e:
            logger.warning(f"Pattern search failed: {e}")
            return []

    def get_for_capability(self, capability_id: str) -> list[PlanningPattern]:
        """
        Get all patterns that apply to a capability.

        Args:
            capability_id: Capability ID (e.g., "agent:schema_builder")

        Returns:
            List of patterns that include this capability
        """
        return [
            p for p in self._patterns.values()
            if capability_id in p.capability_ids
        ]

    def get_by_policy(self, policy: AutoApprovePolicy) -> list[PlanningPattern]:
        """
        Get all patterns with a specific auto-approve policy.

        Args:
            policy: AutoApprovePolicy to filter by

        Returns:
            List of patterns with matching policy
        """
        return [
            p for p in self._patterns.values()
            if p.auto_approve_policy == policy
        ]

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
            p for p in self._patterns.values()
            if p.id not in self._embeddings
        ]

        if not patterns_without_emb:
            return 0

        texts = [self._pattern_text(p) for p in patterns_without_emb]
        embeddings = get_embeddings_batch(texts)

        for pattern, emb in zip(patterns_without_emb, embeddings):
            self._embeddings[pattern.id] = emb

        logger.info(f"Pre-computed {len(patterns_without_emb)} pattern embeddings")
        return len(patterns_without_emb)

    def format_as_guidance(self, patterns: list[PlanningPattern]) -> str:
        """
        Format patterns as planning guidance string for the planner.

        Generates a string compatible with the CreatePlan signature's
        capability_guidance field.

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
