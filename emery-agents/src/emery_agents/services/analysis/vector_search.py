"""
Consolidated vector search infrastructure.

Provides a generic FAISS-backed vector index that auto-scales based on size.
Used by KnowledgeBase and can be adopted by CapabilityRegistry.

Index types selected automatically:
- <50K items: Flat (exact search)
- 50K-500K: IVF (approximate, fast)
- 500K+: HNSW (very fast, more memory)
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Generic, TypeVar

import faiss
import numpy as np

from emery_agents.services.analysis.embeddings import get_embeddings_batch

logger = logging.getLogger(__name__)

T = TypeVar("T")


class VectorIndex(Generic[T]):
    """
    Generic FAISS-backed vector index with automatic scaling.

    Usage:
        index = VectorIndex[MyItem](dimension=768)
        index.build(items, embeddings)
        results = index.search(query_embedding, k=10)
    """

    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self._index: faiss.Index | None = None
        self._items: list[T] = []
        self._embeddings: np.ndarray | None = None

    def build(self, items: list[T], embeddings: list[tuple[float, ...]]) -> None:
        """
        Build FAISS index from items and their embeddings.

        Args:
            items: Items to index (stored for retrieval)
            embeddings: Pre-computed embeddings, same order as items
        """
        if len(items) != len(embeddings):
            raise ValueError(
                f"Items and embeddings must have same length: {len(items)} vs {len(embeddings)}"
            )

        self._items = list(items)

        if not items:
            self._index = None
            self._embeddings = None
            return

        self._embeddings = np.array(embeddings, dtype="float32")

        # Normalize for cosine similarity (inner product on normalized = cosine)
        faiss.normalize_L2(self._embeddings)

        n = len(items)

        if n < 50_000:
            # Exact search - fast enough for small-medium datasets
            logger.info(f"Building Flat index for {n:,} items")
            self._index = faiss.IndexFlatIP(self.dimension)
        elif n < 500_000:
            # IVF approximate search - good balance
            nlist = min(int(np.sqrt(n)), 1000)
            logger.info(f"Building IVF index for {n:,} items with {nlist} clusters")
            quantizer = faiss.IndexFlatIP(self.dimension)
            self._index = faiss.IndexIVFFlat(
                quantizer, self.dimension, nlist, faiss.METRIC_INNER_PRODUCT
            )
            self._index.train(self._embeddings)
            self._index.nprobe = 10  # Search 10 clusters
        else:
            # HNSW for very large scale
            logger.info(f"Building HNSW index for {n:,} items")
            self._index = faiss.IndexHNSWFlat(
                self.dimension, 32, faiss.METRIC_INNER_PRODUCT
            )

        self._index.add(self._embeddings)
        logger.info(
            f"Index built: {n:,} items, {self._embeddings.nbytes / 1024 / 1024:.1f} MB"
        )

    def search(
        self,
        query_embedding: tuple[float, ...],
        k: int = 10,
        filter_fn: Callable[[T], bool] | None = None,
    ) -> list[tuple[T, float]]:
        """
        Search for similar items.

        Args:
            query_embedding: Query vector
            k: Number of results to return
            filter_fn: Optional filter function (applied post-search)

        Returns:
            List of (item, score) tuples, sorted by similarity descending
        """
        if self._index is None or len(self._items) == 0:
            return []

        query = np.array([query_embedding], dtype="float32")
        faiss.normalize_L2(query)

        # Over-fetch if filtering to ensure we get k results
        fetch_k = k * 3 if filter_fn else k
        fetch_k = min(fetch_k, len(self._items))  # Can't fetch more than we have

        scores, indices = self._index.search(query, fetch_k)

        results: list[tuple[T, float]] = []
        for idx, score in zip(indices[0], scores[0]):
            if idx < 0:  # FAISS returns -1 for missing results
                continue
            item = self._items[idx]
            if filter_fn is None or filter_fn(item):
                results.append((item, float(score)))
            if len(results) >= k:
                break

        return results

    def __len__(self) -> int:
        return len(self._items)

    @property
    def memory_mb(self) -> float:
        """Approximate memory usage in MB."""
        if self._embeddings is None:
            return 0.0
        return self._embeddings.nbytes / 1024 / 1024


def create_index_from_texts(
    items: list[T],
    text_fn: Callable[[T], str],
    dimension: int = 768,
) -> VectorIndex[T]:
    """
    Convenience function to create an index by computing embeddings.

    Args:
        items: Items to index
        text_fn: Function to extract searchable text from each item
        dimension: Embedding dimension (default 768 for Gemini)

    Returns:
        Built VectorIndex ready for search
    """
    texts = [text_fn(item) for item in items]
    embeddings = get_embeddings_batch(texts)

    index = VectorIndex[T](dimension=dimension)
    index.build(items, embeddings)

    return index
