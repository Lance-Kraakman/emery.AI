"""
Embedding Service - Embeddings for semantic search.

Simple embedding service using HuggingFace's feature extraction.
Used for capability discovery (semantic search across 30K+ capabilities).

AIDEV-NOTE: This uses HuggingFace Inference API which is already configured
in the project, avoiding additional dependencies that could conflict with protobuf.
"""

import logging
import os
from functools import lru_cache
from typing import Optional

from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)

# Embedding model - uses HuggingFace Inference API
# sentence-transformers/all-MiniLM-L6-v2: 384 dimensions, fast, good quality
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Lazy-loaded client
_client: Optional[InferenceClient] = None


def _get_client() -> InferenceClient:
    """Get HuggingFace InferenceClient (lazy initialization)."""
    global _client
    if _client is not None:
        return _client

    token = os.getenv("HF_TOKEN")
    if not token:
        raise ValueError(
            "HF_TOKEN environment variable required for embeddings. "
            "Get your token from https://huggingface.co/settings/tokens"
        )

    _client = InferenceClient(token=token)
    logger.info(f"Embedding service initialized with model: {EMBEDDING_MODEL}")
    return _client


@lru_cache(maxsize=1000)
def get_embedding(text: str) -> tuple[float, ...]:
    """
    Get embedding for text (cached).

    Uses HuggingFace's feature-extraction endpoint which produces
    embeddings optimized for semantic similarity.

    Args:
        text: Text to embed

    Returns:
        Tuple of floats (embedding vector). Tuple for hashability/caching.
    """
    client = _get_client()

    # HuggingFace feature_extraction returns nested array
    result = client.feature_extraction(text=text, model=EMBEDDING_MODEL)

    # Handle different response formats
    if isinstance(result, list):
        if len(result) > 0 and isinstance(result[0], list):
            # Nested: [[0.1, 0.2, ...]]
            embedding = result[0]
        else:
            # Flat: [0.1, 0.2, ...]
            embedding = result
    else:
        embedding = list(result)

    embedding_tuple = tuple(embedding)
    logger.debug(f"Generated embedding: {len(embedding_tuple)} dims for '{text[:50]}...'")
    return embedding_tuple


def cosine_similarity(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """
    Calculate cosine similarity between two embeddings.

    Args:
        a: First embedding vector
        b: Second embedding vector

    Returns:
        Similarity score between -1 and 1 (higher = more similar)
    """
    if len(a) != len(b):
        raise ValueError(f"Embedding dimensions must match: {len(a)} vs {len(b)}")

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot / (norm_a * norm_b))


def clear_cache() -> None:
    """Clear the embedding cache."""
    get_embedding.cache_clear()
    logger.info("Embedding cache cleared")


def get_cache_info() -> dict[str, int | None]:
    """Get embedding cache statistics."""
    info = get_embedding.cache_info()
    return {
        "hits": info.hits,
        "misses": info.misses,
        "size": info.currsize,
        "maxsize": info.maxsize,
    }
