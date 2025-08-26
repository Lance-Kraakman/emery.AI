"""
Smolagents Model Provider Implementation

AIDEV-NOTE: Infrastructure implementation of ModelProviderService using smolagents.
Consolidates all AI model configuration and creation logic into a single service.
Replaces scattered hardcoded model instantiation throughout the codebase.
"""

import os
import logging
from typing import Any, Optional

from smolagents.models import InferenceClientModel

from ...domain.ai.services.model_provider_service import IModelProviderService, ModelType
from ...core.types import StepType

logger = logging.getLogger(__name__)


class SmolagentsModelProvider(IModelProviderService):
    """
    Smolagents implementation of AI model provider.
    
    AIDEV-NOTE: This implementation consolidates model configuration from
    the existing model_factory.py and provides a clean interface for
    creating smolagents InferenceClientModel instances.
    """
    
    def __init__(self):
        """Initialize the model provider with configuration."""
        self.hf_token = self._get_hf_token()
        
        # AIDEV-NOTE: Centralized model configuration 
        # Based on existing model_factory.py patterns
        self.model_configs = {
            ModelType.CHAT: {
                'model_id': 'Qwen/Qwen2.5-Coder-32B-Instruct',
                'max_tokens': 2048,
                'temperature': 0.7,
                'description': 'General conversation and interaction'
            },
            ModelType.CODE: {
                'model_id': 'Qwen/Qwen2.5-Coder-32B-Instruct', 
                'max_tokens': 4096,
                'temperature': 0.6,
                'description': 'Code generation and programming tasks'
            },
            ModelType.TOOL_CALLING: {
                'model_id': 'Qwen/Qwen2.5-14B-Instruct',
                'max_tokens': 2048, 
                'temperature': 0.7,
                'description': 'Tool execution and function calling'
            },
            ModelType.FAST: {
                'model_id': 'Qwen/Qwen2.5-Coder-7B-Instruct',
                'max_tokens': 1024,
                'temperature': 0.6,
                'description': 'Quick responses and simple tasks'
            }
        }
        
        # Step type to model type mapping
        self.step_type_mapping = {
            StepType.CODE_STEP: ModelType.CODE,
            StepType.TOOL_STEP: ModelType.TOOL_CALLING,
        }
        
        self._model_cache = {}  # Cache model instances
        logger.info(f"✅ SmolagentsModelProvider initialized with {len(self.model_configs)} model types")
    
    def get_model_for_step_type(self, step_type: StepType, model_override: Optional[str] = None) -> InferenceClientModel:
        """
        Get appropriate AI model for a specific step type.
        
        AIDEV-NOTE: This replaces the hardcoded model creation patterns found in:
        - smolagents_execution_repository.py
        - capability_router_agent.py
        """
        if model_override:
            # Use specific model override
            return self._create_model(model_override)
        
        # Map step type to model type
        model_type = self.step_type_mapping.get(step_type, ModelType.TOOL_CALLING)
        return self.get_model_by_type(model_type)
    
    def get_model_by_type(self, model_type: ModelType) -> InferenceClientModel:
        """Get AI model by standardized model type."""
        if model_type not in self.model_configs:
            raise ValueError(f"Unknown model type: {model_type}. Available: {list(self.model_configs.keys())}")
        
        # Use cache to avoid recreating the same model
        cache_key = model_type.value
        if cache_key in self._model_cache:
            return self._model_cache[cache_key]
        
        config = self.model_configs[model_type]
        model = self._create_model(config['model_id'])
        
        # Cache the model instance
        self._model_cache[cache_key] = model
        logger.info(f"✅ Created {model_type.value} model: {config['model_id']}")
        
        return model
    
    def get_default_model_for_capability(self, capability_name: Optional[str] = None) -> InferenceClientModel:
        """Get default model for a specific capability or general use."""
        # AIDEV-NOTE: Default to TOOL_CALLING model for general capability execution
        # This matches the existing patterns in the codebase
        return self.get_model_by_type(ModelType.TOOL_CALLING)
    
    def get_model_info(self, model_name: str) -> dict[str, Any]:
        """Get information about a specific model."""
        # Check if it's a model type
        for model_type, config in self.model_configs.items():
            if config['model_id'] == model_name or model_type.value == model_name:
                return {
                    'name': model_type.value,
                    'model_id': config['model_id'],
                    'max_tokens': config['max_tokens'],
                    'temperature': config['temperature'],
                    'description': config['description'],
                    'available': True
                }
        
        # Unknown model
        return {
            'name': model_name,
            'available': False,
            'error': f'Unknown model: {model_name}'
        }
    
    def list_available_models(self) -> list[str]:
        """List all available model names."""
        return [config['model_id'] for config in self.model_configs.values()]
    
    def is_model_available(self, model_name: str) -> bool:
        """Check if a specific model is available."""
        available_models = self.list_available_models()
        model_types = [model_type.value for model_type in self.model_configs.keys()]
        return model_name in available_models or model_name in model_types
    
    def _get_hf_token(self) -> str:
        """Get HuggingFace token from environment."""
        token = os.getenv('HF_TOKEN')
        if not token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        return token
    
    def _create_model(self, model_id: str) -> InferenceClientModel:
        """Create a new InferenceClientModel instance."""
        try:
            model = InferenceClientModel(model_id, token=self.hf_token)
            logger.debug(f"Created model instance: {model_id}")
            return model
        except Exception as e:
            logger.error(f"Failed to create model {model_id}: {e}")
            raise ValueError(f"Failed to create model {model_id}: {e}") from e
    
    def clear_cache(self):
        """Clear cached models (useful for testing)."""
        self._model_cache.clear()
        logger.info("✅ Model cache cleared")