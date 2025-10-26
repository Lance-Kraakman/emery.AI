"""
Domain Model Provider Service Interface

AIDEV-NOTE: Pure domain interface for AI model provisioning.
Simplified for single-instruction model - removed StepType dependency.
Defines contract for creating smolagents models with standardized configuration.
Eliminates hardcoded model strings throughout the codebase.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional
from enum import Enum


class ModelType(Enum):
    """Standardized model types for different use cases."""
    CHAT = "chat"                    # General conversation and interaction
    CODE = "code"                    # Code generation and programming tasks
    TOOL_CALLING = "tool_calling"    # Tool execution and function calling
    FAST = "fast"                    # Quick responses and simple tasks


class IModelProviderService(ABC):
    """
    Domain service interface for AI model provisioning.

    AIDEV-NOTE: This interface standardizes AI model creation across the system.
    Simplified for single-instruction model - removed get_model_for_step_type().
    Implementations handle the specific model instantiation logic while domain
    code only depends on this clean interface.
    """

    @abstractmethod
    def get_model(self, model_type_name: str) -> Any:
        """
        Get AI model by string type name (simplified interface).

        AIDEV-NOTE: Convenience method for getting models by string name.
        Accepts strings like 'tool_calling', 'code', 'chat', 'fast', 'default'.

        Args:
            model_type_name: Name of the model type as string

        Returns:
            Configured AI model instance (implementation-specific type)

        Raises:
            ValueError: If model_type_name is invalid
        """
        pass

    @abstractmethod
    def get_model_by_type(self, model_type: ModelType) -> Any:
        """
        Get AI model by standardized model type.

        Args:
            model_type: The type of model needed

        Returns:
            Configured AI model instance (implementation-specific type)

        Raises:
            ValueError: If model_type is invalid or model cannot be created
            EnvironmentError: If required credentials are missing
        """
        pass

    @abstractmethod
    def get_default_model_for_capability(self, capability_name: Optional[str] = None) -> Any:
        """
        Get default model for a specific capability or general use.
        
        Args:
            capability_name: Optional capability name for specialized models
            
        Returns:
            Configured AI model instance (implementation-specific type)
        """
        pass
    
    @abstractmethod
    def get_model_info(self, model_name: str) -> dict[str, Any]:
        """
        Get information about a specific model.
        
        Args:
            model_name: Name of the model to get info for
            
        Returns:
            Dictionary with model metadata (name, max_tokens, temperature, etc.)
        """
        pass
    
    @abstractmethod
    def list_available_models(self) -> list[str]:
        """
        List all available model names.
        
        Returns:
            List of available model identifiers
        """
        pass
    
    @abstractmethod
    def is_model_available(self, model_name: str) -> bool:
        """
        Check if a specific model is available.
        
        Args:
            model_name: Name of the model to check
            
        Returns:
            True if model is available, False otherwise
        """
        pass