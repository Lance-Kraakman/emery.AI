"""
Tool Registry for Smolagents Integration.

This module provides a centralized registry for all available smolagents tools,
mapping them to user-configurable tool types with proper type safety.

AIDEV-NOTE: This registry supports both built-in smolagents tools and custom tool extensions.
Each tool type corresponds to a specific task category from HuggingFace's task taxonomy.
"""

import logging
import os
from typing import Dict, List, Optional, Type, Any, Protocol, Tuple
from dataclasses import dataclass
from enum import Enum

from smolagents import PythonInterpreterTool, DuckDuckGoSearchTool, SpeechToTextTool

logger = logging.getLogger(__name__)

class ToolCategory(Enum):
    """Tool categories based on HuggingFace task taxonomy."""
    # Core AI Tasks
    NATURAL_LANGUAGE_PROCESSING = "nlp"
    COMPUTER_VISION = "cv" 
    AUDIO = "audio"
    MULTIMODAL = "multimodal"
    
    # System Tools
    CODE_EXECUTION = "code"
    WEB_SEARCH = "web"
    FILE_OPERATIONS = "file"
    DATA_PROCESSING = "data"
    
    # Integration Tools  
    API_TOOLS = "api"
    DATABASE_TOOLS = "database"
    COMMUNICATION = "communication"

class ToolType(Enum):
    """Available tool types mapped to smolagents functionality."""
    
    # NLP Tools
    TEXT_GENERATION = "text_generation"
    TEXT_CLASSIFICATION = "text_classification" 
    SUMMARIZATION = "summarization"
    TRANSLATION = "translation"
    QUESTION_ANSWERING = "question_answering"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    
    # Computer Vision Tools
    IMAGE_CLASSIFICATION = "image_classification"
    IMAGE_GENERATION = "image_generation"
    IMAGE_TO_TEXT = "image_to_text"
    OBJECT_DETECTION = "object_detection"
    IMAGE_SEGMENTATION = "image_segmentation"
    
    # Audio Tools
    SPEECH_TO_TEXT = "speech_to_text"
    TEXT_TO_SPEECH = "text_to_speech"
    AUDIO_CLASSIFICATION = "audio_classification"
    
    # Multimodal Tools
    VISUAL_QUESTION_ANSWERING = "visual_qa"
    IMAGE_TEXT_TO_TEXT = "image_text_to_text"
    
    # System Tools
    PYTHON_INTERPRETER = "python_repl"
    WEB_SEARCH = "web_search"
    FILE_READER = "file_reader"
    FILE_WRITER = "file_writer"
    
    # Custom Integration Tools
    PIPEDREAM_CONNECTOR = "pipedream_connector"
    DATABASE_QUERY = "database_query"
    EMAIL_SENDER = "email_sender"
    SLACK_MESSENGER = "slack_messenger"

@dataclass
class ToolConfig:
    """Enhanced tool configuration with validation and metadata."""
    name: str
    tool_type: ToolType
    category: ToolCategory
    description: str
    version: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    required_env_vars: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None
    is_custom: bool = False
    
    def validate_environment(self) -> bool:
        """Validate that required environment variables are present."""
        if not self.required_env_vars:
            return True
            
        missing_vars = [var for var in self.required_env_vars if not os.getenv(var)]
        if missing_vars:
            logger.warning(f"Tool {self.name} missing required env vars: {missing_vars}")
            return False
        return True

# AIDEV-NOTE: Tool configurations defined as data structures for clarity and maintainability
BUILT_IN_TOOLS = [
    # System Tools
    ToolConfig(
        name="Python Interpreter",
        tool_type=ToolType.PYTHON_INTERPRETER,
        category=ToolCategory.CODE_EXECUTION,
        description="Execute Python code in a secure environment",
        dependencies=["smolagents"]
    ),
    ToolConfig(
        name="Web Search",
        tool_type=ToolType.WEB_SEARCH,
        category=ToolCategory.WEB_SEARCH,
        description="Search the web using DuckDuckGo",
        dependencies=["smolagents"]
    ),
    ToolConfig(
        name="Speech to Text",
        tool_type=ToolType.SPEECH_TO_TEXT,
        category=ToolCategory.AUDIO,
        description="Convert audio to text using Whisper",
        dependencies=["smolagents"],
        required_env_vars=["HF_TOKEN"]
    ),
]

# HuggingFace Model-based Tools Configuration
HF_NLP_TOOLS = [
    (ToolType.TEXT_GENERATION, "Generate text using language models"),
    (ToolType.TEXT_CLASSIFICATION, "Classify text into categories"),
    (ToolType.SUMMARIZATION, "Summarize long text content"),
    (ToolType.TRANSLATION, "Translate text between languages"),
    (ToolType.QUESTION_ANSWERING, "Answer questions based on context"),
    (ToolType.SENTIMENT_ANALYSIS, "Analyze sentiment in text"),
]

