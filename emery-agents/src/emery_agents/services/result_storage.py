"""
Result Storage Service

Manages storage of large tool outputs externally, keeping only summaries in context.
Reduces context window usage by offloading large results to storage.
"""

import json
import logging
import uuid
from dataclasses import dataclass
from typing import Optional, Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class StoredResult:
    """
    Represents a stored result with summary for context.

    The full data is stored externally, while only the summary
    is kept in the agent's context window.
    """
    id: str
    summary: str
    size: int
    record_count: Optional[int] = None
    storage_path: Optional[str] = None
    content_type: str = "application/json"

    def to_context_string(self) -> str:
        """
        Generate context-friendly string representation.

        This is what gets included in the agent's context instead
        of the full result.
        """
        lines = [self.summary]
        if self.record_count is not None:
            lines.append(f"Records: {self.record_count}")
        lines.append(f"Size: {self._format_size(self.size)}")
        lines.append(f"Stored as: {self.id}")
        return "\n".join(lines)

    def _format_size(self, size: int) -> str:
        """Format size in human-readable form."""
        if size < 1024:
            return f"{size} bytes"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "summary": self.summary,
            "size": self.size,
            "recordCount": self.record_count,
            "storagePath": self.storage_path,
            "contentType": self.content_type,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StoredResult":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            summary=data["summary"],
            size=data["size"],
            record_count=data.get("recordCount"),
            storage_path=data.get("storagePath"),
            content_type=data.get("contentType", "application/json"),
        )


