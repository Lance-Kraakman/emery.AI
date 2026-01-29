"""
Message content type definitions for chat messages.

DSPy Migration: These types replace smolagents ChatMessage format.
Used for conversation handling and message processing.

References:
- ChatMessage.content: list[dict[str, Any]] (content parts)
- Content parts follow pattern: {"type": "text|image|image_url", ...}
- Images use PIL.Image.Image objects internally
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, List, TypedDict, Literal, Optional
from PIL import Image


class MessageRole(str, Enum):
    """Role of a message in a conversation."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


@dataclass
class ChatMessage:
    """
    Chat message for conversations.

    Replaces smolagents ChatMessage. Used for message handling
    in the chat processing flow.
    """
    role: MessageRole
    content: "MessageContentList"
    name: Optional[str] = None
    tool_call_id: Optional[str] = None

    @classmethod
    def user(cls, content: "MessageContentList") -> "ChatMessage":
        """Create a user message."""
        return cls(role=MessageRole.USER, content=content)

    @classmethod
    def assistant(cls, content: "MessageContentList") -> "ChatMessage":
        """Create an assistant message."""
        return cls(role=MessageRole.ASSISTANT, content=content)

    @classmethod
    def system(cls, content: "MessageContentList") -> "ChatMessage":
        """Create a system message."""
        return cls(role=MessageRole.SYSTEM, content=content)


class TextContentPart(TypedDict):
    """
    Text content part for ChatMessage.

    Example:
        {"type": "text", "text": "Hello, how are you?"}
    """
    type: Literal["text"]
    text: str


class ImageContentPart(TypedDict):
    """
    Image content part for ChatMessage (uses PIL.Image).

    AIDEV-NOTE: This is the internal format used by smolagents.
    PIL Images must be converted to base64 data URLs before sending to HuggingFace API.

    Example:
        {"type": "image", "image": <PIL.Image.Image object>}
    """
    type: Literal["image"]
    image: Image.Image


class ImageUrlContentPart(TypedDict):
    """
    Image URL content part (HuggingFace API format after base64 conversion).

    This is the format expected by HuggingFace Inference API for vision models.

    Example:
        {
            "type": "image_url",
            "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."}
        }
    """
    type: Literal["image_url"]
    image_url: dict  # {"url": str}


# Union type for all content parts
ContentPart = TextContentPart | ImageContentPart | ImageUrlContentPart

# Message content: always list of parts (no string optimization)
# AIDEV-NOTE: We use list format consistently to match frontend MessagePart[] structure
MessageContentList = list[ContentPart]
