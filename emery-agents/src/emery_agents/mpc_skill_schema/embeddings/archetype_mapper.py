"""
Embedding-based archetype mapper for abstract terms to MPC concepts.
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from ..core.archetypes import ARCHETYPE_MAPPINGS, ArchetypeMapper as BaseArchetypeMapper


class EmbeddingArchetypeMapper:
    """Enhanced archetype mapper using embedding similarity."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize embedding mapper.
        
        Args:
            model_name: Sentence transformer model name
        """
        self.model_name = model_name
        self.model = None
        self.base_mapper = BaseArchetypeMapper()
        self._load_model()
        self._precompute_embeddings()
    
    def _load_model(self):
        """Load sentence transformer model."""
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
        except ImportError:
            print("Warning: sentence_transformers not available, using pattern matching only")
            self.model = None
    
    def _precompute_embeddings(self):
        """Precompute embeddings for known archetypes."""
        if self.model is None:
            return
        
        # Collect all archetype terms
        all_terms = []
        for category, mappings in ARCHETYPE_MAPPINGS.items():
            for term in mappings.keys():
                all_terms.append(term)
        
        # Compute embeddings
        self.archetype_embeddings = {}
        for term in all_terms:
            self.archetype_embeddings[term] = self.model.encode([term])[0]
    
    def embeddings_suggest_archetypes(self, terms: List[str]) -> Dict[str, Dict]:
        """
        Suggest archetypes for terms using embedding similarity.
        
        Args:
            terms: List of user terms to map
            
        Returns:
            Dictionary mapping terms to archetype suggestions
        """
        if self.model is None:
            # Fallback to pattern matching
            return self._fallback_suggestions(terms)
        
        suggestions = {}
        
        for term in terms:
            # Compute embedding for user term
            term_embedding = self.model.encode([term])[0]
            
            # Find most similar archetype
            best_match = None
            best_similarity = -1
            
            for archetype_term, archetype_embedding in self.archetype_embeddings.items():
                similarity = np.dot(term_embedding, archetype_embedding) / (
                    np.linalg.norm(term_embedding) * np.linalg.norm(archetype_embedding)
                )
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = archetype_term
            
            # Map to archetype if similarity is above threshold
            if best_similarity > 0.5:  # Threshold for similarity
                # Find which category this archetype belongs to
                for category, mappings in ARCHETYPE_MAPPINGS.items():
                    if best_match in mappings:
                        suggestions[term] = {
                            "suggested_archetype": mappings[best_match],
                            "similarity": float(best_similarity),
                            "category": category,
                            "matched_term": best_match
                        }
                        break
            else:
                # Use base mapper as fallback
                suggestions[term] = {
                    "suggested_archetype": self.base_mapper.map_term_to_archetype(term, "states"),
                    "similarity": 0.0,
                    "category": "unknown",
                    "matched_term": None
                }
        
        return suggestions
    
    def _fallback_suggestions(self, terms: List[str]) -> Dict[str, Dict]:
        """Fallback to pattern matching when embeddings unavailable."""
        suggestions = {}
        
        for term in terms:
            # Try to match with base mapper in different categories
            for category in ["states", "inputs", "outputs", "disturbances"]:
                archetype = self.base_mapper.map_term_to_archetype(term, category)
                if archetype["name"] != term.lower().replace(" ", "_"):
                    suggestions[term] = {
                        "suggested_archetype": archetype,
                        "similarity": 0.0,
                        "category": category,
                        "matched_term": term
                    }
                    break
            else:
                # No match found
                suggestions[term] = {
                    "suggested_archetype": {
                        "name": term.lower().replace(" ", "_"),
                        "type": "continuous",
                        "description": f"Generated variable from term: {term}"
                    },
                    "similarity": 0.0,
                    "category": "unknown",
                    "matched_term": None
                }
        
        return suggestions


def embeddings_suggest_archetypes(terms: List[str]) -> Dict[str, Dict]:
    """
    Convenience function to suggest archetypes for terms.
    
    Args:
        terms: List of user terms to map
        
    Returns:
        Dictionary mapping terms to archetype suggestions
    """
    mapper = EmbeddingArchetypeMapper()
    return mapper.embeddings_suggest_archetypes(terms)
