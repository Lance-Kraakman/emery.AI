"""
Data Module

Data processing and storage services.

- ResultStorageService: External storage for large results
- OutputMappingService: Maps step outputs to skill outputs
- File processing utilities for various file types
- ImageProcessor: Image processing and attachment handling
"""

from .file_processor import (
    FileProcessingError,
    FileTooLargeError,
    download_file,
    extract_text_from_pdf,
    extract_text_from_text_file,
    process_file,
)
from .image_processor import ImageProcessor
from .output_mapping import MappingContext, OutputMappingService
from .result_storage import (
    ResultStorageService,
    ResultStorageServiceFactory,
    StoredResult,
)

__all__ = [
    # Result storage
    "StoredResult",
    "ResultStorageService",
    "ResultStorageServiceFactory",
    # Output mapping
    "MappingContext",
    "OutputMappingService",
    # File processing
    "FileProcessingError",
    "FileTooLargeError",
    "download_file",
    "extract_text_from_pdf",
    "extract_text_from_text_file",
    "process_file",
    # Image processing
    "ImageProcessor",
]
