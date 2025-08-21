from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Any
import os
import logging

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

BUILT_IN_TOOLS = [
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
