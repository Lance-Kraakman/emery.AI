"""
Analysis and utility services.

- Token accumulator for request-scoped usage tracking.
- Gap analyzer for identifying missing capabilities.
- Embedding functions for semantic search.
"""

from .embedding_usage import EmbeddingUsageTracker
from .embeddings import (
    clear_cache,
    get_cache_info,
    get_embedding,
    get_embeddings_batch,
)
from .gap_analyzer import GapAnalyzer, GapAnalyzerModule
from .llm_usage import LlmUsageTracker, record_from_lm
from .token_accumulator import TokenAccumulator
from .token_usage import TokenUsageExtractor

__all__ = [
    # Token usage
    "TokenAccumulator",
    "LlmUsageTracker",
    "EmbeddingUsageTracker",
    "TokenUsageExtractor",
    "record_from_lm",
    # Gap analyzer
    "GapAnalyzer",
    "GapAnalyzerModule",
    # Embeddings
    "get_embedding",
    "get_embeddings_batch",
    "clear_cache",
    "get_cache_info",
]
