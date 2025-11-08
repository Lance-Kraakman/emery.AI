"""
File Processor Service

Extracts text content from various file types (PDFs, documents, audio).
Uses simple text extraction approach - downloads files and extracts content.

AIDEV-NOTE: Simple text extraction for files < 32k tokens. No embeddings/RAG initially.
Can be extended with RAG support for large documents if needed.
"""
import logging
from io import BytesIO
from typing import Optional

import httpx
import pymupdf  # PyMuPDF for PDF processing

from .transcription_service import transcribe_audio

logger = logging.getLogger(__name__)

# AIDEV-NOTE: Max file size for direct text extraction (10MB)
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


class FileProcessingError(Exception):
    """Raised when file processing fails."""
    pass


class FileTooLargeError(FileProcessingError):
    """Raised when file exceeds size limit."""
    pass


async def download_file(url: str, max_size: int = MAX_FILE_SIZE_BYTES) -> bytes:
    """
    Download file from URL with size limit.

    Args:
        url: Pre-signed S3 URL or other file URL
        max_size: Maximum file size in bytes

    Returns:
        File content as bytes

    Raises:
        FileProcessingError: If download fails
        FileTooLargeError: If file exceeds size limit
    """
    logger.info(f"📥 Downloading file from URL: {url[:80]}...")

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream('GET', url, timeout=30.0) as response:
                response.raise_for_status()

                # Check content length if available
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > max_size:
                    raise FileTooLargeError(
                        f"File size {int(content_length)} bytes exceeds limit {max_size} bytes"
                    )

                # Stream download with size checking
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > max_size:
                        raise FileTooLargeError(
                            f"File size exceeds limit {max_size} bytes during download"
                        )

                logger.info(f"✅ Downloaded {len(content)} bytes")
                return bytes(content)

    except httpx.HTTPError as e:
        logger.error(f"❌ Failed to download file: {str(e)}")
        raise FileProcessingError(f"Download failed: {str(e)}") from e


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using PyMuPDF.

    Args:
        pdf_bytes: PDF file content

    Returns:
        Extracted text content

    Raises:
        FileProcessingError: If PDF processing fails
    """
    logger.info("📄 Extracting text from PDF")

    try:
        # Open PDF from bytes
        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")

        # Extract text from all pages
        text_parts = []
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text = page.get_text()
            if text.strip():
                text_parts.append(f"--- Page {page_num + 1} ---\n{text}")

        pdf_document.close()

        full_text = "\n\n".join(text_parts)
        logger.info(f"✅ Extracted {len(full_text)} characters from {pdf_document.page_count} pages")

        return full_text

    except Exception as e:
        logger.error(f"❌ PDF extraction failed: {str(e)}")
        raise FileProcessingError(f"PDF processing failed: {str(e)}") from e


def extract_text_from_text_file(file_bytes: bytes, encoding: str = 'utf-8') -> str:
    """
    Extract text from plain text file.

    Args:
        file_bytes: File content
        encoding: Text encoding (default: utf-8)

    Returns:
        File content as string

    Raises:
        FileProcessingError: If text decoding fails
    """
    logger.info(f"📝 Extracting text from file (encoding: {encoding})")

    try:
        text = file_bytes.decode(encoding)
        logger.info(f"✅ Extracted {len(text)} characters")
        return text
    except UnicodeDecodeError as e:
        logger.error(f"❌ Text decoding failed: {str(e)}")
        raise FileProcessingError(f"Text decoding failed: {str(e)}") from e


async def process_file(url: str, mime_type: str, filename: str) -> str:
    """
    Process file and extract text content based on MIME type.

    Routes to appropriate processor:
    - application/pdf → PyMuPDF extraction
    - text/* → Direct text read
    - audio/* → Transcription service (not implemented yet)

    Args:
        url: File URL (S3 pre-signed URL)
        mime_type: MIME type (e.g., "application/pdf")
        filename: Original filename

    Returns:
        Extracted text content

    Raises:
        FileProcessingError: If processing fails
        FileTooLargeError: If file exceeds size limit
    """
    logger.info(f"🔧 Processing file: {filename} (type: {mime_type})")

    # Download file
    file_bytes = await download_file(url)

    # Route by MIME type
    if mime_type == 'application/pdf':
        text = extract_text_from_pdf(file_bytes)
        return f"[PDF: {filename}]\n\n{text}"

    elif mime_type.startswith('text/'):
        text = extract_text_from_text_file(file_bytes)
        return f"[Text File: {filename}]\n\n{text}"

    elif mime_type.startswith('audio/'):
        # Transcribe audio using HuggingFace Whisper
        try:
            text = await transcribe_audio(file_bytes)
            return f"[Audio File: {filename}]\n\nTranscription:\n{text}"
        except Exception as e:
            logger.error(f"❌ Audio transcription failed: {str(e)}")
            return f"[Audio File: {filename}] (Transcription failed: {str(e)})"

    else:
        logger.warning(f"⚠️ Unsupported MIME type: {mime_type}")
        return f"[File: {filename}] (Type {mime_type} not supported for text extraction)"
