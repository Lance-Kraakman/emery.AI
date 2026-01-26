"""
Inference Clients for Direct Skill Execution

AIDEV-NOTE: These clients handle direct model invocation for operation skills,
bypassing LLM orchestration. Used when skill.execution_type == 'operation'.

Supports:
- HuggingFace Inference API
- HuggingFace Dedicated Endpoints
- Future: Replicate, Together.ai, custom endpoints
"""

from .base import BaseInferenceClient, TaskResult
from .huggingface_inference import HuggingFaceInferenceClient

__all__ = [
    'BaseInferenceClient',
    'TaskResult',
    'HuggingFaceInferenceClient',
]
