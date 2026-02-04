"""
S3 Embedding Cache — Persist pre-computed embeddings to avoid startup API calls.

Static integration embeddings (~3K services) are cached as gzip JSON in S3.
A content hash ensures the cache is invalidated when metadata or model changes.

On normal startup: download from S3, verify hash, load into registry (~1-2s).
On cache miss: compute via batch API (~6s), upload to S3 for next startup.
"""

import gzip
import hashlib
import json
import logging
import tempfile
from pathlib import Path
from typing import TypedDict

import boto3
from botocore.exceptions import ClientError

from emery_agents.entities.models.capability import Capability


class _EmbeddingCacheData(TypedDict):
    """Structure of the S3 embedding cache file."""
    model: str
    dimensions: int
    content_hash: str
    count: int
    embeddings: dict[str, list[float]]

logger = logging.getLogger(__name__)

S3_CACHE_KEY = "cache/integration_embeddings.json.gz"

# Must match the model used in embeddings.py
_EMBEDDING_MODEL = "gemini-embedding-001"
_EMBEDDING_DIMENSIONS = 768


def _capability_text(cap: Capability) -> str:
    """Build searchable text from capability metadata (mirrors CapabilityRegistry._capability_text)."""
    return f"{cap.name} {cap.description} {' '.join(cap.actions)} {' '.join(cap.entities)}"


def compute_content_hash(capabilities: list[Capability]) -> str:
    """SHA256 of sorted capability texts + model name.

    Invalidates cache when:
    - unified_metadata.json changes (different capability texts)
    - Embedding model changes (different model name)
    """
    entries = sorted(f"{c.id}:{_capability_text(c)}" for c in capabilities)
    content = f"model={_EMBEDDING_MODEL}\n" + "\n".join(entries)
    return hashlib.sha256(content.encode()).hexdigest()


def load_embedding_cache(
    s3_bucket: str,
    capabilities: list[Capability],
) -> dict[str, tuple[float, ...]] | None:
    """Download embedding cache from S3 and verify content hash.

    Returns:
        Dict mapping capability IDs to embedding tuples, or None on miss/mismatch.
    """
    expected_hash = compute_content_hash(capabilities)

    try:
        s3 = boto3.client("s3")
        with tempfile.NamedTemporaryFile(suffix=".json.gz") as tmp:
            s3.download_file(s3_bucket, S3_CACHE_KEY, tmp.name)

            with gzip.open(tmp.name, "rt", encoding="utf-8") as f:
                data: _EmbeddingCacheData = json.load(f)

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchKey"):
            logger.info("Embedding cache not found in S3 — will compute")
        else:
            logger.warning(f"S3 embedding cache download failed: {e}")
        return None
    except Exception as e:
        logger.warning(f"Failed to load embedding cache: {e}")
        return None

    # Verify content hash
    stored_hash: str = data.get("content_hash", "")
    if stored_hash != expected_hash:
        logger.info(
            f"Embedding cache hash mismatch (stored={stored_hash[:12]}... "
            f"expected={expected_hash[:12]}...) — will recompute"
        )
        return None

    # Convert JSON lists back to tuples
    raw_embeddings: dict[str, list[float]] = data.get("embeddings", {})
    embeddings = {cap_id: tuple(vec) for cap_id, vec in raw_embeddings.items()}

    logger.info(f"Loaded {len(embeddings)} embeddings from S3 cache (hash={expected_hash[:12]}...)")
    return embeddings


def save_embedding_cache(
    s3_bucket: str,
    capabilities: list[Capability],
    embeddings: dict[str, tuple[float, ...]],
) -> bool:
    """Upload embedding cache to S3 as gzip JSON.

    Returns:
        True if upload succeeded, False otherwise.
    """
    content_hash = compute_content_hash(capabilities)

    data: _EmbeddingCacheData = {
        "model": _EMBEDDING_MODEL,
        "dimensions": _EMBEDDING_DIMENSIONS,
        "content_hash": content_hash,
        "count": len(embeddings),
        "embeddings": {cap_id: list(vec) for cap_id, vec in embeddings.items()},
    }

    try:
        json_bytes = json.dumps(data).encode("utf-8")
        with tempfile.NamedTemporaryFile(suffix=".json.gz", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with gzip.open(tmp.name, "wb") as f:
                f.write(json_bytes)

        s3 = boto3.client("s3")
        s3.upload_file(str(tmp_path), s3_bucket, S3_CACHE_KEY)
        tmp_path.unlink(missing_ok=True)

        logger.info(
            f"Saved {len(embeddings)} embeddings to S3 cache "
            f"(hash={content_hash[:12]}..., key={S3_CACHE_KEY})"
        )
        return True

    except Exception as e:
        logger.warning(f"Failed to save embedding cache to S3: {e}")
        return False
