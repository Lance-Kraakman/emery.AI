"""
File Processor Service

Extracts text content from various file types (PDFs, Word docs, Excel, audio).
Downloads files from S3 URLs and routes to type-specific extractors.

Returns FileProcessingResult with extracted text and optionally page images
(for scanned PDFs that have no text layer — sent to vision model for OCR).
"""
import logging
from dataclasses import dataclass, field
from io import BytesIO
from typing import List

import httpx
import pymupdf
from PIL import Image
from docx import Document as DocxDocument
import openpyxl

from ..http import transcribe_audio

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB

# Minimum extracted text length to consider a PDF as having real text content.
# Below this threshold for a multi-page doc, we treat it as scanned/image-only.
SCANNED_PDF_TEXT_THRESHOLD = 100


@dataclass
class FileProcessingResult:
    """Result of file processing — text content and optionally page images."""
    text: str
    images: List[Image.Image] = field(default_factory=list)
    filename: str = ""
    is_scanned: bool = False


class FileProcessingError(Exception):
    """Raised when file processing fails."""
    pass


class FileTooLargeError(FileProcessingError):
    """Raised when file exceeds size limit."""
    pass


async def download_file(url: str, max_size: int = MAX_FILE_SIZE_BYTES) -> bytes:
    """Download file from URL with size limit."""
    logger.info(f"Downloading file from URL: {url[:80]}...")

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream('GET', url, timeout=30.0) as response:
                response.raise_for_status()

                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > max_size:
                    raise FileTooLargeError(
                        f"File size {int(content_length)} bytes exceeds limit {max_size} bytes"
                    )

                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > max_size:
                        raise FileTooLargeError(
                            f"File size exceeds limit {max_size} bytes during download"
                        )

                logger.info(f"Downloaded {len(content)} bytes")
                return bytes(content)

    except httpx.HTTPError as e:
        logger.error(f"Failed to download file: {str(e)}")
        raise FileProcessingError(f"Download failed: {str(e)}") from e


def extract_text_from_pdf(pdf_bytes: bytes) -> FileProcessingResult:
    """
    Extract text from PDF using PyMuPDF.

    For scanned/image PDFs (no text layer), extracts page images instead
    so the vision model can read them.
    """
    logger.info("Extracting text from PDF")

    try:
        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page_count = pdf_document.page_count

        # Extract text from all pages
        text_parts = []
        for page_num in range(page_count):
            page = pdf_document[page_num]
            text = page.get_text()
            if text.strip():
                text_parts.append(f"--- Page {page_num + 1} ---\n{text}")

        full_text = "\n\n".join(text_parts)

        # Check if this is a scanned PDF (no meaningful text extracted)
        if len(full_text.strip()) < SCANNED_PDF_TEXT_THRESHOLD and page_count > 0:
            logger.info(f"PDF has {len(full_text)} chars text across {page_count} pages — treating as scanned, extracting page images")
            page_images: List[Image.Image] = []
            for page_num in range(page_count):
                page = pdf_document[page_num]
                pix = page.get_pixmap(dpi=150)
                img = Image.open(BytesIO(pix.tobytes("png")))
                page_images.append(img)

            pdf_document.close()
            return FileProcessingResult(
                text="",
                images=page_images,
                is_scanned=True,
            )

        pdf_document.close()
        logger.info(f"Extracted {len(full_text)} characters from {page_count} pages")
        return FileProcessingResult(text=full_text)

    except Exception as e:
        logger.error(f"PDF extraction failed: {str(e)}")
        raise FileProcessingError(f"PDF processing failed: {str(e)}") from e


