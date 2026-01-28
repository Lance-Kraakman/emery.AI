"""
Memory Service — Persistent semantic memory for agents and users.

Uses ChromaDB for vector storage with sentence-transformers embeddings.
PII is stripped from agent memories (shared) via Microsoft Presidio.
"""

from .memory_service import MemoryService
from .memory_tools import create_memory_crud
from .pii_filter import PIIFilter

__all__ = [
    "MemoryService",
    "create_memory_crud",
    "PIIFilter",
]
