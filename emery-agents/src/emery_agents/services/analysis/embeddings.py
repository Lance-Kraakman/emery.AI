"""
Embedding Service - Embeddings for semantic search.

Uses Google Gemini embeddings (gemini-embedding-001) as primary provider.
Falls back to HuggingFace Inference API if GEMINI_API_KEY is not set.

Embeddings are cached to disk (content-addressed by text hash) for persistence
across server restarts. Cache location: /mnt/storage/workspaces/.cache/embeddings/

Used for:
- Capability discovery (semantic search across 30K+ capabilities)
- Workspace context filtering (planning node)
- Agent memory (ChromaDB vector storage)
- DSPy retrievers (patterns, knowledge, strategies)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from .embedding_usage import EmbeddingUsageTracker

if TYPE_CHECKING:
    from google.genai.client import Client as GeminiClient
    from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)

# Provider state
_provider: str | None = None
_gemini_client: GeminiClient | None = None
_hf_client: InferenceClient | None = None


# Gemini config
GEMINI_MODEL = "gemini-embedding-001"
GEMINI_DIMENSIONS = 768

# HuggingFace fallback config
HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Disk cache configuration
# Use EFS in production, ~/.cache locally
_efs_path = Path("/mnt/storage/workspaces")
if _efs_path.exists() and _efs_path.is_dir():
    EMBEDDING_CACHE_DIR = _efs_path / ".cache" / "embeddings"
else:
    EMBEDDING_CACHE_DIR = Path.home() / ".cache" / "emery" / "embeddings"


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
            logger.info(
                f"Embedding service initialized with Gemini model: {GEMINI_MODEL}"
            )
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


def _get_cache_path(text: str, model: str) -> Path:
    """Get cache file path for text embedding (content-addressed)."""
    cache_key = hashlib.sha256(text.encode()).hexdigest()[:16]
    return EMBEDDING_CACHE_DIR / model / f"{cache_key}.json"


def _load_from_cache(cache_path: Path) -> tuple[float, ...] | None:
    """Load embedding from disk cache if exists."""
    try:
        if cache_path.exists():
            return tuple(json.loads(cache_path.read_text()))
    except (json.JSONDecodeError, OSError) as e:
        logger.debug(f"Cache read failed for {cache_path}: {e}")
    return None


def _save_to_cache(cache_path: Path, embedding: tuple[float, ...]) -> None:
    """Save embedding to disk cache."""
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(list(embedding)))
    except OSError as e:
        logger.debug(f"Cache write failed for {cache_path}: {e}")


def _embed_gemini(text: str) -> tuple[float, ...]:
    """Get embedding from Gemini API."""
    from google.genai import types

    assert _gemini_client is not None
    result: Any = _gemini_client.models.embed_content(
        model=GEMINI_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=GEMINI_DIMENSIONS),
    )
    if not result or not result.embeddings:
        return ()
    values = result.embeddings[0].values
    return tuple(float(x) for x in values)


def _embed_gemini_batch(texts: list[str]) -> list[tuple[float, ...]]:
    """Embed multiple texts in one synchronous Gemini API call (max 100 per call)."""
    from google.genai import types

    assert _gemini_client is not None
    result: Any = _gemini_client.models.embed_content(
        model=GEMINI_MODEL,
        contents=cast(Any, texts),
        config=types.EmbedContentConfig(output_dimensionality=GEMINI_DIMENSIONS),
    )
    if not result or not result.embeddings:
        return []
    return [tuple(float(x) for x in emb.values) for emb in result.embeddings]


def _embed_huggingface(text: str) -> tuple[float, ...]:
    """Get embedding from HuggingFace Inference API (fallback)."""
    assert _hf_client is not None
    result = _hf_client.feature_extraction(text=text, model=HF_MODEL)

    if isinstance(result, list):
        if len(result) > 0 and isinstance(result[0], list):
            embedding = result[0]
        else:
            embedding = result
    else:
        embedding = list(result)

    return tuple(float(x) for x in embedding)


def get_embedding(
    text: str, tracker: EmbeddingUsageTracker | None = None
) -> tuple[float, ...]:
    """
    Get embedding for text (disk cached).

    Uses Gemini (preferred) or HuggingFace (fallback) for embeddings
    optimized for semantic similarity.

    Embeddings are cached to disk by content hash. Cache hits don't call the API
    or track usage. Only actual API calls are billed.

    Args:
        text: Text to embed
        tracker: Optional explicit tracker instance.

    Returns:
        Tuple of floats (embedding vector). Tuple for hashability.
    """
    provider = _init_provider()
    model = GEMINI_MODEL if provider == "gemini" else HF_MODEL
    cache_path = _get_cache_path(text, model)

    # Check disk cache
    cached = _load_from_cache(cache_path)
    if cached is not None:
        return cached

    # Compute embedding (cache miss)
    if provider == "gemini":
        embedding = _embed_gemini(text)
    else:
        embedding = _embed_huggingface(text)

    # Track usage (only on cache miss = actual API call)
    if tracker:
        tracker.record(text, model)

    # Save to disk cache
    _save_to_cache(cache_path, embedding)

    logger.debug(
        f"Generated embedding: {len(embedding)} dims for '{text[:50]}...' (provider={provider})"
    )
    return embedding


def get_embeddings_batch(
    texts: list[str],
    tracker: EmbeddingUsageTracker | None = None,
    batch_size: int = 100,
) -> list[tuple[float, ...]]:
    """Compute embeddings for multiple texts with disk caching.

    Checks disk cache first for each text. Only computes embeddings for
    texts not in cache, then saves new embeddings to disk.

    Uses Gemini multi-text embed_content (synchronous, up to 100 per call)
    or HuggingFace fallback (sequential per text).

    Args:
        texts: List of texts to embed
        tracker: Optional explicit tracker instance.
        batch_size: Max texts per API call (default 100, Gemini limit)

    Returns:
        List of embedding tuples, same order as input texts
    """
    import time as _time

    if not texts:
        return []

    provider = _init_provider()
    model = GEMINI_MODEL if provider == "gemini" else HF_MODEL

    # Check cache for each text
    results: list[tuple[float, ...]] = []
    uncached_texts: list[str] = []
    uncached_indices: list[int] = []

    for i, text in enumerate(texts):
        cache_path = _get_cache_path(text, model)
        cached = _load_from_cache(cache_path)
        if cached is not None:
            results.append(cached)
        else:
            results.append(())  # Placeholder
            uncached_texts.append(text)
            uncached_indices.append(i)

    # If all cached, return immediately
    if not uncached_texts:
        logger.info(f"All {len(texts)} embeddings loaded from disk cache")
        return results

    # Batch compute uncached texts
    total_uncached = len(uncached_texts)
    num_batches = (total_uncached - 1) // batch_size + 1
    computed: list[tuple[float, ...]] = []
    start = _time.monotonic()

    for batch_idx, i in enumerate(range(0, total_uncached, batch_size), 1):
        chunk = uncached_texts[i : i + batch_size]
        if provider == "gemini":
            batch_embeddings = _embed_gemini_batch(chunk)
            computed.extend(batch_embeddings)
        else:
            batch_embeddings = [_embed_huggingface(t) for t in chunk]
            computed.extend(batch_embeddings)

        # Track usage for this batch
        if tracker:
            for text in chunk:
                tracker.record(text, model)

        elapsed = _time.monotonic() - start
        logger.info(
            f"Embedding progress: {len(computed)}/{total_uncached} texts "
            f"(batch {batch_idx}/{num_batches}, {elapsed:.1f}s elapsed)"
        )

    # Fill in results and save to cache
    for idx, text, emb in zip(uncached_indices, uncached_texts, computed, strict=True):
        results[idx] = emb
        cache_path = _get_cache_path(text, model)
        _save_to_cache(cache_path, emb)

    elapsed = _time.monotonic() - start
    cache_hits = len(texts) - total_uncached
    logger.info(
        f"Batch embedded {total_uncached} texts in {num_batches} API calls, "
        f"{elapsed:.1f}s (provider={provider}, cache_hits={cache_hits})"
    )
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
    """Clear the embedding disk cache."""
    import shutil

    if EMBEDDING_CACHE_DIR.exists():
        shutil.rmtree(EMBEDDING_CACHE_DIR)
        logger.info(f"Embedding cache cleared: {EMBEDDING_CACHE_DIR}")
    else:
        logger.info("Embedding cache already empty")


def get_cache_info() -> dict[str, Any]:
    """Get embedding cache statistics."""
    if not EMBEDDING_CACHE_DIR.exists():
        return {"path": str(EMBEDDING_CACHE_DIR), "files": 0, "size_mb": 0.0}

    total_files = 0
    total_size = 0
    for model_dir in EMBEDDING_CACHE_DIR.iterdir():
        if model_dir.is_dir():
            for f in model_dir.iterdir():
                if f.is_file():
                    total_files += 1
                    total_size += f.stat().st_size

    return {
        "path": str(EMBEDDING_CACHE_DIR),
        "files": total_files,
        "size_mb": round(total_size / (1024 * 1024), 2),
    }


def create_dspy_embedder() -> Any:
    """Create DSPy-compatible Embedder using disk-cached embeddings.

    Used for KNNFewShot to dynamically select demos based on semantic similarity.
    Wraps get_embeddings_batch() which uses disk cache.

    Returns:
        dspy.Embedder instance for use with KNNFewShot
    """
    from dspy import Embedder  # type: ignore[import-untyped]

    def embed_fn(texts: list[str]) -> list[list[float]]:
        """Batch embedding wrapper for DSPy compatibility."""
        embeddings = get_embeddings_batch(texts)
        return [list(emb) for emb in embeddings]

    return Embedder(embed_fn)
