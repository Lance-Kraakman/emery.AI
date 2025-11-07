"""
Message mappers for converting between protobuf and domain formats.
"""

from .message_mapper import (
    download_image_from_url,
    proto_parts_to_smolagents_content,
    extract_text_from_parts,
    has_images,
    build_conversation_messages,
)

from .proto_mapper import (
    ProtoMapper,
    TaskProgressDict,
    WorkerInfoDict,
    CancelTaskRequestDict,
    CancelTaskResponseDict,
)

__all__ = [
    # Message mapping functions (chat/vision)
    'download_image_from_url',
    'proto_parts_to_smolagents_content',
    'extract_text_from_parts',
    'has_images',
    'build_conversation_messages',
    # ProtoMapper class and types (agent worker)
    'ProtoMapper',
    'TaskProgressDict',
    'WorkerInfoDict',
    'CancelTaskRequestDict',
    'CancelTaskResponseDict',
]
