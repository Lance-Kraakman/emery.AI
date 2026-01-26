"""
Message mappers for converting between protobuf and domain formats.
"""

from .message_mapper import (
    download_image_from_url,
    proto_parts_to_content,
    extract_text_from_parts,
    has_images,
    build_conversation_messages,
    format_clarifying_questions,
)

from .proto_mapper import (
    ProtoMapper,
    TaskProgressDict,
    WorkerInfoDict,
    CancelTaskRequestDict,
    CancelTaskResponseDict,
)

from .message_types import (
    TextContentPart,
    ImageContentPart,
    ImageUrlContentPart,
    ContentPart,
    MessageContentList,
)

__all__ = [
    # Message mapping functions (chat/vision)
    'download_image_from_url',
    'proto_parts_to_content',
    'extract_text_from_parts',
    'has_images',
    'build_conversation_messages',
    # ProtoMapper class and types (agent worker)
    'ProtoMapper',
    'TaskProgressDict',
    'WorkerInfoDict',
    'CancelTaskRequestDict',
    'CancelTaskResponseDict',
    # Message content types
    'TextContentPart',
    'ImageContentPart',
    'ImageUrlContentPart',
    'ContentPart',
    'MessageContentList',
    # Question formatting
    'format_clarifying_questions',
]
