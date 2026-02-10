"""
Semantic Retrievers for capabilities, patterns, knowledge, strategies.

Uses DSPy's Embeddings retriever (FAISS-backed for large corpora) with dspy.Embedder
for automatic caching via dspy.configure_cache().
"""

from __future__ import annotations

import logging
from typing import Any, Generic, TypeVar

import dspy
from dspy.retrievers import Embeddings

from emery_agents.ace import StrategyAccumulationService, StrategyRecord
from emery_agents.entities.models.capability import Capability
from emery_agents.knowledge.base import KnowledgeBase, KnowledgeItem
from emery_agents.planning.pattern import PlanningPattern
from emery_agents.planning.registry import PlanningRegistry
from emery_agents.tools.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Global retrievers (knowledge, patterns) - shared across orgs
_global_retrievers: dict[str, BaseRetriever[Any]] = {}

# Per-org retrievers (capabilities) - keyed by org_id
_org_retrievers: dict[str, dict[str, BaseRetriever[Any]]] = {}


def _create_embedder() -> dspy.Embedder:
    """Create DSPy Embedder with built-in caching."""
    return dspy.Embedder(
        model="gemini/gemini-embedding-001",
        caching=True,
        batch_size=100,  # Gemini max batch size
    )


class BaseRetriever(Generic[T]):
    """Base class for typed retrievers using DSPy Embeddings."""

    def __init__(self, items: list[T], corpus: list[str], k: int = 5) -> None:
        self.k = k
        self._items = items
        self._retriever: Embeddings | None = None

        if not items:
            return

        if len(items) != len(corpus):
            raise ValueError(f"Items ({len(items)}) and corpus ({len(corpus)}) must match")

        self._retriever = Embeddings(
            corpus=corpus,
            embedder=_create_embedder(),
            k=k,
            brute_force_threshold=20_000,
        )

    def __call__(self, query: str) -> list[T]:
        """Find items relevant to the query."""
        if not self._items or not self._retriever:
            return []

        result = self._retriever(query)
        indices = getattr(result, "indices", [])
        return [self._items[i] for i in indices[:self.k] if i < len(self._items)]


class CapabilityRetriever(BaseRetriever[Capability]):
    """Retrieve relevant capabilities from org's enabled set."""

    def __init__(self, org_id: str, registry: CapabilityRegistry, k: int = 5) -> None:
        enabled = registry.get_enabled(org_id)
        if not enabled:
            logger.warning(f"No enabled capabilities for org {org_id}")
            super().__init__([], [], k)
            return

        corpus = [self._to_text(cap) for cap in enabled]
        super().__init__(enabled, corpus, k)
        logger.info(f"CapabilityRetriever: {len(enabled)} capabilities for org {org_id}")

    @staticmethod
    def _to_text(cap: Capability) -> str:
        text = f"{cap.name}: {cap.description}"
        if cap.actions:
            text += f" Actions: {', '.join(cap.actions)}."
        if cap.entities:
            text += f" Entities: {', '.join(cap.entities)}."
        return text

    def format_for_planner(self, capabilities: list[Capability]) -> str:
        if not capabilities:
            return ""
        parts = ["## Retrieved Capabilities\n"]
        for cap in capabilities:
            parts.append(f"- **{cap.id}** ({cap.type.value}): {cap.description}")
            if cap.actions:
                parts.append(f"  Actions: {', '.join(cap.actions)}")
        return "\n".join(parts)


class PatternRetriever(BaseRetriever[PlanningPattern]):
    """Retrieve relevant planning patterns."""

    def __init__(self, registry: PlanningRegistry, k: int = 3) -> None:
        patterns = registry.all()
        if not patterns:
            logger.warning("No planning patterns in registry")
            super().__init__([], [], k)
            return

        corpus = [self._to_text(p) for p in patterns]
        super().__init__(patterns, corpus, k)
        logger.info(f"PatternRetriever: {len(patterns)} patterns indexed")

    @staticmethod
    def _to_text(pattern: PlanningPattern) -> str:
        text = f"{pattern.name}: {pattern.description}"
        if pattern.triggers:
            text += f" Triggers: {', '.join(pattern.triggers)}."
        return text

    def format_for_planner(self, patterns: list[PlanningPattern]) -> str:
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


