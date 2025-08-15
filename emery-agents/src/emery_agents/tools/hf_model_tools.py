"""
HuggingFace model-based tools for Emery Agents.

Provides tool implementations for various HuggingFace pipeline tasks.
"""

import logging
import os
import requests
from io import BytesIO
from typing import Dict, Any, Optional, Union, List

import torch
from transformers import pipeline, Pipeline
from PIL import Image

from .tool_registry import ToolConfig, ToolType

logger = logging.getLogger(__name__)

# Model mappings for different tasks
TASK_MODEL_MAPPING = {
    ToolType.TEXT_GENERATION: "microsoft/DialoGPT-medium",
    ToolType.TEXT_CLASSIFICATION: "cardiffnlp/twitter-roberta-base-sentiment-latest",
    ToolType.SUMMARIZATION: "facebook/bart-large-cnn", 
    ToolType.TRANSLATION: "Helsinki-NLP/opus-mt-en-fr",
    ToolType.QUESTION_ANSWERING: "deepset/roberta-base-squad2",
    ToolType.SENTIMENT_ANALYSIS: "cardiffnlp/twitter-roberta-base-sentiment-latest",
    ToolType.IMAGE_CLASSIFICATION: "google/vit-base-patch16-224",
    ToolType.IMAGE_TO_TEXT: "nlpconnect/vit-gpt2-image-captioning",
    ToolType.OBJECT_DETECTION: "facebook/detr-resnet-50",
    ToolType.IMAGE_SEGMENTATION: "facebook/detr-resnet-50-panoptic",
}

# Task to pipeline task mapping
PIPELINE_TASK_MAPPING = {
    ToolType.TEXT_GENERATION: "text-generation",
    ToolType.TEXT_CLASSIFICATION: "text-classification",
    ToolType.SUMMARIZATION: "summarization",
    ToolType.TRANSLATION: "translation",
    ToolType.QUESTION_ANSWERING: "question-answering",
    ToolType.SENTIMENT_ANALYSIS: "sentiment-analysis",
    ToolType.IMAGE_CLASSIFICATION: "image-classification",
    ToolType.IMAGE_TO_TEXT: "image-to-text",
    ToolType.OBJECT_DETECTION: "object-detection",
    ToolType.IMAGE_SEGMENTATION: "image-segmentation",
}

class HuggingFaceTool:
    """
    Base class for HuggingFace pipeline-based tools.
    
    AIDEV-NOTE: Wraps HuggingFace pipelines in a tool interface compatible with smolagents.
    Each tool type corresponds to a specific HuggingFace task.
    """
    
    def __init__(self, config: ToolConfig):
        self.config = config
        self.name = config.name
        self.description = config.description
        self.tool_type = config.tool_type
        
        # Get HF token from environment
        self.hf_token = os.getenv("HF_TOKEN")
        if not self.hf_token:
            logger.warning("HF_TOKEN not found, using public models only")
        
        # Initialize pipeline
        self.pipeline: Optional[Pipeline] = None
        self._initialize_pipeline()
    
    def _initialize_pipeline(self) -> None:
        """Initialize the HuggingFace pipeline for this tool."""
        try:
            task = PIPELINE_TASK_MAPPING.get(self.tool_type)
            model = TASK_MODEL_MAPPING.get(self.tool_type)
            
            if not task or not model:
                raise ValueError(f"Unsupported tool type: {self.tool_type}")
            
            # Use GPU if available
            device = 0 if torch.cuda.is_available() else -1
            
            self.pipeline = pipeline(
                task=task,
                model=model,
                device=device,
                token=self.hf_token,
                trust_remote_code=True
            )
            
            logger.info(f"Initialized {task} pipeline with model {model}")
            
        except Exception as e:
            logger.error(f"Failed to initialize pipeline for {self.tool_type}: {e}")
            self.pipeline = None
    
    def __call__(self, *args, **kwargs) -> Any:
        """Make the tool callable."""
        return self.forward(*args, **kwargs)
    
    def forward(self, *args, **kwargs) -> Dict[str, Any]:
        """Execute the tool's main functionality."""
        if not self.pipeline:
            return {"error": f"Pipeline not initialized for {self.tool_type.value}"}
        
        try:
            # Route to specific implementation based on tool type
            if self.tool_type in [ToolType.TEXT_GENERATION, ToolType.TEXT_CLASSIFICATION, 
                                 ToolType.SUMMARIZATION, ToolType.SENTIMENT_ANALYSIS]:
                return self._process_text(*args, **kwargs)
            elif self.tool_type == ToolType.TRANSLATION:
                return self._process_translation(*args, **kwargs)
            elif self.tool_type == ToolType.QUESTION_ANSWERING:
                return self._process_qa(*args, **kwargs)
            elif self.tool_type in [ToolType.IMAGE_CLASSIFICATION, ToolType.IMAGE_TO_TEXT]:
                return self._process_image(*args, **kwargs)
            elif self.tool_type in [ToolType.OBJECT_DETECTION, ToolType.IMAGE_SEGMENTATION]:
                return self._process_image_detection(*args, **kwargs)
            else:
                return {"error": f"Unsupported tool type: {self.tool_type.value}"}
                
        except Exception as e:
            logger.error(f"Error in {self.tool_type.value} tool: {e}")
            return {"error": str(e)}
    
    def _process_text(self, text: str, **kwargs) -> Dict[str, Any]:
        """Process text-based tasks."""
        result = self.pipeline(text, **kwargs)
        return {"success": True, "result": result}
    
    def _process_translation(self, text: str, target_language: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """Process translation tasks."""
        # For translation, we might need to specify target language
        result = self.pipeline(text, **kwargs)
        return {"success": True, "result": result}
    
    def _process_qa(self, question: str, context: str, **kwargs) -> Dict[str, Any]:
        """Process question-answering tasks."""
        inputs = {"question": question, "context": context}
        result = self.pipeline(inputs, **kwargs)
        return {"success": True, "result": result}
    
    def _load_image(self, image: Union[str, Any]) -> Union[Image.Image, Dict[str, Any]]:
        """
        Load image from various input types.
        
        AIDEV-NOTE: In practice, images will typically come from S3 URLs in our system,
        but this method handles both S3/HTTP URLs and local file paths for flexibility.
        """
        if isinstance(image, str):
            try:
                if image.startswith(('http://', 'https://')):
                    # URL image (typically S3 URLs in production)
                    response = requests.get(image)
                    return Image.open(BytesIO(response.content))
                else:
                    # File path
                    return Image.open(image)
            except Exception as e:
                return {"error": f"Failed to load image: {e}"}
        return image
    
    def _process_image(self, image: Union[str, Any], **kwargs) -> Dict[str, Any]:
        """Process image-based tasks."""
        loaded_image = self._load_image(image)
        if isinstance(loaded_image, dict) and "error" in loaded_image:
            return loaded_image
        
        result = self.pipeline(loaded_image, **kwargs)
        return {"success": True, "result": result}
    
    def _process_image_detection(self, image: Union[str, Any], **kwargs) -> Dict[str, Any]:
        """Process object detection and segmentation tasks."""
        return self._process_image(image, **kwargs)

def create_hf_pipeline_tool(config: ToolConfig) -> Optional[HuggingFaceTool]:
    """
    Factory function to create HuggingFace pipeline tools.
    
    Args:
        config: Tool configuration specifying the task type and parameters
        
    Returns:
        HuggingFaceTool instance or None if creation fails
    """
    try:
        return HuggingFaceTool(config)
    except Exception as e:
        logger.error(f"Failed to create HF tool for {config.tool_type}: {e}")
        return None