class ResultStorageService:
    """
    Manages storage of large tool outputs.

    When tool results exceed configured thresholds, they are stored
    externally and only a summary is kept in context. This helps
    manage context window limits for LLMs.
    """

    # Default thresholds for offloading
    DEFAULT_CHAR_THRESHOLD = 2000  # Characters
    DEFAULT_RECORD_THRESHOLD = 50  # List items

    def __init__(
        self,
        api_client: Optional[Any] = None,
        char_threshold: int = DEFAULT_CHAR_THRESHOLD,
        record_threshold: int = DEFAULT_RECORD_THRESHOLD,
    ):
        """
        Initialize result storage service.

        Args:
            api_client: Client for API calls to store results
            char_threshold: Character count threshold for offloading
            record_threshold: Record count threshold for offloading lists
        """
        self.api_client = api_client
        self.char_threshold = char_threshold
        self.record_threshold = record_threshold
        # In-memory cache for results (fallback when no API client)
        self._cache: Dict[str, str] = {}

    def should_offload(self, result: str) -> bool:
        """
        Determine if a result should be offloaded to storage.

        Args:
            result: The result string to check

        Returns:
            True if the result should be offloaded
        """
        # Check character threshold
        if len(result) > self.char_threshold:
            return True

        # Check record count for JSON arrays
        try:
            data = json.loads(result)
            if isinstance(data, list) and len(data) > self.record_threshold:
                return True
        except (json.JSONDecodeError, TypeError):
            pass

        return False

    async def store(
        self,
        result: str,
        context: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> StoredResult:
        """
        Store a result and return a summary reference.

        Args:
            result: The full result to store
            context: Optional context about what generated this result
            task_id: Optional task ID for grouping results

        Returns:
            StoredResult with summary for context inclusion
        """
        result_id = str(uuid.uuid4())
        summary = self._generate_summary(result)
        record_count = self._count_records(result)
        size = len(result.encode('utf-8'))

        # Store via API if available
        storage_path = None
        if self.api_client:
            try:
                response = await self.api_client.store_result(
                    result_id=result_id,
                    content=result,
                    summary=summary,
                    task_id=task_id,
                    record_count=record_count,
                )
                storage_path = response.get("path")
                logger.info(f"Stored result {result_id} via API: {storage_path}")
            except Exception as e:
                logger.warning(f"Failed to store via API, using cache: {e}")
                self._cache[result_id] = result
        else:
            # Fallback to in-memory cache
            self._cache[result_id] = result
            logger.debug(f"Stored result {result_id} in memory cache")

        return StoredResult(
            id=result_id,
            summary=summary,
            size=size,
            record_count=record_count,
            storage_path=storage_path,
        )

    async def retrieve(self, result_id: str) -> Optional[str]:
        """
        Retrieve a stored result by ID.

        Args:
            result_id: ID of the stored result

        Returns:
            Full result content, or None if not found
        """
        # Try API first
        if self.api_client:
            try:
                response = await self.api_client.get_result(result_id)
                if response:
                    return response.get("content")
            except Exception as e:
                logger.warning(f"Failed to retrieve via API: {e}")

        # Fallback to cache
        return self._cache.get(result_id)

    def _generate_summary(self, result: str, max_length: int = 500) -> str:
        """
        Generate a concise summary of the result.

        Args:
            result: Full result to summarize
            max_length: Maximum length of summary

        Returns:
            Human-readable summary
        """
        try:
            data = json.loads(result)

            if isinstance(data, list):
                if len(data) == 0:
                    return "Empty list (0 items)"

                # Describe list contents
                sample = data[0]
                if isinstance(sample, dict):
                    keys = list(sample.keys())[:5]
                    return (
                        f"List of {len(data)} items. "
                        f"Fields: {', '.join(keys)}"
                        f"{' ...' if len(sample.keys()) > 5 else ''}"
                    )
                else:
                    return f"List of {len(data)} {type(sample).__name__} items"

            elif isinstance(data, dict):
                keys = list(data.keys())[:10]
                return (
                    f"Object with {len(data.keys())} keys: "
                    f"{', '.join(keys)}"
                    f"{' ...' if len(data.keys()) > 10 else ''}"
                )

        except (json.JSONDecodeError, TypeError):
            pass

        # Plain text - truncate
        if len(result) > max_length:
            return result[:max_length] + f"... [{len(result) - max_length} more chars]"

        return result

    def _count_records(self, result: str) -> Optional[int]:
        """
        Count records if result is a JSON array.

        Args:
            result: Result string to count

        Returns:
            Number of records, or None if not a list
        """
        try:
            data = json.loads(result)
            if isinstance(data, list):
                return len(data)
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    def format_offloaded_result(
        self,
        stored: StoredResult,
        tool_name: str,
    ) -> str:
        """
        Format an offloaded result for inclusion in agent response.

        Args:
            stored: The stored result reference
            tool_name: Name of the tool that produced the result

        Returns:
            Formatted string for agent context
        """
        return (
            f"SUCCESS: {tool_name} completed\n"
            f"{stored.to_context_string()}\n"
            f"Use result ID '{stored.id}' to retrieve full data if needed."
        )

    def clear_cache(self) -> None:
        """Clear the in-memory result cache."""
        self._cache.clear()
        logger.debug("Cleared result storage cache")


class ResultStorageServiceFactory:
    """Factory for creating ResultStorageService instances."""

    def __init__(
        self,
        api_client: Optional[Any] = None,
        char_threshold: int = ResultStorageService.DEFAULT_CHAR_THRESHOLD,
        record_threshold: int = ResultStorageService.DEFAULT_RECORD_THRESHOLD,
    ):
        """
        Initialize factory.

        Args:
            api_client: API client to use for all services
            char_threshold: Default character threshold
            record_threshold: Default record threshold
        """
        self.api_client = api_client
        self.char_threshold = char_threshold
        self.record_threshold = record_threshold

    def create(
        self,
        char_threshold: Optional[int] = None,
        record_threshold: Optional[int] = None,
    ) -> ResultStorageService:
        """
        Create a ResultStorageService instance.

        Args:
            char_threshold: Optional override for character threshold
            record_threshold: Optional override for record threshold

        Returns:
            Configured ResultStorageService
        """
        return ResultStorageService(
            api_client=self.api_client,
            char_threshold=char_threshold or self.char_threshold,
            record_threshold=record_threshold or self.record_threshold,
        )
