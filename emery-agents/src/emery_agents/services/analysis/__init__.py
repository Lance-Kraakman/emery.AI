"""
Analysis Module

Analysis and utility services.

- GapAnalyzer: DSPy-based gap analysis for domain concerns
- TokenUsageExtractor: Extracts and tracks token usage from LLM calls
- Embedding functions for semantic search
"""

from .gap_analyzer import GapAnalyzer, GapAnalyzerModule
from .token_usage import TokenUsageExtractor
from .embeddings import (
    get_embedding,
    cosine_similarity,
    clear_cache,
    get_cache_info,
)


__all__ = [
    # Gap analyzer
    "GapAnalyzer",
    "GapAnalyzerModule",
    # Token usage
    "TokenUsageExtractor",
    # Embeddings
    "get_embedding",
    "cosine_similarity",
    "clear_cache",
    "get_cache_info",
]
