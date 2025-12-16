"""
Audio Transcription Service

Transcribes audio files using HuggingFace Whisper API.
Supports various audio formats (mp3, wav, m4a, etc.).

AIDEV-NOTE: Uses raw httpx with explicit content-type header because
the InferenceClient doesn't set content-type when passing raw bytes,
causing "Content type None not supported" errors with the router endpoint.
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# AIDEV-NOTE: Default Whisper model for transcription
DEFAULT_WHISPER_MODEL = "openai/whisper-large-v3"

# Max audio file size for transcription (25MB - HF API limit)
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024

# Default content-type if not provided
DEFAULT_AUDIO_CONTENT_TYPE = "audio/mpeg"


class TranscriptionError(Exception):
    """Raised when audio transcription fails."""
    pass


async def transcribe_audio(
    audio_bytes: bytes,
    model_id: Optional[str] = None,
    language: Optional[str] = None,
    content_type: Optional[str] = None
) -> str:
    """
    Transcribe audio using HuggingFace Inference API.

    Args:
        audio_bytes: Audio file content
        model_id: Optional Whisper model ID (default: openai/whisper-large-v3)
        language: Optional language code (e.g., "en", "es")
        content_type: MIME type of the audio (e.g., "audio/mpeg", "audio/wav")

    Returns:
        Transcribed text

    Raises:
        TranscriptionError: If transcription fails
    """
    model_id = model_id or DEFAULT_WHISPER_MODEL
    hf_token = os.getenv('HF_TOKEN')

    if not hf_token:
        raise TranscriptionError("HF_TOKEN environment variable not set")

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise TranscriptionError(
            f"Audio file size {len(audio_bytes)} bytes exceeds limit {MAX_AUDIO_SIZE_BYTES} bytes"
        )

    # Use provided content-type or default to audio/mpeg
    audio_content_type = content_type or DEFAULT_AUDIO_CONTENT_TYPE
    logger.info(f"🎙️ Transcribing audio ({len(audio_bytes)} bytes, {audio_content_type}) with model: {model_id}")

    try:
        # AIDEV-NOTE: Use raw httpx with explicit content-type header
        # The InferenceClient doesn't set content-type for raw bytes, causing 400 errors
        # Check for custom endpoint (e.g., dedicated inference endpoint)
        custom_endpoint = os.getenv('WHISPER_ENDPOINT')
        if custom_endpoint:
            endpoint = custom_endpoint
        else:
            # Use HF Inference API endpoint (router handles routing)
            endpoint = f"https://router.huggingface.co/hf-inference/models/{model_id}"

        headers = {
            "Authorization": f"Bearer {hf_token}",
            "Content-Type": audio_content_type,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                endpoint,
                headers=headers,
                content=audio_bytes,
                timeout=120.0  # Transcription can take time for longer audio
            )

            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Transcription API error {response.status_code}: {error_text}")
                raise TranscriptionError(f"API error {response.status_code}: {error_text}")

            result = response.json()

            # Extract text from result
            if isinstance(result, dict) and 'text' in result:
                text = result['text']
            elif isinstance(result, str):
                text = result
            else:
                logger.error(f"❌ Unexpected response format: {result}")
                raise TranscriptionError(f"Unexpected API response format: {result}")

            logger.info(f"✅ Transcribed {len(text)} characters")
            return text

    except httpx.HTTPError as e:
        logger.error(f"❌ Transcription request failed: {str(e)}")
        raise TranscriptionError(f"Request failed: {str(e)}") from e
    except Exception as e:
        logger.error(f"❌ Transcription failed: {str(e)}")
        raise TranscriptionError(f"Transcription failed: {str(e)}") from e


async def transcribe_audio_from_url(
    url: str,
    model_id: Optional[str] = None,
    language: Optional[str] = None,
    content_type: Optional[str] = None
) -> str:
    """
    Download and transcribe audio from URL.

    Args:
        url: Audio file URL (S3 pre-signed URL)
        model_id: Optional Whisper model ID
        language: Optional language code
        content_type: Optional MIME type (will try to get from response headers if not provided)

    Returns:
        Transcribed text

    Raises:
        TranscriptionError: If download or transcription fails
    """
    logger.info(f"📥 Downloading audio from URL: {url[:80]}...")

    try:
        # Download audio file
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            audio_bytes = response.content

            # Try to get content-type from response headers if not provided
            if not content_type:
                content_type = response.headers.get('content-type', '').split(';')[0].strip()
                if content_type:
                    logger.info(f"📋 Got content-type from response: {content_type}")

        # Transcribe with content-type
        return await transcribe_audio(audio_bytes, model_id, language, content_type)

    except httpx.HTTPError as e:
        logger.error(f"❌ Failed to download audio: {str(e)}")
        raise TranscriptionError(f"Audio download failed: {str(e)}") from e