def extract_text_from_text_file(file_bytes: bytes, encoding: str = 'utf-8') -> str:
    """Extract text from plain text file."""
    try:
        text = file_bytes.decode(encoding)
        logger.info(f"Extracted {len(text)} characters from text file")
        return text
    except UnicodeDecodeError as e:
        raise FileProcessingError(f"Text decoding failed: {str(e)}") from e


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from Word (.docx) document including paragraphs and tables."""
    logger.info("Extracting text from Word document")

    try:
        doc = DocxDocument(BytesIO(file_bytes))
        parts: List[str] = []

        for para in doc.paragraphs:
            if para.text.strip():
                parts.append(para.text)

        # Extract table content as pipe-delimited rows
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                parts.append(" | ".join(cells))

        text = "\n".join(parts)
        logger.info(f"Extracted {len(text)} characters from Word document")
        return text

    except Exception as e:
        logger.error(f"Word document extraction failed: {str(e)}")
        raise FileProcessingError(f"Word document processing failed: {str(e)}") from e


def extract_text_from_xlsx(file_bytes: bytes) -> str:
    """Extract text from Excel (.xlsx) spreadsheet as markdown tables."""
    logger.info("Extracting text from Excel spreadsheet")

    try:
        wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
        parts: List[str] = []

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            parts.append(f"## Sheet: {sheet_name}")
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                parts.append(" | ".join(cells))

        wb.close()
        text = "\n".join(parts)
        logger.info(f"Extracted {len(text)} characters from Excel spreadsheet")
        return text

    except Exception as e:
        logger.error(f"Excel extraction failed: {str(e)}")
        raise FileProcessingError(f"Excel processing failed: {str(e)}") from e


def _wrap_content(filename: str, file_type: str, text: str, note: str = "") -> str:
    """Wrap extracted content in XML tags so the LLM treats it as inline content."""
    note_attr = f' note="{note}"' if note else ""
    return f'<file_content filename="{filename}" type="{file_type}"{note_attr}>\n{text}\n</file_content>'


async def process_file(url: str, mime_type: str, filename: str) -> FileProcessingResult:
    """
    Process file and extract content based on MIME type.

    Routes to appropriate processor:
    - application/pdf → PyMuPDF (text + scanned fallback to page images)
    - text/* → Direct text read
    - audio/* → Transcription service
    - Word (.docx/.doc) → python-docx extraction
    - Excel (.xlsx/.xls) → openpyxl extraction
    """
    logger.info(f"Processing file: {filename} (type: {mime_type})")

    file_bytes = await download_file(url)

    # --- PDF ---
    if mime_type == 'application/pdf':
        result = extract_text_from_pdf(file_bytes)
        result.filename = filename

        if result.is_scanned:
            result.text = _wrap_content(
                filename, "pdf", "(no text content)",
                note="Scanned PDF - no text could be extracted. Page images are attached for visual analysis.",
            )
        else:
            result.text = _wrap_content(filename, "pdf", result.text)
        return result

    # --- Text ---
    if mime_type.startswith('text/'):
        text = extract_text_from_text_file(file_bytes)
        return FileProcessingResult(
            text=_wrap_content(filename, "text", text),
            filename=filename,
        )

    # --- Audio ---
    if mime_type.startswith('audio/'):
        try:
            text = await transcribe_audio(file_bytes, content_type=mime_type)
            return FileProcessingResult(
                text=_wrap_content(filename, "audio", f"Transcription:\n{text}"),
                filename=filename,
            )
        except Exception as e:
            logger.error(f"Audio transcription failed: {str(e)}")
            return FileProcessingResult(
                text=_wrap_content(filename, "audio", f"(Transcription failed: {str(e)})"),
                filename=filename,
            )

    # --- Word documents ---
    if mime_type in (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
    ):
        text = extract_text_from_docx(file_bytes)
        return FileProcessingResult(
            text=_wrap_content(filename, "document", text),
            filename=filename,
        )

    # --- Excel spreadsheets ---
    if mime_type in (
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
    ):
        text = extract_text_from_xlsx(file_bytes)
        return FileProcessingResult(
            text=_wrap_content(filename, "spreadsheet", text),
            filename=filename,
        )

    # --- Unsupported ---
    logger.warning(f"Unsupported MIME type: {mime_type}")
    return FileProcessingResult(
        text=_wrap_content(filename, mime_type, f"(Type {mime_type} not supported for text extraction)"),
        filename=filename,
    )
