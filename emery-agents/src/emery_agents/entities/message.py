"""
Message entity types — replace proto MessagePart, ImageAttachment, FileAttachment, TokenUsage.

Converted from proto at the gRPC boundary (agent_streaming / message_mapper).
Internal code uses these entities with isinstance() instead of proto HasField().
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Union


@dataclass
class TextPart:
    text: str


@dataclass
class ImagePart:
    url: str


@dataclass
class FilePart:
    url: str
    mime_type: str = ""
    filename: str = ""
    size: int = 0


MessagePart = Union[TextPart, ImagePart, FilePart]


@dataclass
class ImageAttachment:
    url: str
    s3_key: str = ""


@dataclass
class FileAttachment:
    type: str = ""
    url: str = ""
    filename: str = ""
    mime_type: str = ""


@dataclass
class HistoryMessage:
    """A message from conversation history, converted from proto at boundary."""

    role: str
    content_parts: list[MessagePart] = field(default_factory=list)
    timestamp: int = 0


@dataclass
class TokenUsage:
    model_name: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
