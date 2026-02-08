"""
Knowledge search discovery tool.

Provides search_knowledge for the planner to find relevant
patterns, strategies, and examples during discovery.
"""

from __future__ import annotations

import logging
import os

import dspy

from emery_agents.knowledge import KnowledgeBase, KnowledgeDomain, KnowledgeType
from emery_agents.knowledge.cache import (
    get_efs_cache_path,
    load_knowledge_cache,
    load_knowledge_local,
    save_knowledge_local,
)

logger = logging.getLogger(__name__)

# Global instance
_knowledge_base: KnowledgeBase | None = None


def get_knowledge_base() -> KnowledgeBase:
    """Get or initialize the global knowledge base.

    Load order (fastest to slowest):
    1. EFS cache (shared filesystem, persistent across restarts)
    2. S3 cache (remote, slower but always available)
    3. Local path (for development/testing)

    If loaded from S3, we save to EFS to pre-populate for next instances.
    """
    global _knowledge_base

    if _knowledge_base is None:
        efs_path = get_efs_cache_path()

        # 1. Try EFS first (fastest - shared filesystem)
        if os.path.exists(efs_path):
            _knowledge_base = load_knowledge_local(efs_path)

        # 2. Fall back to S3
        if _knowledge_base is None:
            s3_bucket = os.environ.get("S3_BUCKET_NAME")
            if s3_bucket:
                _knowledge_base = load_knowledge_cache(s3_bucket)
                # Pre-populate EFS for next instances
                if _knowledge_base:
                    os.makedirs(os.path.dirname(efs_path), exist_ok=True)
                    save_knowledge_local(efs_path, _knowledge_base)

        # 3. Local fallback (development/testing)
        if _knowledge_base is None:
            local_path = os.environ.get(
                "KNOWLEDGE_BASE_PATH", "./knowledge_base.json.gz"
            )
            if os.path.exists(local_path):
                _knowledge_base = load_knowledge_local(local_path)

        if _knowledge_base is None:
            logger.warning("Knowledge base not available, using empty")
            _knowledge_base = KnowledgeBase()

    return _knowledge_base


def set_knowledge_base(kb: KnowledgeBase) -> None:
    """Set the global knowledge base (for testing or manual loading)."""
    global _knowledge_base
    _knowledge_base = kb


def search_knowledge(
    query: str,
    k: int = 5,
    types: str = "",
    domains: str = "",
    tags: str = "",
) -> str:
    """
    Search knowledge base for patterns, strategies, and examples.

    Args:
        query: What to search for (e.g., "CRM organization structure")
        k: Number of results (default: 5)
        types: Filter by type, comma-separated (pattern, strategy, gotcha)
        domains: Filter by domain, comma-separated (business, data, app, workflow, integration)
        tags: Filter by tags, comma-separated (e.g., "crm,sales")

    Returns:
        Formatted knowledge items as text
    """
    # Parse comma-separated strings into enum lists
    type_list: list[KnowledgeType] | None = None
    if types.strip():
        type_list = [KnowledgeType(t.strip()) for t in types.split(",") if t.strip()]

    domain_list: list[KnowledgeDomain] | None = None
    if domains.strip():
        domain_list = [
            KnowledgeDomain(d.strip()) for d in domains.split(",") if d.strip()
        ]

    tag_list: list[str] | None = None
    if tags.strip():
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    results = get_knowledge_base().search(
        query=query,
        k=k,
        types=type_list,
        domains=domain_list,
        tags=tag_list,
    )

    if not results:
        return "No relevant knowledge found."

    formatted = []
    for item, score in results:
        header = f"**[{item.type.value}|{item.domain.value}] {item.title}** (relevance: {score:.2f})"
        body = item.content

        if item.tags:
            body += f"\n\nTags: {', '.join(item.tags)}"

        if item.examples:
            body += f"\n\n_({len(item.examples)} implementation examples available)_"

        formatted.append(f"{header}\n\n{body}")

    return "\n\n---\n\n".join(formatted)


def create_knowledge_search_tool() -> dspy.Tool:
    """Create search_knowledge discovery tool."""
    return dspy.Tool(
        func=search_knowledge,
        name="search_knowledge",
        desc=(
            "Search knowledge base for patterns, strategies, and implementation examples. "
            "Use when: designing organizations, planning database schemas, understanding best practices. "
            "Returns relevant patterns (blueprints), strategies (how-to guides), or gotchas (common mistakes). "
            "Domains: business (orgs/workflows), data (schemas), app (UI), workflow (automations), integration (external tools)."
        ),
        arg_desc={
            "query": "What to search for (e.g., 'marketing agency organization', 'CRM database design')",
            "k": "Number of results (default: 5)",
            "types": "Filter by type: pattern, strategy, gotcha (comma-separated, optional)",
            "domains": "Filter by domain: business, data, app, workflow, integration (comma-separated, optional)",
            "tags": "Filter by tags (comma-separated, optional, e.g., 'crm,sales')",
        },
    )
