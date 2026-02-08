"""
S3 cache for KnowledgeBase.

Follows same pattern as services/analysis/embedding_cache.py:
- gzip JSON storage
- Content hash for invalidation
- Load at startup, save after ingestion
"""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import boto3
import dspy
from botocore.exceptions import ClientError

from .base import KnowledgeBase, KnowledgeDomain, KnowledgeItem, KnowledgeType

logger = logging.getLogger(__name__)

S3_CACHE_KEY = "cache/knowledge_base.json.gz"


def _serialize_example(ex: dspy.Example) -> dict[str, Any]:
    """Serialize a DSPy Example to dict."""
    return {
        "inputs": dict(ex.inputs()),
        "labels": dict(ex.labels()),
    }


def _deserialize_example(data: dict[str, Any]) -> dspy.Example:
    """Deserialize a DSPy Example from dict."""
    ex = dspy.Example(**data["inputs"], **data["labels"])
    return ex.with_inputs(*data["inputs"].keys())


def _serialize_item(item: KnowledgeItem) -> dict[str, Any]:
    """Serialize KnowledgeItem to JSON-compatible dict."""
    return {
        "id": item.id,
        "type": item.type.value,  # StrEnum → string
        "domain": item.domain.value,  # StrEnum → string
        "title": item.title,
        "content": item.content,
        "tags": item.tags,
        "examples": [_serialize_example(ex) for ex in item.examples],
        "metadata": item.metadata,
        "embedding": list(item.embedding) if item.embedding else None,
    }


def _deserialize_item(data: dict[str, Any]) -> KnowledgeItem:
    """Deserialize KnowledgeItem from dict."""
    examples = [_deserialize_example(ex_data) for ex_data in data.get("examples", [])]

    return KnowledgeItem(
        id=data["id"],
        type=KnowledgeType(data["type"]),  # string → enum
        domain=KnowledgeDomain(data["domain"]),  # string → enum
        title=data["title"],
        content=data["content"],
        tags=data.get("tags", []),
        examples=examples,
        metadata=data.get("metadata", {}),
        embedding=tuple(data["embedding"]) if data.get("embedding") else None,
    )


def compute_content_hash(items: list[KnowledgeItem]) -> str:
    """Compute hash of knowledge content for cache invalidation."""
    entries = sorted(f"{i.id}:{i.title}:{len(i.content)}" for i in items)
    content = "\n".join(entries)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def load_knowledge_cache(s3_bucket: str) -> KnowledgeBase | None:
    """
    Load KnowledgeBase from S3 cache.

    Returns None if cache doesn't exist or is corrupted.
    """
    try:
        s3 = boto3.client("s3")

        with tempfile.NamedTemporaryFile(suffix=".json.gz") as tmp:
            s3.download_file(s3_bucket, S3_CACHE_KEY, tmp.name)

            with gzip.open(tmp.name, "rt", encoding="utf-8") as f:
                data = json.load(f)

        items = [_deserialize_item(d) for d in data["items"]]

        kb = KnowledgeBase()
        kb.add(items, build_index=True)

        logger.info(
            f"Loaded knowledge cache: {kb.count()} items, "
            f"hash={data.get('content_hash', 'unknown')}"
        )

        return kb

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchKey"):
            logger.info("Knowledge cache not found in S3")
        else:
            logger.warning(f"Error loading knowledge cache: {e}")
        return None
    except Exception as e:
        logger.warning(f"Error loading knowledge cache: {e}")
        return None


def save_knowledge_cache(s3_bucket: str, kb: KnowledgeBase) -> bool:
    """
    Save KnowledgeBase to S3 cache.

    Returns True on success.
    """
    try:
        items = list(kb.items.values())

        data = {
            "version": 1,
            "content_hash": compute_content_hash(items),
            "count": len(items),
            "items": [_serialize_item(item) for item in items],
        }

        with tempfile.NamedTemporaryFile(suffix=".json.gz", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with gzip.open(tmp.name, "wt", encoding="utf-8") as f:
                json.dump(data, f)

            s3 = boto3.client("s3")
            s3.upload_file(str(tmp_path), s3_bucket, S3_CACHE_KEY)
            tmp_path.unlink(missing_ok=True)

        logger.info(
            f"Saved knowledge cache: {len(items)} items to s3://{s3_bucket}/{S3_CACHE_KEY}"
        )
        return True

    except Exception as e:
        logger.error(f"Error saving knowledge cache: {e}")
        return False


def save_knowledge_local(path: str, kb: KnowledgeBase) -> bool:
    """
    Save KnowledgeBase to local gzip file.

    Useful for testing or when S3 is not available.
    """
    try:
        items = list(kb.items.values())

        data = {
            "version": 1,
            "content_hash": compute_content_hash(items),
            "count": len(items),
            "items": [_serialize_item(item) for item in items],
        }

        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(data, f)

        logger.info(f"Saved knowledge cache locally: {len(items)} items to {path}")
        return True

    except Exception as e:
        logger.error(f"Error saving knowledge cache locally: {e}")
        return False


def load_knowledge_local(path: str) -> KnowledgeBase | None:
    """
    Load KnowledgeBase from local gzip file.

    Useful for testing or when S3 is not available.
    """
    try:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            data = json.load(f)

        items = [_deserialize_item(d) for d in data["items"]]

        kb = KnowledgeBase()
        kb.add(items, build_index=True)

        logger.info(f"Loaded knowledge cache locally: {kb.count()} items from {path}")
        return kb

    except Exception as e:
        logger.warning(f"Error loading knowledge cache locally: {e}")
        return None


# ---------------------------------------------------------------------------
# EFS Cache Path
# ---------------------------------------------------------------------------

def get_efs_cache_path() -> str:
    """Get the EFS knowledge cache path."""
    base = os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces")
    return os.path.join(base, "cache", "knowledge_base.json.gz")
