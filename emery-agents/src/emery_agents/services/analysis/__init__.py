"""
Analysis Module

Analysis and utility services.

- GapAnalyzer: DSPy-based gap analysis for domain concerns
- TokenUsageExtractor: Extracts and tracks token usage from LLM calls
- Embedding functions for semantic search
"""

from .gap_analyzer import GapAnalyzer, GapAnalyzerModule
from .token_usage import TokenUsageExtractor
from .llm_usage import record_from_lm, get_llm_usage, reset_llm_usage
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
    # LLM usage tracking
    "record_from_lm",
    "get_llm_usage",
    "reset_llm_usage",
    # Embeddings
    "get_embedding",
    "cosine_similarity",
    "clear_cache",
    "get_cache_info",
]
