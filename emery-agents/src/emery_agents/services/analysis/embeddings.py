"""
Embedding Service - Embeddings for semantic search.

Uses Google Gemini embeddings (gemini-embedding-001) as primary provider.
Falls back to HuggingFace Inference API if GEMINI_API_KEY is not set.

Used for:
- Capability discovery (semantic search across 30K+ capabilities)
- Workspace context filtering (planning node)
- Agent memory (ChromaDB vector storage)
"""

import logging
import os
from functools import lru_cache
from typing import Optional

from .embedding_usage import get_embedding_tracker

logger = logging.getLogger(__name__)

# Provider state
_provider: Optional[str] = None
_gemini_client = None
_hf_client = None

# Gemini config
GEMINI_MODEL = "gemini-embedding-001"
GEMINI_DIMENSIONS = 768

# HuggingFace fallback config
HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _init_provider() -> str:
    """Initialize the embedding provider. Prefers Gemini, falls back to HF."""
    global _provider, _gemini_client, _hf_client

    if _provider is not None:
        return _provider

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=gemini_key)
            _provider = "gemini"
            logger.info(f"Embedding service initialized with Gemini model: {GEMINI_MODEL}")
            return _provider
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini embeddings: {e}")

    # Fallback to HuggingFace
    hf_token = os.getenv("HF_TOKEN")
    if hf_token:
        from huggingface_hub import InferenceClient
        _hf_client = InferenceClient(token=hf_token)
        _provider = "huggingface"
        logger.info(f"Embedding service initialized with HuggingFace model: {HF_MODEL}")
        return _provider

    raise ValueError(
        "No embedding provider available. "
        "Set GEMINI_API_KEY (preferred) or HF_TOKEN environment variable."
    )


def _embed_gemini(text: str) -> tuple[float, ...]:
    """Get embedding from Gemini API."""
    from google.genai import types

    result = _gemini_client.models.embed_content(
        model=GEMINI_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=GEMINI_DIMENSIONS),
    )
    values = result.embeddings[0].values
    return tuple(float(x) for x in values)


def _embed_gemini_batch(texts: list[str]) -> list[tuple[float, ...]]:
    """Embed multiple texts in one synchronous Gemini API call (max 100 per call)."""
    from google.genai import types

    result = _gemini_client.models.embed_content(
        model=GEMINI_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=GEMINI_DIMENSIONS),
    )
    return [tuple(float(x) for x in emb.values) for emb in result.embeddings]


def _embed_huggingface(text: str) -> tuple[float, ...]:
    """Get embedding from HuggingFace Inference API (fallback)."""
    result = _hf_client.feature_extraction(text=text, model=HF_MODEL)

    if isinstance(result, list):
        if len(result) > 0 and isinstance(result[0], list):
            embedding = result[0]
        else:
            embedding = result
    else:
        embedding = list(result)

    return tuple(float(x) for x in embedding)


@lru_cache(maxsize=5000)
def get_embedding(text: str) -> tuple[float, ...]:
    """
    Get embedding for text (cached).

    Uses Gemini (preferred) or HuggingFace (fallback) for embeddings
    optimized for semantic similarity.

    Note: The @lru_cache decorator means repeated identical texts will NOT
    call the API or the tracker again. Only actual API calls are billed.

    Args:
        text: Text to embed

    Returns:
        Tuple of floats (embedding vector). Tuple for hashability/caching.
    """
    provider = _init_provider()
    tracker = get_embedding_tracker()

    if provider == "gemini":
        embedding = _embed_gemini(text)
        tracker.record(text, GEMINI_MODEL)
    else:
        embedding = _embed_huggingface(text)
        tracker.record(text, HF_MODEL)

    logger.debug(f"Generated embedding: {len(embedding)} dims for '{text[:50]}...' (provider={provider})")
    return embedding


def get_embeddings_batch(texts: list[str], batch_size: int = 100) -> list[tuple[float, ...]]:
    """Compute embeddings for multiple texts, chunked for API limits.

    Uses Gemini multi-text embed_content (synchronous, up to 100 per call)
    or HuggingFace fallback (sequential per text).

    Args:
        texts: List of texts to embed
        batch_size: Max texts per API call (default 100, Gemini limit)

    Returns:
        List of embedding tuples, same order as input texts
    """
    import time as _time

    provider = _init_provider()
    total = len(texts)
    num_batches = (total - 1) // batch_size + 1 if total else 0
    results: list[tuple[float, ...]] = []
    start = _time.monotonic()

    for batch_idx, i in enumerate(range(0, total, batch_size), 1):
        chunk = texts[i:i + batch_size]
        if provider == "gemini":
            results.extend(_embed_gemini_batch(chunk))
        else:
            results.extend(_embed_huggingface(t) for t in chunk)

        elapsed = _time.monotonic() - start
        logger.info(
            f"Embedding progress: {len(results)}/{total} texts "
            f"(batch {batch_idx}/{num_batches}, {elapsed:.1f}s elapsed)"
        )

    elapsed = _time.monotonic() - start
    logger.info(f"Batch embedded {total} texts in {num_batches} API calls, {elapsed:.1f}s (provider={provider})")
    return results


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
