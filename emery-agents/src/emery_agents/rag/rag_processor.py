"""
RAG Context Processor

Simple context formatting service that takes pre-assembled RAG context from Next.js
and formats it for LLM system prompts. No database access - pure formatting logic.

AIDEV-NOTE: This is designed to work with the hybrid architecture where:
- Next.js DualContextRagService assembles RAG context from database
- Python RagProcessor formats the context for AI processing
- Clean separation: RAG assembly (Next.js) vs RAG formatting (Python)
"""

import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RagContextData:
    """Structured RAG context data received from Next.js via gRPC"""
    assembled_context: str           # Pre-formatted RAG context from DualContextRagService
    sources: List[str]              # RAG source summary for metadata
    domain_type: Optional[str] = None     # Domain context (table, agent, etc.)
    domain_id: Optional[int] = None       # Domain entity ID


class RagProcessor:
    """
    RAG Context Processor for AI chat processing.
    
    Takes pre-assembled RAG context from Next.js DualContextRagService
    and formats it for LLM system prompts.
    """
    
    def __init__(self):
        logger.info("RagProcessor initialized for context formatting")
    
    def format_context_for_llm(
        self, 
        rag_context_data: RagContextData,
        user_query: str,
        domain_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Format the pre-assembled RAG context into an LLM system prompt.
        
        Args:
            rag_context_data: Pre-assembled RAG context from Next.js
            user_query: The user's query for context
            domain_context: Additional domain-specific context
            
        Returns:
            Formatted system prompt with RAG context
        """
        
        if not rag_context_data.assembled_context:
            logger.info("No RAG context available, building minimal system prompt")
            return self._build_base_system_prompt(domain_context)
        
        logger.info(f"Formatting RAG context: {len(rag_context_data.assembled_context)} chars, {len(rag_context_data.sources)} sources")
        
        # Start with base system prompt
        system_prompt = self._build_base_system_prompt(domain_context)
        
        # Add the pre-assembled RAG context from Next.js
        system_prompt += "\n\n" + rag_context_data.assembled_context
        
        # Add instructions for using the context
        system_prompt += self._build_context_usage_instructions(rag_context_data)
        
        # Add final guidelines
        system_prompt += "\n\nAlways be helpful, accurate, and professional. When referencing information from the context, cite the specific sources."
        
        logger.debug(f"Generated system prompt: {len(system_prompt)} chars")
        return system_prompt
    
    def _build_base_system_prompt(self, domain_context: Optional[Dict[str, Any]] = None) -> str:
        """Build the base system prompt based on domain context."""
        
        base_prompt = 'You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.'
        
        # Add domain-specific context if available
        if domain_context and domain_context.get('domain_type'):
            domain_type = domain_context['domain_type']
            
            if domain_type == 'table':
                base_prompt += ' You are currently assisting with a specific table and its data. Focus on table structure, data analysis, and table-specific operations.'
            elif domain_type == 'agent':
                base_prompt += ' You are currently assisting with a specific agent. Focus on agent capabilities, execution history, and configuration.'
            elif domain_type == 'file':
                base_prompt += ' You are currently assisting with a specific file. Focus on file content, analysis, and document-related tasks.'
            elif domain_type == 'team':
                base_prompt += ' You are currently assisting with a specific team. Focus on team dynamics, member coordination, and collaborative activities.'
            elif domain_type == 'workflow':
                base_prompt += ' You are currently assisting with a specific workflow. Focus on process optimization, execution analysis, and workflow management.'
        else:
            base_prompt += ' Provide general guidance about database management and workflows.'
        
        return base_prompt
    
    def _build_context_usage_instructions(self, rag_context_data: RagContextData) -> str:
        """Build instructions for how to use the RAG context."""
        
        instructions = f"""

CONTEXT USAGE GUIDELINES:
- The above context contains {len(rag_context_data.sources)} relevant sources from your organization's data
- Use this context to provide accurate, specific answers to the user's questions
- When referencing information, cite the specific sources (marked with [P1], [P2] for primary context or [S1], [S2] for secondary context)
- If the context doesn't contain relevant information for the user's question, clearly state that and provide general guidance instead"""

        if rag_context_data.domain_type:
            instructions += f"\n- You are working in the context of a {rag_context_data.domain_type}, so prioritize information relevant to this domain"
        
        return instructions
    
    def extract_context_metadata(self, rag_context_data: RagContextData) -> Dict[str, Any]:
        """
        Extract metadata about the RAG context for logging and analytics.
        
        Returns:
            Dictionary with context metadata
        """
        
        metadata = {
            'has_context': bool(rag_context_data.assembled_context),
            'context_length': len(rag_context_data.assembled_context) if rag_context_data.assembled_context else 0,
            'source_count': len(rag_context_data.sources),
            'domain_type': rag_context_data.domain_type,
            'domain_id': rag_context_data.domain_id
        }
        
        # Parse source types if available
        source_types = []
        for source in rag_context_data.sources:
            if ':' in source:
                source_type = source.split(':')[1] if ':' in source else 'unknown'
                source_types.append(source_type)
        
        if source_types:
            metadata['source_types'] = list(set(source_types))
        
        return metadata
    
    def validate_context_size(self, rag_context_data: RagContextData, max_size: int = 50000) -> bool:
        """
        Validate that the RAG context is within acceptable size limits.
        
        Args:
            rag_context_data: RAG context to validate
            max_size: Maximum context size in characters
            
        Returns:
            True if context is within limits, False otherwise
        """
        
        if not rag_context_data.assembled_context:
            return True
        
        context_size = len(rag_context_data.assembled_context)
        is_valid = context_size <= max_size
        
        if not is_valid:
            logger.warning(f"RAG context exceeds size limit: {context_size} > {max_size} chars")
        else:
            logger.debug(f"RAG context size valid: {context_size} chars")
        
        return is_valid