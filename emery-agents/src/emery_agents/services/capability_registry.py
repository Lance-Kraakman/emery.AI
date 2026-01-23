"""
Capability Registry - central storage for all capabilities.

Provides discovery methods for the planner to find relevant capabilities
without loading all 30K+ capabilities into context at once.

Uses semantic search (Google embeddings) for accurate capability matching.
"""

import logging
from typing import Optional

from emery_agents.models.capability import Capability, CapabilityType

logger = logging.getLogger(__name__)


class CapabilityRegistry:
    """
    Central registry for all capabilities (agents, skills, tools).

    The planner uses discovery methods to find relevant capabilities
    rather than receiving the full list (which could be 30K+ items).

    Usage:
        registry = CapabilityRegistry()

        # Register capabilities at startup
        registry.register(Capability(
            id="agent:schema_builder",
            name="schema_builder",
            type=CapabilityType.AGENT,
            domain="emery",
            description="Creates database tables and fields",
            actions=["create", "update", "delete"],
            entities=["tables", "fields"],
        ))

        # Planner discovers capabilities
        results = registry.search("create tables")
        capability = registry.get("agent:schema_builder")
    """

    def __init__(self) -> None:
        self._capabilities: dict[str, Capability] = {}

    def register(self, capability: Capability) -> None:
        """Register a capability in the registry."""
        self._capabilities[capability.id] = capability

    def unregister(self, capability_id: str) -> bool:
        """Remove a capability from the registry. Returns True if found."""
        if capability_id in self._capabilities:
            del self._capabilities[capability_id]
            return True
        return False

    def get(self, capability_id: str) -> Optional[Capability]:
        """Get a specific capability by ID."""
        return self._capabilities.get(capability_id)

    def all(self) -> list[Capability]:
        """Return all registered capabilities."""
        return list(self._capabilities.values())

    def count(self) -> int:
        """Return total number of registered capabilities."""
        return len(self._capabilities)

    def by_type(self, capability_type: CapabilityType) -> list[Capability]:
        """
        Filter capabilities by type (AGENT, SKILL, TOOL).

        Args:
            capability_type: The type to filter by

        Returns:
            List of matching capabilities
        """
        return [c for c in self._capabilities.values() if c.type == capability_type]

    def by_domain(self, domain: str) -> list[Capability]:
        """
        Filter capabilities by domain (emery, gmail, slack, etc.).

        Args:
            domain: The domain to filter by (case-insensitive)

        Returns:
            List of matching capabilities
        """
        domain_lower = domain.lower()
        return [
            c for c in self._capabilities.values() if c.domain.lower() == domain_lower
        ]

    def search(
        self,
        query: str,
        *,
        capability_type: Optional[CapabilityType] = None,
        domain: Optional[str] = None,
        limit: int = 10,
        use_semantic: bool = True,
    ) -> list[Capability]:
        """
        Search capabilities using semantic similarity.

        Uses Google embeddings to find capabilities that match the query
        semantically (not just keyword matching). This handles synonyms
        and related concepts.

        Args:
            query: Search query string (e.g., "create database tables")
            capability_type: Optional type filter (AGENT, SKILL, TOOL)
            domain: Optional domain filter (emery, gmail, etc.)
            limit: Maximum results to return (default 10)
            use_semantic: If True (default), use semantic search. If False, use keyword.

        Returns:
            List of matching capabilities ranked by relevance, limited to `limit`
        """
        candidates: list[Capability] = list(self._capabilities.values())

        # Apply pre-filters
        if capability_type:
            candidates = [c for c in candidates if c.type == capability_type]
        if domain:
            domain_lower = domain.lower()
            candidates = [c for c in candidates if c.domain.lower() == domain_lower]

        if not candidates:
            return []

        if not use_semantic:
            # Fallback to keyword matching
            matches = [c for c in candidates if c.matches_query(query)]
            return matches[:limit]

        # Semantic search using embeddings
        try:
            from .embedding_service import get_embedding, cosine_similarity

            query_embedding = get_embedding(query)

            # Score each capability by similarity
            scored: list[tuple[float, Capability]] = []
            for cap in candidates:
                # Build searchable text from capability metadata
                cap_text = f"{cap.name} {cap.description} {' '.join(cap.actions)} {' '.join(cap.entities)}"
                cap_embedding = get_embedding(cap_text)
                score = cosine_similarity(query_embedding, cap_embedding)
                scored.append((score, cap))

            # Sort by score descending
            scored.sort(key=lambda x: x[0], reverse=True)

            results = [cap for _, cap in scored[:limit]]
            logger.debug(f"Semantic search '{query}' → {len(results)} results")
            return results

        except Exception as e:
            # Fallback to keyword matching if embeddings fail
            logger.warning(f"Semantic search failed, falling back to keyword: {e}")
            matches = [c for c in candidates if c.matches_query(query)]
            return matches[:limit]

    def list_domains(self) -> list[str]:
        """Return list of unique domains across all capabilities."""
        return sorted(set(c.domain for c in self._capabilities.values()))

    def clear(self) -> None:
        """Remove all capabilities from the registry."""
        self._capabilities.clear()
