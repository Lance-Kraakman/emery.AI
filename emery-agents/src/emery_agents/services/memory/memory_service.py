"""
Memory Service — ChromaDB-backed persistent semantic memory.

Stores memories in the workspace filesystem under .agent/memory/chroma/.
Syncs to S3 naturally via workspace tar.gz uploads.

Path resolution uses ID-based validation (same pattern as BwrapExecutor)
to prevent path traversal. Never accepts raw filesystem paths.

PII is stripped from agent memories (shared) via PIIFilter.
User memories are stored as-is (private).

Embeddings use the HuggingFace Inference API (same model as the analysis
embedding service) — no local PyTorch / sentence-transformers needed.
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

from ..analysis.embeddings import get_embedding
from .pii_filter import PIIFilter

logger = logging.getLogger(__name__)

# Memory types for categorization
MEMORY_TYPES = ("general", "preference", "fact", "procedure")


class HFAPIEmbeddingFunction(EmbeddingFunction[Documents]):
    """ChromaDB embedding function backed by HuggingFace Inference API.

    Wraps the existing get_embedding() from services.analysis.embeddings
    so ChromaDB can use the same HF API embedder used elsewhere in the codebase.
    No local PyTorch or sentence-transformers required.
    """

    def __call__(self, input: Documents) -> Embeddings:
        return [list(get_embedding(doc)) for doc in input]  # type: ignore[misc]


class MemoryService:
    """Persistent semantic memory backed by ChromaDB.

    Scoping:
        - Agent workspaces: memories are shared across all users of that agent.
          PII is stripped before storage.
        - User workspaces: memories are private to that user. No PII redaction.

    Storage:
        ChromaDB PersistentClient writes to .agent/memory/chroma/ inside the
        workspace directory. Files persist across sessions via S3 tar.gz sync.
    """

    def __init__(
        self,
        workspace_type: str,
        workspace_id: str,
        base_path: Path,
    ):
        """
        Initialize MemoryService with ID-based path resolution.

        Args:
            workspace_type: "agents" or "users"
            workspace_id: Agent ID or user ID (validated for path safety)
            base_path: Base workspace directory (e.g., /tmp/workspace)
        """
        self._workspace_type = workspace_type
        self._workspace_id = self._validate_id(workspace_id)
        self._chroma_path = base_path / self._workspace_id / ".agent" / "memory" / "chroma"

        # PII filter only for shared agent memories
        self._pii_filter: Optional[PIIFilter] = None
        if workspace_type == "agents":
            try:
                self._pii_filter = PIIFilter()
            except Exception as e:
                logger.warning(f"Failed to initialize PIIFilter, agent memories will not be PII-filtered: {e}")

        # Ensure directory exists with write permissions
        # (tar.gz roundtrip can leave restrictive permissions from bwrap)
        # Must chmod parent directories too — ChromaDB needs write access for temp/lock files

        # Fix workspace root permissions FIRST (parent of all subdirs)
        # If workspace root is readonly, subdirs can't be created/written
        # Use 0o700 (owner-only) for security - no group/others access needed
        workspace_root = base_path / self._workspace_id
        if workspace_root.exists():
            try:
                workspace_root.chmod(0o700)
            except PermissionError:
                logger.warning(f"Cannot fix permissions on workspace root {workspace_root}")

        self._chroma_path.mkdir(parents=True, exist_ok=True)

        # Fix entire .agent/memory/chroma tree
        # Use 0o700 for security - only owner needs access
        agent_dir = self._chroma_path.parent.parent  # .agent
        if agent_dir.exists():
            try:
                agent_dir.chmod(0o700)
            except PermissionError:
                logger.warning(f"Cannot fix permissions on {agent_dir}")
        memory_dir = self._chroma_path.parent  # .agent/memory
        if memory_dir.exists():
            try:
                memory_dir.chmod(0o700)
            except PermissionError:
                logger.warning(f"Cannot fix permissions on {memory_dir}")
        try:
            self._chroma_path.chmod(0o700)
        except PermissionError:
            logger.warning(f"Cannot fix permissions on {self._chroma_path}")

        # ChromaDB PersistentClient
        self._client = chromadb.PersistentClient(path=str(self._chroma_path))
        self._embedding_fn = HFAPIEmbeddingFunction()
        try:
            self._collection = self._client.get_or_create_collection(
                name="memories",
                embedding_function=self._embedding_fn,  # type: ignore[arg-type]
            )
        except Exception:
            # Collection was created with a different embedding function
            # (e.g., sentence_transformer → HF API migration). Delete and recreate.
            logger.warning("Embedding function conflict — recreating memories collection")
            self._client.delete_collection("memories")
            self._collection = self._client.get_or_create_collection(
                name="memories",
                embedding_function=self._embedding_fn,  # type: ignore[arg-type]
            )

        logger.info(
            f"MemoryService initialized: type={workspace_type}, id={workspace_id}, "
            f"path={self._chroma_path}, pii_filter={'enabled' if self._pii_filter else 'disabled'}, "
            f"existing_memories={self._collection.count()}"
        )

    @staticmethod
    def _validate_id(workspace_id: str) -> str:
        """Validate workspace ID for path safety.

        Same validation pattern as BwrapExecutor._validate_workspace_id().

        Args:
            workspace_id: ID to validate.

        Returns:
            The validated ID string.

        Raises:
            ValueError: If the ID contains dangerous characters.
        """
        if not workspace_id:
            raise ValueError("workspace_id cannot be empty")
        if ".." in workspace_id:
            raise ValueError("Invalid workspace_id: contains path traversal '..'")
        if "/" in workspace_id or "\\" in workspace_id:
            raise ValueError("Invalid workspace_id: contains path separator")
        if len(workspace_id) > 255:
            raise ValueError("workspace_id exceeds maximum length of 255")
        if not re.match(r"^[a-zA-Z0-9_-]+$", workspace_id):
            raise ValueError(
                "Invalid workspace_id: must contain only alphanumeric, dash, underscore"
            )
        return workspace_id

    def add(
        self,
        content: str,
        memory_type: str = "general",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Store a new memory.

        PII is stripped from content if this is an agent workspace.

        Args:
            content: The memory content to store.
            memory_type: Category — general, preference, fact, or procedure.
            metadata: Additional metadata to store with the memory.

        Returns:
            The generated memory ID.
        """
        if not content:
            raise ValueError("Memory content cannot be empty")

        if memory_type not in MEMORY_TYPES:
            logger.warning(f"Unknown memory_type '{memory_type}', defaulting to 'general'")
            memory_type = "general"

        # Strip PII for agent memories
        stored_content = content
        if self._pii_filter:
            stored_content = self._pii_filter.redact(content)
            if stored_content != content:
                logger.debug("PII redacted from memory content")

        memory_id = str(uuid.uuid4())
        meta = {
            "memory_type": memory_type,
            "workspace_type": self._workspace_type,
            "workspace_id": self._workspace_id,
            **(metadata or {}),
        }

        # ChromaDB metadata values must be str, int, float, or bool
        sanitized_meta = {
            k: v for k, v in meta.items()
            if isinstance(v, (str, int, float, bool))
        }

        self._collection.add(
            ids=[memory_id],
            documents=[stored_content],
            metadatas=[sanitized_meta],
        )

        logger.info(f"Stored memory {memory_id} (type={memory_type})")
        return memory_id

    def search(
        self,
        query: str,
        n_results: int = 5,
        memory_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search memories by semantic similarity.

        Args:
            query: Search query text.
            n_results: Maximum number of results to return.
            memory_type: Filter by memory type (optional).

        Returns:
            List of memory dicts with id, content, metadata, and distance.
        """
        if not query:
            return []

        where_filter: Optional[Dict[str, str]] = None
        if memory_type:
            where_filter = {"memory_type": memory_type}

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, self._collection.count() or 1),
                where=where_filter,  # type: ignore[arg-type]
            )
        except Exception as e:
            logger.warning(f"Memory search failed: {e}")
            return []

        memories = []
        if results and results["ids"] and results["ids"][0]:
            for i, memory_id in enumerate(results["ids"][0]):
                memories.append({
                    "id": memory_id,
                    "content": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                })

        return memories

    def get_all(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all memories (up to limit).

        Args:
            limit: Maximum number of memories to return.

        Returns:
            List of memory dicts with id, content, and metadata.
        """
        try:
            count = self._collection.count()
            if count == 0:
                return []

            results = self._collection.get(
                limit=min(limit, count),
            )
        except Exception as e:
            logger.warning(f"Failed to get all memories: {e}")
            return []

        memories = []
        if results and results["ids"]:
            for i, memory_id in enumerate(results["ids"]):
                memories.append({
                    "id": memory_id,
                    "content": results["documents"][i] if results["documents"] else "",
                    "metadata": results["metadatas"][i] if results["metadatas"] else {},
                })

        return memories

    def delete(self, memory_id: str) -> bool:
        """Delete a memory by ID.

        Args:
            memory_id: The memory ID to delete.

        Returns:
            True if deleted, False if not found or error.
        """
        try:
            self._collection.delete(ids=[memory_id])
            logger.info(f"Deleted memory {memory_id}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete memory {memory_id}: {e}")
            return False

    # Max L2 distance for a memory to be considered relevant.
    # L2 = 1.0 corresponds to ~50% cosine similarity with normalized embeddings.
    _RELEVANCE_DISTANCE_THRESHOLD = 1.0

    def get_context_summary(
        self,
        task: str,
        n_results: int = 3,
    ) -> str:
        """Get relevant memories formatted for prompt injection.

        Searches for memories relevant to the given task and formats them
        as a context string. Memories with L2 distance above the threshold
        are filtered out to avoid injecting irrelevant context.

        Args:
            task: The current task/goal to find relevant memories for.
            n_results: Number of memories to include.

        Returns:
            Formatted context string, or empty string if no relevant memories.
        """
        if self._collection.count() == 0:
            return ""

        memories = self.search(query=task, n_results=n_results)
        if not memories:
            return ""

        # Filter by relevance — skip memories that aren't meaningfully similar
        memories = [
            m for m in memories
            if m.get("distance") is not None
            and m["distance"] <= self._RELEVANCE_DISTANCE_THRESHOLD
        ]
        if not memories:
            return ""

        parts = []
        for mem in memories:
            mem_type = mem.get("metadata", {}).get("memory_type", "general")
            parts.append(f"- [{mem_type}] {mem['content']}")

        return "\n".join(parts)
