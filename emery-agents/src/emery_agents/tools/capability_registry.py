"""
Capability Registry - central storage for all capabilities.

Provides discovery methods for the planner to find relevant capabilities
without loading all 30K+ capabilities into context at once.

Two-tier capability access:
- Enabled: Capabilities the org has enabled (system agents, org skills, connected integrations)
- Available: All other capabilities (marketplace, unconnected integrations)

Uses semantic search (Gemini embeddings) for accurate capability matching.
"""

import logging
from typing import Optional
from emery_agents.services.analysis import get_embedding, get_embeddings_batch, cosine_similarity
from emery_agents.entities.models.capability import Capability, CapabilityType

logger = logging.getLogger(__name__)


class CapabilityRegistry:
    """
    Central registry for all capabilities (agents, skills, tools).

    Tracks which capabilities are enabled per-org for two-tier search:
    - get_enabled(org_id): Org's active capabilities
    - get_available(org_id): Capabilities org could enable

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

        # Enable for an org
        registry.enable_for_org("agent:schema_builder", org_id="org_123")

        # Two-tier discovery
        enabled = registry.get_enabled("org_123")  # Org's capabilities
        available = registry.get_available("org_123")  # Not yet enabled
    """

    def __init__(self) -> None:
        self._capabilities: dict[str, Capability] = {}
        self._enabled: dict[str, set[str]] = {}  # org_id -> set of capability_ids
        self._embeddings: dict[str, tuple[float, ...]] = {}  # cap_id -> embedding vector

    def register(self, capability: Capability) -> None:
        """Register a capability in the registry."""
        self._capabilities[capability.id] = capability

    def unregister(self, capability_id: str) -> bool:
        """Remove a capability from the registry. Returns True if found."""
        if capability_id in self._capabilities:
            del self._capabilities[capability_id]
            self._embeddings.pop(capability_id, None)
            for enabled_set in self._enabled.values():
                enabled_set.discard(capability_id)
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

    # --- Per-org enabled tracking ---

    def enable_for_org(self, capability_id: str, org_id: str) -> bool:
        """
        Mark a capability as enabled for an org.

        Returns True if capability exists, False otherwise.
        """
        if capability_id not in self._capabilities:
            logger.warning(f"Cannot enable unknown capability: {capability_id}")
            return False

        if org_id not in self._enabled:
            self._enabled[org_id] = set()
        self._enabled[org_id].add(capability_id)
        return True

    def disable_for_org(self, capability_id: str, org_id: str) -> bool:
        """
        Mark a capability as disabled for an org.

        Returns True if was enabled, False otherwise.
        """
        if org_id in self._enabled and capability_id in self._enabled[org_id]:
            self._enabled[org_id].discard(capability_id)
            return True
        return False

    def is_enabled(self, capability_id: str, org_id: str) -> bool:
        """Check if capability is enabled for org."""
        return org_id in self._enabled and capability_id in self._enabled[org_id]

    def get_enabled(self, org_id: str) -> list[Capability]:
        """
        Get capabilities enabled for this org.

        Returns:
            List of capabilities the org has enabled (agents, skills, connected integrations)
        """
        enabled_ids = self._enabled.get(org_id, set())
        return [c for c in self._capabilities.values() if c.id in enabled_ids]

    def get_available(self, org_id: str) -> list[Capability]:
        """
        Get capabilities NOT enabled for this org.

        Returns:
            List of capabilities the org could enable (marketplace, unconnected integrations)
        """
        enabled_ids = self._enabled.get(org_id, set())
        return [c for c in self._capabilities.values() if c.id not in enabled_ids]

    def enable_all_system_agents(self, org_id: str) -> int:
        """
        Enable all system agents (domain=emery) for an org.

        Called at org creation to give access to core capabilities.

        Returns:
            Number of system agents enabled
        """
        count = 0
        for cap in self._capabilities.values():
            if cap.domain == "emery" and cap.type == CapabilityType.AGENT:
                self.enable_for_org(cap.id, org_id)
                count += 1
        return count

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

    @staticmethod
    def _capability_text(cap: Capability) -> str:
        """Build searchable text from capability metadata."""
        return f"{cap.name} {cap.description} {' '.join(cap.actions)} {' '.join(cap.entities)}"

    def _get_embedding(self, cap: Capability) -> tuple[float, ...]:
        """Get embedding for capability, using registry cache if available."""
        if cap.id not in self._embeddings:
            cap_text = self._capability_text(cap)
            self._embeddings[cap.id] = get_embedding(cap_text)
        return self._embeddings[cap.id]

    def _semantic_search(
        self,
        query: str,
        candidates: list[Capability],
        limit: int,
    ) -> list[Capability]:
        """Perform semantic search on a list of capabilities.

        Embeddings are expected to be pre-computed at startup (via S3 cache
        or batch API). Dynamic capabilities (user skills) are computed
        on-demand via _get_embedding().

        Args:
            query: Search query string
            candidates: Capabilities to search within
            limit: Maximum results to return

        Returns:
            List of matching capabilities ranked by similarity.
            Returns empty list if embedding service fails.
        """
        if not candidates:
            return []

        try:
            query_embedding = get_embedding(query)

            scored: list[tuple[float, Capability]] = []
            for cap in candidates:
                cap_embedding = self._get_embedding(cap)
                score = cosine_similarity(query_embedding, cap_embedding)
                scored.append((score, cap))

            scored.sort(key=lambda x: x[0], reverse=True)

            results = [cap for _, cap in scored[:limit]]
            logger.debug(f"Semantic search '{query}' -> {len(results)} results")
            return results

        except Exception as e:
            logger.warning(f"Semantic search failed: {e}")
            return []

    # --- Embedding pre-computation ---

    def load_embeddings(self, embeddings: dict[str, tuple[float, ...]]) -> int:
        """Bulk-load pre-computed embeddings into the registry.

        Only loads embeddings for capabilities that exist in the registry.
        Used to load S3-cached integration embeddings at startup.

        Returns:
            Number of embeddings loaded
        """
        loaded = 0
        for cap_id, emb in embeddings.items():
            if cap_id in self._capabilities:
                self._embeddings[cap_id] = emb
                loaded += 1
        return loaded

    def export_embeddings(self, prefix: str) -> dict[str, tuple[float, ...]]:
        """Export cached embeddings matching prefix for external storage.

        Used to save computed embeddings to S3 after a cache miss.
        """
        return {
            cap_id: emb
            for cap_id, emb in self._embeddings.items()
            if cap_id.startswith(prefix)
        }

    def precompute_embeddings(self, prefix: str = "integration:") -> int:
        """Compute embeddings for capabilities matching prefix via batch API.

        Used as fallback when S3 cache is missing. Computes all embeddings
        for the prefix in bulk using multi-text embed_content calls.

        Returns:
            Number of embeddings computed
        """
        caps = [
            c for c in self._capabilities.values()
            if c.id.startswith(prefix) and c.id not in self._embeddings
        ]

        if not caps:
            return 0

        texts = [self._capability_text(c) for c in caps]
        embeddings = get_embeddings_batch(texts)

        for cap, emb in zip(caps, embeddings):
            self._embeddings[cap.id] = emb

        logger.info(f"Pre-computed {len(caps)} embeddings for '{prefix}*' capabilities")
        return len(caps)

    def search(
        self,
        query: str,
        *,
        capability_type: Optional[CapabilityType] = None,
        domain: Optional[str] = None,
        limit: int = 10,
    ) -> list[Capability]:
        """
        Search capabilities using semantic similarity.

        Uses Gemini embeddings to find capabilities that match the query
        semantically (not just keyword matching). This handles synonyms
        and related concepts.

        Args:
            query: Search query string (e.g., "create database tables")
            capability_type: Optional type filter (AGENT, SKILL, TOOL)
            domain: Optional domain filter (emery, gmail, etc.)
            limit: Maximum results to return (default 10)

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

        return self._semantic_search(query, candidates, limit)

    def list_domains(self) -> list[str]:
        """Return list of unique domains across all capabilities."""
        return sorted(set(c.domain for c in self._capabilities.values()))

    def clear(self) -> None:
        """Remove all capabilities and enabled tracking from the registry."""
        self._capabilities.clear()
        self._enabled.clear()
        self._embeddings.clear()

    def clear_by_type(self, capability_type: CapabilityType) -> int:
        """Remove all capabilities of a given type.

        Used for per-request refresh of SKILL/TOOL registrations
        before re-populating with current data.

        Returns:
            Number of capabilities removed
        """
        to_remove = [
            cap_id for cap_id, cap in self._capabilities.items()
            if cap.type == capability_type
        ]
        for cap_id in to_remove:
            del self._capabilities[cap_id]
            self._embeddings.pop(cap_id, None)
            for enabled_set in self._enabled.values():
                enabled_set.discard(cap_id)
        return len(to_remove)

    def clear_by_id_prefix(self, prefix: str) -> int:
        """Remove all capabilities whose ID starts with prefix.

        More targeted than clear_by_type — preserves integration services
        when clearing per-request tool registrations.

        Returns:
            Number of capabilities removed
        """
        to_remove = [
            cap_id for cap_id in self._capabilities
            if cap_id.startswith(prefix)
        ]
        for cap_id in to_remove:
            del self._capabilities[cap_id]
            self._embeddings.pop(cap_id, None)
            for enabled_set in self._enabled.values():
                enabled_set.discard(cap_id)
        return len(to_remove)

    def clear_org(self, org_id: str) -> None:
        """Remove all enabled tracking for an org."""
        if org_id in self._enabled:
            del self._enabled[org_id]

    def search_enabled(
        self,
        query: str,
        org_id: str,
        *,
        limit: int = 5,
    ) -> list[Capability]:
        """
        Search within org's enabled capabilities using semantic similarity.

        Args:
            query: Search query string
            org_id: Organization ID
            limit: Maximum results

        Returns:
            Matching enabled capabilities ranked by relevance
        """
        enabled = self.get_enabled(org_id)
        return self._semantic_search(query, enabled, limit)

    def search_available(
        self,
        query: str,
        org_id: str,
        *,
        limit: int = 5,
    ) -> list[Capability]:
        """
        Search within capabilities NOT enabled for org using semantic similarity.

        Args:
            query: Search query string
            org_id: Organization ID
            limit: Maximum results

        Returns:
            Matching available capabilities ranked by relevance
        """
        available = self.get_available(org_id)
        return self._semantic_search(query, available, limit)
