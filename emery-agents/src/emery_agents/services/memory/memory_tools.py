"""
Memory CRUD Tool — DSPy tool factory for memory operations.

Same closure pattern as create_database_crud, create_table_crud, etc.
The factory captures a MemoryService instance and returns a callable
that DSPy ReAct can use as a tool.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from .memory_service import MemoryService


def create_memory_crud(memory_service: MemoryService) -> Callable[..., str]:
    """
    Factory: Create memory_crud function with MemoryService captured in closure.

    Args:
        memory_service: Initialized MemoryService instance.

    Returns:
        memory_crud function that DSPy ReAct can use.
    """

    def memory_crud(
        method: str,
        content: str | None = None,
        query: str | None = None,
        memory_id: str | None = None,
        memory_type: str | None = None,
    ) -> str:
        """Memory management: store_memory, search_memories, get_all_memories, delete_memory.

        Args:
            method: Operation — store_memory, search_memories, get_all_memories, delete_memory
            content: Memory content for store_memory
            query: Search query for search_memories
            memory_id: Memory ID for delete_memory
            memory_type: Memory category (general, preference, fact, procedure) for store/search

        Returns:
            JSON string with result or error message
        """
        if method == "store_memory":
            if not content:
                return "ERROR: content is required for store_memory"
            mid = memory_service.add(
                content=content,
                memory_type=memory_type or "general",
            )
            return json.dumps({"success": True, "memory_id": mid})

        elif method == "search_memories":
            if not query:
                return "ERROR: query is required for search_memories"
            results = memory_service.search(
                query=query,
                n_results=5,
                memory_type=memory_type,
            )
            return json.dumps({"data": results})

        elif method == "get_all_memories":
            results = memory_service.get_all(limit=50)
            return json.dumps({"data": results})

        elif method == "delete_memory":
            if not memory_id:
                return "ERROR: memory_id is required for delete_memory"
            success = memory_service.delete(memory_id)
            if not success:
                return "ERROR: Failed to delete memory"
            return json.dumps({"success": True, "deleted_id": memory_id})

        else:
            return f"ERROR: Unknown method: {method}. Supported: store_memory, search_memories, get_all_memories, delete_memory"

    return memory_crud
