"""
Analysis and utility services.

- Token accumulator for request-scoped usage tracking.
- Gap analyzer for identifying missing capabilities.
- Embedding functions for semantic search.
"""

from .token_accumulator import TokenAccumulator
from .gap_analyzer import GapAnalyzer, GapAnalyzerModule
from .token_usage import TokenUsageExtractor
from .llm_usage import LlmUsageTracker, record_from_lm
from .embedding_usage import EmbeddingUsageTracker
from .embeddings import (
    get_embedding,
    get_embeddings_batch,
    cosine_similarity,
    clear_cache,
    get_cache_info,
)

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
    "cosine_similarity",
    "clear_cache",
    "get_cache_info",
]
