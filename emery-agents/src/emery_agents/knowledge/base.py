"""
KnowledgeBase - Storage for patterns, strategies, and examples.

Simple in-memory storage. Search is handled by KnowledgeRetriever
which uses DSPy's Embeddings retriever for semantic search.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import dspy

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
    Central knowledge store.

    Simple in-memory storage for knowledge items.
    Search is handled by KnowledgeRetriever using DSPy Embeddings.

    Usage:
        kb = KnowledgeBase()
        kb.add(items)
        # Access items via kb.items for KnowledgeRetriever
    """

    def __init__(self) -> None:
        self._items: dict[str, KnowledgeItem] = {}

    def add(self, items: list[KnowledgeItem]) -> None:
        """Add items to knowledge base."""
        for item in items:
            self._items[item.id] = item
        logger.info(f"Added {len(items)} items to knowledge base")

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
