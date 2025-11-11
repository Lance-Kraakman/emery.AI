"""
Embedding-based archetype mapping for MPC Skill Schema Builder.

This module provides embedding-based similarity matching to map
abstract user terms to known MPC archetypes.
"""

from .archetype_mapper import ArchetypeMapper, embeddings_suggest_archetypes

__all__ = [
    "ArchetypeMapper",
    "embeddings_suggest_archetypes"
]
