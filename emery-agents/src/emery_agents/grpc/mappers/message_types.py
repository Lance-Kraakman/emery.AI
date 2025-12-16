"""
Message content type definitions for smolagents ChatMessage format.

AIDEV-NOTE: Smolagents does not export TypedDict definitions for content parts.
These types document the implicit structure used by smolagents internally.
Based on smolagents/models.py and smolagents/agents.py usage patterns.

References:
- smolagents ChatMessage.content: str | list[dict[str, Any]]
- Content parts follow pattern: {"type": "text|image|image_url", ...}
- Images use PIL.Image.Image objects internally
"""
from typing import TypedDict, Literal
from PIL import Image


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
