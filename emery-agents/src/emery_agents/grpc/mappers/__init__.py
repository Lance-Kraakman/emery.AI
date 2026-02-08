"""
Message mappers for converting between protobuf and domain formats.
"""

from .message_mapper import (
    build_conversation_messages,
    download_image_from_url,
    extract_text_from_parts,
    format_clarifying_questions,
    has_images,
    proto_parts_to_content,
)
from .message_types import (
    ContentPart,
    ImageContentPart,
    ImageUrlContentPart,
    MessageContentList,
    TextContentPart,
)
from .proto_mapper import (
    CancelTaskRequestDict,
    CancelTaskResponseDict,
    ProtoMapper,
    TaskProgressDict,
    WorkerInfoDict,
)

__all__ = [
    # Message mapping functions (chat/vision)
    "download_image_from_url",
    "proto_parts_to_content",
    "extract_text_from_parts",
    "has_images",
    "build_conversation_messages",
    # ProtoMapper class and types (agent worker)
    "ProtoMapper",
    "TaskProgressDict",
    "WorkerInfoDict",
    "CancelTaskRequestDict",
    "CancelTaskResponseDict",
    # Message content types
    "TextContentPart",
    "ImageContentPart",
    "ImageUrlContentPart",
    "ContentPart",
    "MessageContentList",
    # Question formatting
    "format_clarifying_questions",
]