class KnowledgeRetriever(BaseRetriever[KnowledgeItem]):
    """Retrieve relevant knowledge items."""

    def __init__(self, kb: KnowledgeBase, k: int = 5) -> None:
        items = list(kb.items.values())
        if not items:
            logger.warning("No knowledge items in base")
            super().__init__([], [], k)
            return

        corpus = [item.searchable_text() for item in items]
        super().__init__(items, corpus, k)
        logger.info(f"KnowledgeRetriever: {len(items)} items indexed")

    def format_for_planner(self, items: list[KnowledgeItem]) -> str:
        if not items:
            return ""
        parts = ["## Retrieved Knowledge\n"]
        for item in items:
            parts.append(item.to_context(include_examples=True))
            parts.append("")
        return "\n".join(parts)


class StrategyRetriever(BaseRetriever[StrategyRecord]):
    """Retrieve proven strategies from ACE."""

    def __init__(
        self,
        ace_service: StrategyAccumulationService,
        min_confidence: float = 0.3,
        k: int = 3,
    ) -> None:
        strategies = [
            r
            for r in ace_service.registry.strategies.values()
            if r.confidence_score >= min_confidence
        ]

        if not strategies:
            logger.info("No ACE strategies above confidence threshold")
            super().__init__([], [], k)
            return

        corpus = [r.pattern.goal_signature for r in strategies]
        super().__init__(strategies, corpus, k)
        logger.info(f"StrategyRetriever: {len(strategies)} strategies indexed")

    def format_for_planner(self, strategies: list[StrategyRecord]) -> str:
        if not strategies:
            return ""
        parts = ["## Proven Strategies\n", "Patterns that worked for similar goals:\n"]
        for i, record in enumerate(strategies, 1):
            pattern = record.pattern
            parts.append(f"### Strategy {i} ({record.confidence_score:.0%})")
            parts.append(f"**Goal:** {pattern.goal_signature[:100]}")
            parts.append("**Steps:**")
            for j, step in enumerate(pattern.step_sequence[:5], 1):
                parts.append(f"{j}. {step[:80]}")
            if len(pattern.step_sequence) > 5:
                parts.append(f"   ... +{len(pattern.step_sequence) - 5} more")
            if pattern.agent_sequence:
                parts.append(f"**Agents:** {', '.join(set(pattern.agent_sequence))}")
            if pattern.success_factors:
                parts.append("**Success factors:**")
                for factor in pattern.success_factors[:3]:
                    parts.append(f"- {factor}")
            parts.append("")
        return "\n".join(parts)


def get_or_create_retrievers(
    org_id: str,
    capability_registry: CapabilityRegistry | None = None,
    planning_registry: PlanningRegistry | None = None,
    knowledge_base: KnowledgeBase | None = None,
    ace_service: StrategyAccumulationService | None = None,
) -> dict[str, Any]:
    """
    Get cached retrievers or create new ones.

    Global retrievers (knowledge, patterns) are shared across orgs.
    Per-org retrievers (capabilities) are cached per org_id.
    """
    retrievers: dict[str, Any] = {}

    # Global retrievers (create once, share across orgs)
    if "knowledge" not in _global_retrievers and knowledge_base:
        logger.info("Creating global KnowledgeRetriever")
        _global_retrievers["knowledge"] = KnowledgeRetriever(knowledge_base)

    if "patterns" not in _global_retrievers and planning_registry:
        logger.info("Creating global PatternRetriever")
        _global_retrievers["patterns"] = PatternRetriever(planning_registry)

    retrievers.update({k: v for k, v in _global_retrievers.items()})

    # Org-specific retrievers
    if org_id not in _org_retrievers:
        _org_retrievers[org_id] = {}

    if "capabilities" not in _org_retrievers[org_id] and capability_registry:
        logger.info(f"Creating CapabilityRetriever for org {org_id}")
        _org_retrievers[org_id]["capabilities"] = CapabilityRetriever(
            org_id, capability_registry
        )

    if "capabilities" in _org_retrievers.get(org_id, {}):
        retrievers["capabilities"] = _org_retrievers[org_id]["capabilities"]

    # Strategy retriever (not cached - ACE service may change)
    if ace_service:
        retrievers["strategies"] = StrategyRetriever(ace_service)

    logger.info(f"Returning {len(retrievers)} retrievers for org {org_id}")
    return retrievers


def clear_retriever_cache() -> None:
    """Clear all cached retrievers."""
    _global_retrievers.clear()
    _org_retrievers.clear()
    logger.info("Cleared retriever cache")
