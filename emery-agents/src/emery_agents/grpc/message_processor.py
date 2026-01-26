"""
Message Processing Utilities

Extracted from chat_processing_service.py for single responsibility.
Handles extraction of content from messages and building task prompts.
"""

import logging
from typing import List, Optional

from PIL import Image

from .mappers.message_types import ChatMessage, MessageContentList
from .generated import agent_worker_pb2
from ..services.image_processor import ImageProcessor

logger = logging.getLogger(__name__)


def extract_user_api_key_from_tools(tools: List['agent_worker_pb2.ToolConfig']) -> Optional[str]:
    """
    Extract user API key from enriched tool configs.

    The Next.js layer enriches tool configs with user API keys for authentication.
    This extracts the key so managed agents (like skill_builder) can reuse it.

    Args:
        tools: List of ToolConfig proto objects with config maps

    Returns:
        User API key string if found, None otherwise
    """
    for tool in tools:
        if tool.config:
            api_key = tool.config.get('api_key')
            if api_key and api_key.startswith('user_'):
                logger.debug(f"Extracted user API key from tool {tool.name}")
                return api_key
    logger.warning("No user API key found in tool configs")
    return None


def extract_file_attachments(
    message_parts: List['agent_worker_pb2.MessagePart']
) -> List['agent_worker_pb2.FileAttachment']:
    """
    Extract file attachments (audio, PDFs, etc.) from message parts.

    Used to pass file context to skills that need raw file bytes (e.g., speech-to-text).

    Args:
        message_parts: List of MessagePart from the request

    Returns:
        List of FileAttachment protos with url and mime_type
    """
    attachments = []
    for part in message_parts:
        if part.HasField('file'):
            attachment = agent_worker_pb2.FileAttachment(
                url=part.file.url,
                mime_type=part.file.mime_type
            )
            attachments.append(attachment)
    return attachments


def extract_images_from_message(message: ChatMessage) -> List[Image.Image]:
    """Extract PIL Image objects from ChatMessage content using shared utility."""
    return ImageProcessor.extract_images_from_message(message)


def extract_text_from_message(message: ChatMessage) -> str:
    """
    Extract text content from ChatMessage.

    Args:
        message: ChatMessage object with content as MessageContentList

    Returns:
        Combined text string (empty string if no text content)

    Used to extract text for task execution parameter.
    Content is always MessageContentList (list of content parts).
    """
    if not message or not message.content:
        return ""

    content: MessageContentList = message.content

    # Extract all text from content parts
    text_parts: List[str] = []
    for part in content:
        if part.get("type") == "text":
            text_parts.append(part["text"])

    return " ".join(text_parts).strip()


def build_task_with_conversation_context(
    conversation_messages: List[ChatMessage],
    system_prompt: str
) -> str:
    """
    Build task prompt with full conversation history.

    Since we create a NEW agent per request, agent memory doesn't persist
    between requests. Instead, we include the full conversation history
    in the task prompt itself.

    Args:
        conversation_messages: List of ChatMessage objects (user and assistant)
        system_prompt: System prompt to include as context

    Returns:
        Formatted task string with conversation history

    This is the key to context persistence - we manually format
    conversation history into the task prompt instead of relying on agent memory
    which doesn't persist across agent instances.
    """
    if not conversation_messages:
        return "Continue the conversation"

    # Build conversation history as text
    history_parts = []

    # Add system context at the beginning
    if system_prompt:
        history_parts.append(f"SYSTEM CONTEXT:\n{system_prompt}\n")

    # Add previous conversation (all but last message)
    if len(conversation_messages) > 1:
        history_parts.append("CONVERSATION HISTORY:")
        for msg in conversation_messages[:-1]:
            role = msg.role.value.upper()
            text = extract_text_from_message(msg)
            if text:
                history_parts.append(f"{role}: {text}")

    # Add current message as the task
    last_message = conversation_messages[-1]
    current_text = extract_text_from_message(last_message)

    if history_parts:
        # If we have history, format with clear separation
        history_str = "\n".join(history_parts)
        return f"{history_str}\n\nCURRENT USER MESSAGE:\n{current_text}"
    else:
        # First message in conversation
        return current_text
