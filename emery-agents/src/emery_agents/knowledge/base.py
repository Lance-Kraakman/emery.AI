"""
KnowledgeBase - Searchable store for patterns, strategies, and examples.

Follows same patterns as CapabilityRegistry:
- In-memory storage
- FAISS vector search (via shared VectorIndex)
- S3 cache for persistence
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import dspy

from emery_agents.services.analysis.embeddings import (
    get_embedding,
    get_embeddings_batch,
)
from emery_agents.services.analysis.vector_search import VectorIndex

logger = logging.getLogger(__name__)


class KnowledgeType(StrEnum):
    """Type of knowledge item."""

    PATTERN = "pattern"  # Reference blueprint (org structure, workflow)
    STRATEGY = "strategy"  # How-to approach (design steps, best practices)
    GOTCHA = "gotcha"  # Common mistake to avoid


class KnowledgeDomain(StrEnum):
    """Primary domain for knowledge item."""

    BUSINESS = "business"  # Org structures, workflows, roles, policies
    DATA = "data"  # Tables, fields, schemas, relationships
    APP = "app"  # Pages, layouts, UI components
    WORKFLOW = "workflow"  # Skills, automations, processes
    INTEGRATION = "integration"  # External tools, APIs


@dataclass
class KnowledgeItem:
    """
    A searchable knowledge item with optional DSPy examples.

    Types:
        PATTERN  - Reference blueprint (org structure, workflow)
        STRATEGY - How-to approach (design steps, best practices)
        GOTCHA   - Common mistake to avoid

    Domains:
        BUSINESS    - Org structures, workflows, roles, policies
        DATA        - Tables, fields, schemas, relationships
        APP         - Pages, layouts, UI components
        WORKFLOW    - Skills, automations, processes
        INTEGRATION - External tools, APIs

    Tags:
        Granular filtering - languages (python, go), industries (healthcare),
        concepts (authentication), sources (taskstream, internal)
    """

    id: str
    type: KnowledgeType
    domain: KnowledgeDomain
    title: str
    content: str
    tags: list[str] = field(default_factory=list)
    examples: list[dspy.Example] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: tuple[float, ...] | None = None

    def searchable_text(self) -> str:
        """Text used for embedding/search."""
        return f"{self.title}. {self.content}"

    def to_context(self, include_examples: bool = False) -> str:
        """Format for injection into planner context."""
        parts = [
            f"[{self.type.value}|{self.domain.value}] {self.title}",
            "",
            self.content,
        ]

        if include_examples and self.examples:
            parts.append(f"\n({len(self.examples)} examples available)")

        return "\n".join(parts)


class KnowledgeBase:
    """
    Central knowledge store with FAISS-backed search.

    Usage:
        kb = KnowledgeBase()
        kb.load_from_s3(bucket)  # or kb.add(items)

        results = kb.search("CRM organization", types=[KnowledgeType.PATTERN])
        for item, score in results:
            print(item.title, score)
    """

    def __init__(self) -> None:
        self._items: dict[str, KnowledgeItem] = {}
        self._index: VectorIndex[KnowledgeItem] | None = None

    def add(self, items: list[KnowledgeItem], build_index: bool = True) -> None:
        """Add items to knowledge base."""
        for item in items:
            self._items[item.id] = item

        if build_index:
            self._build_index()

    def _build_index(self) -> None:
        """Build FAISS index from all items."""
        items = list(self._items.values())
        if not items:
            self._index = None
            return

        # Compute embeddings for items that don't have them
        items_needing_embeddings = [i for i in items if i.embedding is None]
        if items_needing_embeddings:
            logger.info(
                f"Computing embeddings for {len(items_needing_embeddings)} items..."
            )
            texts = [i.searchable_text() for i in items_needing_embeddings]
            embeddings = get_embeddings_batch(texts)
            for item, emb in zip(items_needing_embeddings, embeddings):
                item.embedding = emb

        # Build index
        self._index = VectorIndex[KnowledgeItem](dimension=768)
        self._index.build(items, [i.embedding for i in items])  # type: ignore[misc]

    def search(
        self,
        query: str,
        k: int = 5,
        types: list[KnowledgeType] | None = None,
        domains: list[KnowledgeDomain] | None = None,
        tags: list[str] | None = None,
    ) -> list[tuple[KnowledgeItem, float]]:
        """
        Search for relevant knowledge items.

        Args:
            query: Search query
            k: Max results
            types: Filter by type (PATTERN, STRATEGY, GOTCHA)
            domains: Filter by domain (BUSINESS, DATA, APP, WORKFLOW, INTEGRATION)
            tags: Filter by tags (items must have ALL specified tags)

        Returns:
            List of (item, score) tuples
        """
        if self._index is None:
            return []

        query_emb = get_embedding(query)

        def filter_fn(item: KnowledgeItem) -> bool:
            if types and item.type not in types:
                return False
            if domains and item.domain not in domains:
                return False
            if tags and not all(tag in item.tags for tag in tags):
                return False
            return True

        return self._index.search(query_emb, k=k, filter_fn=filter_fn)

    def get(self, item_id: str) -> KnowledgeItem | None:
        """Get item by ID."""
        return self._items.get(item_id)

    def count(self) -> int:
        """Total number of items."""
        return len(self._items)

    def count_by_type(self) -> dict[str, int]:
        """Count items by type."""
        counts: dict[str, int] = {}
        for item in self._items.values():
            counts[item.type.value] = counts.get(item.type.value, 0) + 1
        return counts

    def count_by_domain(self) -> dict[str, int]:
        """Count items by domain."""
        counts: dict[str, int] = {}
        for item in self._items.values():
            counts[item.domain.value] = counts.get(item.domain.value, 0) + 1
        return counts

    @property
    def items(self) -> dict[str, KnowledgeItem]:
        """Access to internal items dict (for cache serialization)."""
        return self._items
