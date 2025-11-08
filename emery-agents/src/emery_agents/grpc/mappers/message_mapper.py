"""
Message Mapper

Converts between protobuf MessageParts and smolagents ChatMessage format.
Clean separation of concerns for message transformation logic.

AIDEV-NOTE: Uses smolagents native ChatMessage format with PIL Image objects.
Images are downloaded from S3 URLs and converted to PIL.Image for vision model support.
"""
import logging
from typing import List, Dict, Any
from io import BytesIO

import requests
from PIL import Image
from smolagents.models import ChatMessage, MessageRole

from ...grpc.generated import agent_worker_pb2
from .message_types import MessageContentList, TextContentPart, ImageContentPart

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
) -> MessageContentList:
    """
    Convert protobuf MessageParts to smolagents content format.

    Returns list of content parts - ALWAYS list format (no string optimization).
    Frontend sends MessagePart[] arrays, we keep the same structure.

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        List of content parts (TextContentPart | ImageContentPart)

    AIDEV-NOTE: Images are downloaded from S3 URLs and converted to PIL Image objects.
    PIL Images must be converted to base64 data URLs before sending to HuggingFace API.
    """
    content_parts: MessageContentList = []

    for part in message_parts:
        if part.HasField('text'):
            content_parts.append(TextContentPart(
                type="text",
                text=part.text.text
            ))
        elif part.HasField('image_url'):
            # Download S3 image and convert to PIL Image with error handling
            image_url = part.image_url.url
            logger.info(f"🖼️ Processing image URL: {image_url[:80]}...")

            try:
                pil_image = download_image_from_url(image_url)
                content_parts.append(ImageContentPart(
                    type="image",
                    image=pil_image  # PIL Image object, not URL
                ))
                logger.info(f"✅ Successfully added image to content: {pil_image.size} {pil_image.mode}")
            except requests.exceptions.RequestException as e:
                logger.error(f"❌ Failed to download image from URL: {str(e)}")
                logger.warning("⚠️ Skipping image, continuing with text-only message")
                # Continue processing without the image - don't crash the whole message
            except Exception as e:
                logger.error(f"❌ Unexpected error processing image: {str(e)}")
                logger.warning("⚠️ Skipping image, continuing with text-only message")

    # Always return list format (no string optimization)
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
