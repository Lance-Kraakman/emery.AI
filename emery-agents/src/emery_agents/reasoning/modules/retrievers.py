"""
Semantic Retrievers for capabilities, patterns, knowledge, strategies.

Provides KNN-style semantic search using cosine similarity:
- CapabilityRetriever: Find relevant capabilities from org's enabled set
- PatternRetriever: Find relevant planning patterns from PlanningRegistry
- KnowledgeRetriever: Find relevant knowledge items from KnowledgeBase
- StrategyRetriever: Find proven strategies from ACE patterns

Uses direct embedding search (not KNNFewShot which is for prompt optimization).
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from emery_agents.services.analysis.embeddings import (
    cosine_similarity,
    get_embedding,
    get_embeddings_batch,
)

if TYPE_CHECKING:
    from emery_agents.ace import StrategyAccumulationService, StrategyRecord
    from emery_agents.entities.models.capability import Capability
    from emery_agents.knowledge.base import KnowledgeBase, KnowledgeItem
    from emery_agents.planning.pattern import PlanningPattern
    from emery_agents.planning.registry import PlanningRegistry
    from emery_agents.tools.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)


class CapabilityRetriever:
    """
    Retrieve relevant capabilities using semantic similarity.

    Replaces custom semantic search in CapabilityRegistry.search_enabled().
    Uses batch embeddings for fast initialization.
    """

    def __init__(
        self,
        org_id: str,
        registry: CapabilityRegistry,
        k: int = 5,
    ) -> None:
        """
        Initialize retriever with org's enabled capabilities.

        Args:
            org_id: Organization ID to get enabled capabilities for
            registry: CapabilityRegistry instance
            k: Number of capabilities to retrieve (default: 5)
        """
        self.k = k
        self._capabilities: list[Capability] = []
        self._embeddings: list[tuple[float, ...]] = []

        # Get org's enabled capabilities (50-500, not all 30K)
        enabled = registry.get_enabled(org_id)
        if not enabled:
            logger.warning(f"No enabled capabilities for org {org_id}")
            return

        self._capabilities = enabled

        # Build descriptions for embedding
        descriptions = [self._cap_to_text(cap) for cap in enabled]

        # Batch embed all capabilities
        self._embeddings = get_embeddings_batch(descriptions)

        logger.info(
            f"CapabilityRetriever: {len(enabled)} capabilities indexed for org {org_id}"
        )

    def _cap_to_text(self, cap: Capability) -> str:
        """Convert Capability to searchable text."""
        text = f"{cap.name}: {cap.description}"
        if cap.actions:
            text += f" Actions: {', '.join(cap.actions)}."
        if cap.entities:
            text += f" Entities: {', '.join(cap.entities)}."
        return text

    def __call__(self, task: str) -> list[Capability]:
        """Find capabilities relevant to the task."""
        if not self._capabilities:
            return []

        # Embed the query
        query_emb = get_embedding(task)

        # Compute similarities and sort
        scored: list[tuple[float, Capability]] = []
        for cap, emb in zip(self._capabilities, self._embeddings):
            score = cosine_similarity(query_emb, emb)
            scored.append((score, cap))

        scored.sort(key=lambda x: x[0], reverse=True)

        return [cap for _, cap in scored[: self.k]]

    def format_for_planner(self, capabilities: list[Capability]) -> str:
        """Format retrieved capabilities as context string for planner."""
        if not capabilities:
            return ""

        parts = ["## Retrieved Capabilities\n"]
        for cap in capabilities:
            parts.append(f"- **{cap.id}** ({cap.type.value}): {cap.description}")
            if cap.actions:
                parts.append(f"  Actions: {', '.join(cap.actions)}")
        return "\n".join(parts)


class PatternRetriever:
    """
    Retrieve relevant planning patterns using semantic similarity.

    Replaces custom semantic search in PlanningRegistry.search().
    Patterns include strategies, step templates, and auto-approve policies.
    """

    def __init__(
        self,
        registry: PlanningRegistry,
        k: int = 3,
    ) -> None:
        """
        Initialize retriever with planning patterns.

        Args:
            registry: PlanningRegistry instance
            k: Number of patterns to retrieve (default: 3)
        """
        self.k = k
        self._patterns: list[PlanningPattern] = []
        self._embeddings: list[tuple[float, ...]] = []

        patterns = registry.all()
        if not patterns:
            logger.warning("No planning patterns in registry")
            return

        self._patterns = patterns

        # Build descriptions for embedding
        descriptions = [self._pattern_to_text(p) for p in patterns]

        # Batch embed all patterns
        self._embeddings = get_embeddings_batch(descriptions)

        logger.info(f"PatternRetriever: {len(patterns)} patterns indexed")

    def _pattern_to_text(self, pattern: PlanningPattern) -> str:
        """Convert PlanningPattern to searchable text."""
        text = f"{pattern.name}: {pattern.description}"
        if pattern.triggers:
            text += f" Triggers: {', '.join(pattern.triggers)}."
        return text

    def __call__(self, task: str) -> list[PlanningPattern]:
        """Find patterns relevant to the task."""
        if not self._patterns:
            return []

        # Embed the query
        query_emb = get_embedding(task)

        # Compute similarities and sort
        scored: list[tuple[float, PlanningPattern]] = []
        for pattern, emb in zip(self._patterns, self._embeddings):
            score = cosine_similarity(query_emb, emb)
            scored.append((score, pattern))

        scored.sort(key=lambda x: x[0], reverse=True)

        return [pattern for _, pattern in scored[: self.k]]

    def format_for_planner(self, patterns: list[PlanningPattern]) -> str:
        """Format retrieved patterns as context string for planner."""
        if not patterns:
            return ""

        parts = ["## Retrieved Planning Patterns\n"]
        for pattern in patterns:
            parts.append(f"### {pattern.name}")
            parts.append(f"**Strategy:** {pattern.strategy}")
            if pattern.step_templates:
                parts.append("**Step templates:**")
                for tmpl in pattern.step_templates[:5]:
                    parts.append(f"  - {tmpl}")
            if pattern.common_mistakes:
                parts.append(f"**Avoid:** {', '.join(pattern.common_mistakes[:3])}")
            parts.append(f"**Auto-approve:** {pattern.auto_approve_policy.value}")
            parts.append("")
        return "\n".join(parts)


class KnowledgeRetriever:
    """
    Retrieve relevant knowledge items using semantic similarity.

    Replaces FAISS-backed search in KnowledgeBase.search().
    Knowledge includes org structures, strategies, gotchas, and examples.
    """

    def __init__(
        self,
        kb: KnowledgeBase,
        k: int = 5,
    ) -> None:
        """
        Initialize retriever with knowledge items.

        Args:
            kb: KnowledgeBase instance
            k: Number of items to retrieve (default: 5)
        """
        self.k = k
        self._items: list[KnowledgeItem] = []
        self._embeddings: list[tuple[float, ...]] = []

        items = list(kb.items.values())
        if not items:
            logger.warning("No knowledge items in base")
            return

        self._items = items

        # Build searchable text for embedding
        texts = [item.searchable_text() for item in items]

        # Batch embed all items
        self._embeddings = get_embeddings_batch(texts)

        logger.info(f"KnowledgeRetriever: {len(items)} items indexed")

    def __call__(self, task: str) -> list[KnowledgeItem]:
        """Find knowledge items relevant to the task."""
        if not self._items:
            return []

        # Embed the query
        query_emb = get_embedding(task)

        # Compute similarities and sort
        scored: list[tuple[float, KnowledgeItem]] = []
        for item, emb in zip(self._items, self._embeddings):
            score = cosine_similarity(query_emb, emb)
            scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)

        return [item for _, item in scored[: self.k]]

    def format_for_planner(self, items: list[KnowledgeItem]) -> str:
        """Format retrieved knowledge as context string for planner."""
        if not items:
            return ""

        parts = ["## Retrieved Knowledge\n"]
        for item in items:
            parts.append(item.to_context(include_examples=True))
            parts.append("")
        return "\n".join(parts)


class StrategyRetriever:
    """
    Retrieve proven strategies from ACE (Agentic Context Engineering).

    Uses semantic similarity on past successful execution patterns.
    Replaces LLM-based ranking in StrategyAccumulationService.get_relevant_strategies().
    """

    def __init__(
        self,
        ace_service: StrategyAccumulationService,
        min_confidence: float = 0.3,
        k: int = 3,
    ) -> None:
        """
        Initialize retriever with ACE strategies.

        Args:
            ace_service: StrategyAccumulationService instance
            min_confidence: Minimum confidence score to include (default: 0.3)
            k: Number of strategies to retrieve (default: 3)
        """
        self.k = k
        self._strategies: list[StrategyRecord] = []
        self._embeddings: list[tuple[float, ...]] = []

        # Filter by confidence
        strategies = [
            r
            for r in ace_service.registry.strategies.values()
            if r.confidence_score >= min_confidence
        ]

        if not strategies:
            logger.info("No ACE strategies above confidence threshold")
            return

        self._strategies = strategies

        # Build goal signatures for embedding
        goals = [r.pattern.goal_signature for r in strategies]

        # Batch embed all strategies
        self._embeddings = get_embeddings_batch(goals)

        logger.info(f"StrategyRetriever: {len(strategies)} strategies indexed")

    def __call__(self, task: str) -> list[StrategyRecord]:
        """Find strategies relevant to the task."""
        if not self._strategies:
            return []

        # Embed the query
        query_emb = get_embedding(task)

        # Compute similarities and sort
        scored: list[tuple[float, StrategyRecord]] = []
        for strategy, emb in zip(self._strategies, self._embeddings):
            score = cosine_similarity(query_emb, emb)
            scored.append((score, strategy))

        scored.sort(key=lambda x: x[0], reverse=True)

        return [strategy for _, strategy in scored[: self.k]]

    def format_for_planner(self, strategies: list[StrategyRecord]) -> str:
        """Format retrieved strategies as context string for planner."""
        if not strategies:
            return ""

        parts = ["## Proven Strategies\n"]
        parts.append("The following patterns have worked well for similar goals:\n")

        for i, record in enumerate(strategies, 1):
            pattern = record.pattern
            parts.append(f"### Strategy {i} (confidence: {record.confidence_score:.0%})")
            parts.append(f"**Goal type:** {pattern.goal_signature[:100]}")
            parts.append("")
            parts.append("**Typical steps:**")
            for j, step in enumerate(pattern.step_sequence[:5], 1):
                parts.append(f"{j}. {step[:80]}")
            if len(pattern.step_sequence) > 5:
                parts.append(f"   ... and {len(pattern.step_sequence) - 5} more steps")
            parts.append("")

            if pattern.agent_sequence:
                agents = ", ".join(set(pattern.agent_sequence))
                parts.append(f"**Agents used:** {agents}")
                parts.append("")

            if pattern.success_factors:
                parts.append("**Success factors:**")
                for factor in pattern.success_factors[:3]:
                    parts.append(f"- {factor}")
                parts.append("")

        return "\n".join(parts)


def create_retrievers(
    org_id: str,
    capability_registry: CapabilityRegistry | None = None,
    planning_registry: PlanningRegistry | None = None,
    knowledge_base: KnowledgeBase | None = None,
    ace_service: StrategyAccumulationService | None = None,
) -> dict[str, Any]:
    """
    Create all retrievers for an organization.

    Factory function that creates retrievers only for available registries.

    Args:
        org_id: Organization ID
        capability_registry: Optional CapabilityRegistry
        planning_registry: Optional PlanningRegistry
        knowledge_base: Optional KnowledgeBase
        ace_service: Optional StrategyAccumulationService

    Returns:
        Dict with retriever instances (keys: capabilities, patterns, knowledge, strategies)
    """
    retrievers: dict[str, Any] = {}

    if capability_registry:
        retrievers["capabilities"] = CapabilityRetriever(org_id, capability_registry)

    if planning_registry:
        retrievers["patterns"] = PatternRetriever(planning_registry)

    if knowledge_base:
        retrievers["knowledge"] = KnowledgeRetriever(knowledge_base)

    if ace_service:
        retrievers["strategies"] = StrategyRetriever(ace_service)

    logger.info(f"Created {len(retrievers)} retrievers for org {org_id}")
    return retrievers
