"""
Audio Transcription Service

Transcribes audio files using HuggingFace Whisper API.
Supports various audio formats (mp3, wav, m4a, etc.).

AIDEV-NOTE: Uses HuggingFace Inference API with Whisper model.
User will configure dedicated endpoint for production use.
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


class TranscriptionError(Exception):
    """Raised when audio transcription fails."""
    pass


async def transcribe_audio(
    audio_bytes: bytes,
    model_id: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Transcribe audio using HuggingFace Whisper API.

    Args:
        audio_bytes: Audio file content
        model_id: Optional Whisper model ID (default: openai/whisper-large-v3)
        language: Optional language code (e.g., "en", "es")

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

    logger.info(f"🎙️ Transcribing audio ({len(audio_bytes)} bytes) with model: {model_id}")

    try:
        # AIDEV-NOTE: HuggingFace Inference API endpoint for audio transcription
        # User can configure dedicated endpoint by setting WHISPER_ENDPOINT env var
        # NOTE: api-inference.huggingface.co was deprecated Dec 2025, use router.huggingface.co
        endpoint = os.getenv('WHISPER_ENDPOINT') or f"https://router.huggingface.co/hf-inference/models/{model_id}"

        headers = {
            "Authorization": f"Bearer {hf_token}",
        }

        # Add language parameter if specified
        params = {}
        if language:
            params['language'] = language

        async with httpx.AsyncClient() as client:
            response = await client.post(
                endpoint,
                headers=headers,
                content=audio_bytes,
                params=params,
                timeout=60.0  # Transcription can take time
            )

            response.raise_for_status()
            result = response.json()

            # Extract transcribed text from response
            # AIDEV-NOTE: Response format: {"text": "transcribed text here"}
            if isinstance(result, dict) and 'text' in result:
                text = result['text']
                logger.info(f"✅ Transcribed {len(text)} characters")
                return text
            else:
                logger.error(f"❌ Unexpected response format: {result}")
                raise TranscriptionError(f"Unexpected API response format: {result}")

    except httpx.HTTPError as e:
        logger.error(f"❌ Transcription API request failed: {str(e)}")
        raise TranscriptionError(f"API request failed: {str(e)}") from e
    except Exception as e:
        logger.error(f"❌ Transcription failed: {str(e)}")
        raise TranscriptionError(f"Transcription failed: {str(e)}") from e


async def transcribe_audio_from_url(
    url: str,
    model_id: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Download and transcribe audio from URL.

    Args:
        url: Audio file URL (S3 pre-signed URL)
        model_id: Optional Whisper model ID
        language: Optional language code

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

        # Transcribe
        return await transcribe_audio(audio_bytes, model_id, language)

    except httpx.HTTPError as e:
        logger.error(f"❌ Failed to download audio: {str(e)}")
        raise TranscriptionError(f"Audio download failed: {str(e)}") from e
