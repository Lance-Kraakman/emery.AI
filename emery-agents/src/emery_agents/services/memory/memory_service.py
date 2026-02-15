"""mem0-backed persistent semantic memory with PII filtering."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from mem0.configs.base import EmbedderConfig, LlmConfig, MemoryConfig, VectorStoreConfig
from mem0.configs.vector_stores.chroma import ChromaDbConfig
from mem0.memory.main import Memory

from . import mem0_providers  # noqa: F401
from .pii_filter import get_pii_filter

logger = logging.getLogger(__name__)

MEMORY_TYPES = frozenset({"general", "preference", "fact", "procedure"})


class MemoryService:
    def __init__(self, workspace_type: str, workspace_id: str, base_path: Path):
        self._workspace_type = workspace_type
        self._workspace_id = workspace_id
        self._pii_filter = get_pii_filter() if workspace_type == "agents" else None

        storage_path = base_path / workspace_id / ".engine" / "memory"
        storage_path.mkdir(parents=True, exist_ok=True)

        config = MemoryConfig.model_construct(
            llm=LlmConfig.model_construct(provider="tracked", config={}),
            embedder=EmbedderConfig.model_construct(provider="tracked", config={}),
            vector_store=VectorStoreConfig.model_construct(
                provider="chroma",
                config=ChromaDbConfig(path=str(storage_path / "chroma")),  # type: ignore[call-arg]
            ),
        )
        self._memory = Memory(config)

    def add(
        self,
        content: str,
        memory_type: str = "general",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        if memory_type not in MEMORY_TYPES:
            raise ValueError(f"Invalid memory_type: {memory_type}")

        stored = self._pii_filter.redact(content) if self._pii_filter else content
        result = self._memory.add(
            stored,
            user_id=self._workspace_id,
            metadata={"memory_type": memory_type, "workspace_type": self._workspace_type, **(metadata or {})},
            infer=False,
        )
        if not result or not result.get("results"):
            raise RuntimeError(f"Failed to store memory: {content[:50]}")
        return result["results"][0]["id"]  # type: ignore[return-value]

    def search(
        self,
        query: str,
        n_results: int = 5,
        memory_type: str | None = None,
    ) -> list[dict[str, Any]]:
        if not query:
            return []

        results = self._memory.search(query, user_id=self._workspace_id, limit=n_results)
        return [
            {"id": r["id"], "content": r["memory"], "metadata": r.get("metadata") or {}}
            for r in results.get("results", [])  # type: ignore[union-attr]
            if not memory_type or (r.get("metadata") or {}).get("memory_type") == memory_type
        ]

    def get_all(self, limit: int = 50) -> list[dict[str, Any]]:
        results = self._memory.get_all(user_id=self._workspace_id)
        return [
            {"id": r["id"], "content": r["memory"], "metadata": r.get("metadata") or {}}
            for r in results.get("results", [])[:limit]  # type: ignore[union-attr]
        ]

    def delete(self, memory_id: str) -> None:
        self._memory.delete(memory_id)

    def get_context_summary(self, task: str, n_results: int = 3) -> str:
        memories = self.search(query=task, n_results=n_results)
        if not memories:
            return ""
        return "\n".join(
            f"- [{m['metadata'].get('memory_type', 'general')}] {m['content']}"
            for m in memories
        )
