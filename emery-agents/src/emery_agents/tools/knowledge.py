"""
Knowledge base singleton accessor.

Provides get/set_knowledge_base for accessing the global KnowledgeBase.
Semantic search is handled by KnowledgeRetriever in reasoning/modules/retrievers.py.
"""

from __future__ import annotations

import logging
import os

from emery_agents.knowledge import KnowledgeBase
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
