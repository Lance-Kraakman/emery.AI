"""
HTTP Module

HTTP and external communication services.

- AuthenticatedHttpClient: HTTP client with auth headers
- Transcription functions for audio to text conversion
"""

from .client import AuthenticatedHttpClient
from .transcription import (
    TranscriptionError,
    transcribe_audio,
    transcribe_audio_from_url,
)


__all__ = [
    # Client
    "AuthenticatedHttpClient",
    # Transcription
    "TranscriptionError",
    "transcribe_audio",
    "transcribe_audio_from_url",
]
