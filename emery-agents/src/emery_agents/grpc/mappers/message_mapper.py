"""
Message Mapper

Converts between protobuf MessageParts and ChatMessage format.
Clean separation of concerns for message transformation logic.

DSPy Migration: Uses native ChatMessage format from message_types.py.
Images are downloaded from S3 URLs and converted to PIL.Image for vision model support.
Files (PDFs, audio, documents) are processed to extract text content.
"""
import logging
import asyncio
from typing import List, Dict, Any
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor

from emery_agents.services.execution.events import ClarifyingQuestion

import requests
from PIL import Image

from ...grpc.generated import agent_worker_pb2
from .message_types import (
    ChatMessage,
    MessageRole,
    MessageContentList,
    TextContentPart,
    ImageContentPart,
)
from ...services.data.file_processor import process_file

logger = logging.getLogger(__name__)

# Shared thread pool for image downloads to prevent blocking gRPC event loop
_image_download_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="image-download")


def _download_image_sync(url: str) -> Image.Image:
    """Synchronous image download to run in thread pool."""
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return Image.open(BytesIO(response.content))


async def download_image_from_url(url: str) -> Image.Image:
    """
    Download image from S3 URL and convert to PIL Image.

    Uses ThreadPoolExecutor to prevent blocking gRPC event loop.
    Runs synchronous download in background thread.

    Args:
        url: Pre-signed S3 URL or other image URL

    Returns:
        PIL Image object ready for vision model

    Raises:
        requests.exceptions.RequestException: If download fails
        PIL.UnidentifiedImageError: If image cannot be opened
    """
    logger.info(f"Downloading image from URL: {url[:80]}...")

    # Run blocking download in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    image = await loop.run_in_executor(_image_download_pool, _download_image_sync, url)

    logger.info(f"Image downloaded: {image.size} {image.mode}")
    return image


async def proto_parts_to_content(
    message_parts: List[agent_worker_pb2.MessagePart]
) -> MessageContentList:
    """
    Convert protobuf MessageParts to ChatMessage content format.

    Returns list of content parts - ALWAYS list format (no string optimization).
    Frontend sends MessagePart[] arrays, we keep the same structure.

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        List of content parts (TextContentPart | ImageContentPart)

    Images are downloaded from S3 URLs and converted to PIL Image objects.
    Files (PDFs, audio, documents) are processed to extract text content.
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
            logger.info(f"Processing image URL: {image_url[:80]}...")

            try:
                pil_image = await download_image_from_url(image_url)
                content_parts.append(ImageContentPart(
                    type="image",
                    image=pil_image  # PIL Image object, not URL
                ))
                logger.info(f"Successfully added image to content: {pil_image.size} {pil_image.mode}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to download image from URL: {str(e)}")
                logger.warning("Skipping image, continuing with text-only message")
            except Exception as e:
                logger.error(f"Unexpected error processing image: {str(e)}")
                logger.warning("Skipping image, continuing with text-only message")

        elif part.HasField('file'):
            # Process file (PDF, Word, Excel, audio) and extract content
            file_url = part.file.url
            mime_type = part.file.mime_type
            filename = part.file.filename
            logger.info(f"Processing file: {filename} ({mime_type})")

            try:
                result = await process_file(file_url, mime_type, filename)

                # Add extracted text content
                if result.text:
                    content_parts.append(TextContentPart(
                        type="text",
                        text=result.text
                    ))
                    logger.info(f"Extracted text from file: {len(result.text)} chars")

                # Add page images (scanned PDFs → vision model)
                if result.images:
                    for img in result.images:
                        content_parts.append(ImageContentPart(
                            type="image",
                            image=img
                        ))
                    logger.info(f"Added {len(result.images)} page images from scanned file")

            except Exception as e:
                logger.error(f"Failed to process file: {str(e)}")
                content_parts.append(TextContentPart(
                    type="text",
                    text=f'<file_content filename="{filename}" type="error">\n(Processing failed: {str(e)})\n</file_content>'
                ))

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

    Detects both direct image_url parts and file parts with image mime types
    (e.g., images uploaded as file attachments).

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        True if images present, False otherwise
    """
    for part in message_parts:
        if part.HasField('image_url'):
            return True
        if part.HasField('file') and part.file.mime_type.startswith('image/'):
            return True
    return False


async def build_conversation_messages(
    history: List[agent_worker_pb2.HistoryMessage],
    current_message_parts: List[agent_worker_pb2.MessagePart]
) -> List[ChatMessage]:
    """
    Build complete conversation as ChatMessage objects.

    Combines conversation history with current user message.
    Supports multimodal messages with PIL Image objects for vision models.
    Processes file attachments (PDFs, audio, documents) to extract text.

    Args:
        history: Previous messages from conversation history
        current_message_parts: Current user message parts

    Returns:
        List of ChatMessage objects ready for processing
    """
    messages = []

    # Add conversation history
    for hist_msg in history:
        content = await proto_parts_to_content(hist_msg.content_parts)
        messages.append(ChatMessage(
            role=MessageRole(hist_msg.role.lower()),
            content=content
        ))

    # Add current user message
    content = await proto_parts_to_content(current_message_parts)
    messages.append(ChatMessage(
        role=MessageRole.USER,
        content=content
    ))

    return messages


def format_clarifying_questions(questions: "List[ClarifyingQuestion]") -> List[Dict[str, Any]]:
    """
    Format ClarifyingQuestion objects as structured data for serialization.

    Args:
        questions: List of ClarifyingQuestion dataclass objects

    Returns:
        List of dicts with questionId, question, questionType, required, allowOther,
        and optional options/context
    """
    questions_data: List[Dict[str, Any]] = []
    for i, q in enumerate(questions):
        q_dict: Dict[str, Any] = {
            "questionId": f"q_{i}",
            "question": q.question,
            "questionType": q.question_type,  # 'text' | 'single_select' | 'multi_select'
            "required": q.required,
            "allowOther": q.allow_other,  # Show "Or type your own..." option
        }
        if q.options:
            q_dict["options"] = q.options
        if q.context:
            q_dict["context"] = q.context
        questions_data.append(q_dict)
    return questions_data
