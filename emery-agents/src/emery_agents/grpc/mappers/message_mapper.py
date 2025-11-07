"""
Message Mapper

Converts between protobuf MessageParts and HuggingFace InferenceClient message formats.
Clean separation of concerns for message transformation logic.
"""
from typing import List, Dict, Any
from ...grpc.generated import agent_worker_pb2


def proto_parts_to_hf_content(message_parts: List[agent_worker_pb2.MessagePart]) -> List[Dict[str, Any]]:
    """
    Convert protobuf MessageParts to HuggingFace InferenceClient content format.

    Args:
        message_parts: List of protobuf MessagePart objects

    Returns:
        List of dicts with {"type": "text"|"image_url", ...} format for HF API
    """
    content = []

    for part in message_parts:
        if part.HasField('text'):
            content.append({
                "type": "text",
                "text": part.text.text
            })
        elif part.HasField('image_url'):
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": part.image_url.url
                }
            })

    return content


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


def proto_message_to_hf_message(
    role: str,
    content_parts: List[agent_worker_pb2.MessagePart]
) -> Dict[str, Any]:
    """
    Convert protobuf message to HuggingFace chat message format.

    Args:
        role: Message role (user, assistant, system)
        content_parts: List of protobuf MessagePart objects

    Returns:
        Dict with {"role": ..., "content": [...]} format for HF chat API
    """
    return {
        "role": role,
        "content": proto_parts_to_hf_content(content_parts)
    }


def build_conversation_messages(
    history: List[agent_worker_pb2.HistoryMessage],
    current_message_parts: List[agent_worker_pb2.MessagePart]
) -> List[Dict[str, Any]]:
    """
    Build complete conversation for HuggingFace InferenceClient.

    Combines conversation history with current user message.

    Args:
        history: Previous messages from conversation history
        current_message_parts: Current user message parts

    Returns:
        List of HuggingFace chat messages ready for model API call
    """
    messages = []

    # Add conversation history
    for hist_msg in history:
        messages.append(proto_message_to_hf_message(
            hist_msg.role,
            hist_msg.content_parts
        ))

    # Add current user message
    messages.append(proto_message_to_hf_message(
        'user',
        current_message_parts
    ))

    return messages
