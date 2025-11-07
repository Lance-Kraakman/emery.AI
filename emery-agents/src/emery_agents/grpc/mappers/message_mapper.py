"""
Message Mapper

Converts between protobuf MessageParts and smolagents ChatMessage format.
Clean separation of concerns for message transformation logic.

AIDEV-NOTE: Uses smolagents native ChatMessage format with PIL Image objects.
Images are downloaded from S3 URLs and converted to PIL.Image for vision model support.
"""
import logging
from typing import List, Dict, Any, Union
from io import BytesIO

import requests
from PIL import Image
from smolagents.models import ChatMessage, MessageRole

from ...grpc.generated import agent_worker_pb2

logger = logging.getLogger(__name__)


def download_image_from_url(url: str) -> Image.Image:
    """
    Download image from S3 URL and convert to PIL Image.

    Args:
        url: Pre-signed S3 URL or other image URL

    Returns:
        PIL Image object ready for vision model

    Raises:
        requests.exceptions.RequestException: If download fails
        PIL.UnidentifiedImageError: If image cannot be opened
    """
    logger.info(f"🖼️ Downloading image from URL: {url[:80]}...")

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    image = Image.open(BytesIO(response.content))
    logger.info(f"✅ Image downloaded: {image.size} {image.mode}")

    return image


def proto_parts_to_smolagents_content(
    message_parts: List[agent_worker_pb2.MessagePart]
) -> Union[str, List[Dict[str, Any]]]:
    """
    Convert protobuf MessageParts to smolagents content format.

    Smolagents supports two content formats:
    - str: For text-only messages (optimized)
    - List[Dict]: For multimodal messages (text + images)

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        str if single text part, List[Dict] if multimodal

    AIDEV-NOTE: Images are downloaded from S3 URLs and converted to PIL Image objects.
    Smolagents handles conversion to HuggingFace base64 format internally.
    """
    content_parts = []

    for part in message_parts:
        if part.HasField('text'):
            content_parts.append({
                "type": "text",
                "text": part.text.text
            })
        elif part.HasField('image_url'):
            # Download S3 image and convert to PIL Image
            pil_image = download_image_from_url(part.image_url.url)
            content_parts.append({
                "type": "image",
                "image": pil_image  # PIL Image object, not URL
            })

    # Optimization: return string if only one text part
    if len(content_parts) == 1 and content_parts[0]["type"] == "text":
        return content_parts[0]["text"]

    return content_parts


def extract_text_from_parts(message_parts: List[agent_worker_pb2.MessagePart]) -> str:
    """
    Extract all text content from message parts for logging/preview.

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        Combined text string (images omitted)
    """
    texts = []
    for part in message_parts:
        if part.HasField('text'):
            texts.append(part.text.text)
    return ' '.join(texts)


def has_images(message_parts: List[agent_worker_pb2.MessagePart]) -> bool:
    """
    Check if any message part contains an image.

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        True if images present, False otherwise
    """
    return any(part.HasField('image_url') for part in message_parts)


def build_conversation_messages(
    history: List[agent_worker_pb2.HistoryMessage],
    current_message_parts: List[agent_worker_pb2.MessagePart]
) -> List[ChatMessage]:
    """
    Build complete conversation as smolagents ChatMessage objects.

    Combines conversation history with current user message into smolagents native format.
    Supports multimodal messages with PIL Image objects for vision models.

    Args:
        history: Previous messages from conversation history
        current_message_parts: Current user message parts

    Returns:
        List of smolagents ChatMessage objects ready for agent.run()

    AIDEV-NOTE: Returns ChatMessage objects, NOT dict format.
    Smolagents handles conversion to HuggingFace API format internally.
    """
    messages = []

    # Add conversation history
    for hist_msg in history:
        content = proto_parts_to_smolagents_content(hist_msg.content_parts)
        messages.append(ChatMessage(
            role=MessageRole(hist_msg.role.lower()),
            content=content
        ))

    # Add current user message
    content = proto_parts_to_smolagents_content(current_message_parts)
    messages.append(ChatMessage(
        role=MessageRole.USER,
        content=content
    ))

    return messages