HF_CV_TOOLS = [
    (ToolType.IMAGE_CLASSIFICATION, "Classify images into categories"),
    (ToolType.IMAGE_GENERATION, "Generate images from text descriptions"),
    (ToolType.IMAGE_TO_TEXT, "Generate text descriptions of images"),
    (ToolType.OBJECT_DETECTION, "Detect objects in images"),
    (ToolType.IMAGE_SEGMENTATION, "Segment images into regions"),
]

HF_AUDIO_TOOLS = [
    (ToolType.TEXT_TO_SPEECH, "Convert text to speech"),
    (ToolType.AUDIO_CLASSIFICATION, "Classify audio content"),
]

HF_MULTIMODAL_TOOLS = [
    (ToolType.VISUAL_QUESTION_ANSWERING, "Answer questions about images"),
    (ToolType.IMAGE_TEXT_TO_TEXT, "Process image and text to generate text"),
]

CUSTOM_INTEGRATION_TOOLS = [
    ToolConfig(
        name="Pipedream Connector",
        tool_type=ToolType.PIPEDREAM_CONNECTOR,
        category=ToolCategory.API_TOOLS,
        description="Connect to external services via Pipedream",
        dependencies=["requests"],
        required_env_vars=["PIPEDREAM_API_KEY"],
        is_custom=True
    ),
]

class ToolFactory(Protocol):
    """Protocol for tool factory functions."""
    def __call__(self, config: ToolConfig) -> Any:
        """Create a tool instance from configuration."""
        ...

class ToolRegistry:
    """
    Centralized registry for all available tools.
    
    AIDEV-NOTE: This registry automatically discovers smolagents tools
    and provides a clean interface for tool configuration and instantiation.
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
                from .custom_tools import PipedreamConnectorTool
                return PipedreamConnectorTool(config.config or {})
            return None
        
        return create_custom_tool
    
    def _create_hf_model_tool(self, config: ToolConfig) -> Any:
        """Create HuggingFace model-based tool."""
        # AIDEV-TODO: Implement HuggingFace model tools using transformers pipeline
        try:
            from .hf_model_tools import create_hf_pipeline_tool
            return create_hf_pipeline_tool(config)
        except ImportError:
            logger.warning(f"HF model tools not available for {config.name}")
            return None
    
    def register_tool(self, config: ToolConfig, factory: ToolFactory) -> None:
        """Register a new tool configuration and factory."""
        self._tool_configs[config.tool_type] = config
        self._tool_factories[config.tool_type] = factory
        logger.info(f"Registered tool: {config.name} ({config.tool_type.value})")
    
    def get_available_tools(self, category: Optional[ToolCategory] = None) -> List[ToolConfig]:
        """Get all available tool configurations, optionally filtered by category."""
        tools = list(self._tool_configs.values())
        if category:
            tools = [tool for tool in tools if tool.category == category]
        return tools
    
    def get_validated_tools(self, category: Optional[ToolCategory] = None) -> List[ToolConfig]:
        """Get tools that pass environment validation."""
        available_tools = self.get_available_tools(category)
        return [tool for tool in available_tools if tool.validate_environment()]
    
    def create_tool_instance(self, tool_type: ToolType, config_override: Optional[Dict[str, Any]] = None) -> Any:
        """Create a tool instance from registered configuration."""
        if tool_type not in self._tool_configs:
            raise ValueError(f"Tool type {tool_type.value} not registered")
        
        config = self._tool_configs[tool_type]
        
        # Apply configuration overrides
        if config_override:
            config = ToolConfig(
                name=config.name,
                tool_type=config.tool_type,
                category=config.category,
                description=config.description,
                version=config.version,
                config={**(config.config or {}), **config_override},
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
    
    def get_tools_for_agent_config(self, tool_configs: List[Dict[str, Any]]) -> List[Any]:
        """Create tool instances from agent configuration."""
        tools = []
        for tool_config in tool_configs:
            tool_name = tool_config.get("name")
            
            # Try to find matching tool type
            tool_type = None
            for registered_type, registered_config in self._tool_configs.items():
                if (registered_config.name.lower() == tool_name.lower() or 
                    registered_type.value == tool_name):
                    tool_type = registered_type
                    break
            
            if tool_type:
                try:
                    tool_instance = self.create_tool_instance(
                        tool_type, 
                        tool_config.get("config", {})
                    )
                    tools.append(tool_instance)
                    logger.info(f"Created tool instance: {tool_name}")
                except Exception as e:
                    logger.warning(f"Failed to create tool {tool_name}: {e}")
            else:
                logger.warning(f"Unknown tool type: {tool_name}")
        
        return tools

# Global tool registry instance
tool_registry = ToolRegistry()