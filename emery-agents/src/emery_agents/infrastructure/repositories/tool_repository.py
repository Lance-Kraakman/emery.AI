import logging
import os
from typing import Dict, List, Optional, Type, Any, Protocol, Tuple, Union
from dataclasses import dataclass
from enum import Enum

from smolagents import PythonInterpreterTool, DuckDuckGoSearchTool, SpeechToTextTool

from ...domain.entities.models import ToolConfig
from ...domain.repositories.tool_repository import IToolRepository
from ...tools.converters import ToolConfigConverter
from ...tools.tool_registry import ToolType, ToolCategory, BUILT_IN_TOOLS, HF_NLP_TOOLS, HF_CV_TOOLS, HF_AUDIO_TOOLS, HF_MULTIMODAL_TOOLS, CUSTOM_INTEGRATION_TOOLS, ToolFactory

logger = logging.getLogger(__name__)

class ToolRegistryRepository(IToolRepository):
    """
    Centralized registry for all available tools.
    """
    def __init__(self):
        self._tool_configs: Dict[ToolType, ToolConfig] = {}
        self._tool_factories: Dict[ToolType, ToolFactory] = {}
        self._initialize_registry()
    
    def _initialize_registry(self) -> None:
        """Initialize tool registry from configuration data."""
        
        # Register built-in tools
        for tool_config in BUILT_IN_TOOLS:
            self._tool_configs[tool_config.tool_type] = tool_config
            self._tool_factories[tool_config.tool_type] = self._get_builtin_factory(tool_config.tool_type)
        
        # Register HuggingFace model tools
        for tools_list, category in [
            (HF_NLP_TOOLS, ToolCategory.NATURAL_LANGUAGE_PROCESSING),
            (HF_CV_TOOLS, ToolCategory.COMPUTER_VISION),
            (HF_AUDIO_TOOLS, ToolCategory.AUDIO),
            (HF_MULTIMODAL_TOOLS, ToolCategory.MULTIMODAL),
        ]:
            for tool_type, description in tools_list:
                config = ToolConfig(
                    name=tool_type.value.replace("_", " ").title(),
                    tool_type=tool_type,
                    category=category,
                    description=description,
                    dependencies=["transformers", "torch"],
                    required_env_vars=["HF_TOKEN"]
                )
                self._tool_configs[tool_type] = config
                self._tool_factories[tool_type] = self._create_hf_model_tool
        
        # Register custom integration tools
        for tool_config in CUSTOM_INTEGRATION_TOOLS:
            self._tool_configs[tool_config.tool_type] = tool_config
            self._tool_factories[tool_config.tool_type] = self._get_custom_factory(tool_config.tool_type)
    
    def _get_builtin_factory(self, tool_type: ToolType) -> ToolFactory:
        """Get factory function for built-in smolagents tools."""
        factories = {
            ToolType.PYTHON_INTERPRETER: lambda config: PythonInterpreterTool(),
            ToolType.WEB_SEARCH: lambda config: DuckDuckGoSearchTool(),
            ToolType.SPEECH_TO_TEXT: lambda config: SpeechToTextTool(),
        }
        return factories.get(tool_type, lambda config: None)
    
    def _get_custom_factory(self, tool_type: ToolType) -> ToolFactory:
        """Get factory function for custom tools."""
        def create_custom_tool(config: ToolConfig) -> Any:
            if tool_type == ToolType.PIPEDREAM_CONNECTOR:
                from ...tools.custom_tools import PipedreamConnectorTool
                return PipedreamConnectorTool(config.config or {})
            return None
        
        return create_custom_tool
    
    def _create_hf_model_tool(self, config: ToolConfig) -> Any:
        """Create HuggingFace model-based tool."""
        try:
            from ...tools.hf_model_tools import create_hf_pipeline_tool
            return create_hf_pipeline_tool(config)
        except ImportError:
            logger.warning(f"HF model tools not available for {config.name}")
            return None
    
    def create_tool_instance(self, tool_config: Union[ToolConfig, Dict[str, Any]]) -> Optional[Any]:
        """Creates an instance of a tool from a given configuration."""
        tool_name = ToolConfigConverter.get_tool_name(tool_config)
        
        try:
            config_dict = ToolConfigConverter.from_agent_config(tool_config)
            
            tool_type = ToolConfigConverter.find_tool_type_by_name(tool_name)
            if not tool_type:
                logger.warning(f"Tool {tool_name} not found in registry")
                return None
            
            if tool_type not in self._tool_configs:
                raise ValueError(f"Tool type {tool_type.value} not registered")
            
            config = self._tool_configs[tool_type]
            
            if config_dict:
                config = ToolConfig(
                    name=config.name,
                    tool_type=config.tool_type,
                    category=config.category,
                    description=config.description,
                    version=config.version,
                    config={**(config.config or {}), **config_dict},
                    required_env_vars=config.required_env_vars,
                    dependencies=config.dependencies,
                    is_custom=config.is_custom
                )
            
            if not config.validate_environment():
                raise EnvironmentError(f"Environment validation failed for tool {config.name}")
            
            factory = self._tool_factories[tool_type]
            tool_instance = factory(config)
            
            if tool_instance is None:
                raise RuntimeError(f"Failed to create tool instance for {config.name}")
            
            return tool_instance
        except Exception as e:
            logger.error(f"Failed to create tool {tool_name}: {e}")
            return None
