"""
Knowledge module - searchable patterns, strategies, and examples.

Provides KnowledgeBase for storing and retrieving enterprise knowledge
used during planning (e.g., org structures, workflows, best practices).
"""

from .base import KnowledgeBase, KnowledgeDomain, KnowledgeItem, KnowledgeType

__all__ = ["KnowledgeBase", "KnowledgeDomain", "KnowledgeItem", "KnowledgeType"]
