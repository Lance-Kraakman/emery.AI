"""
Base Inference Client Interface

AIDEV-NOTE: Abstract interface for inference clients that handle direct model invocation.
Implementations handle specific providers (HuggingFace, Replicate, etc.).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING

if TYPE_CHECKING:
    from emery_agents.entities.task import SkillOutputValue
from enum import Enum


class TaskResultType(str, Enum):
    """Types of results from task execution."""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    JSON = "json"
    EMBEDDING = "embedding"


@dataclass
class TaskResult:
    """
    Result from a task model execution.

    Attributes:
        type: The type of result (text, image, audio, json, embedding)
        data: The result data (bytes for binary, str for text, list for embedding, dict for json)
        metadata: Optional metadata about the result (e.g., dimensions, duration)
    """
    type: TaskResultType
    data: Union[bytes, str, list[Any], dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None

    @property
    def is_binary(self) -> bool:
        """Check if result is binary data (image/audio/video)."""
        return self.type in (TaskResultType.IMAGE, TaskResultType.AUDIO, TaskResultType.VIDEO)

    @property
    def is_text(self) -> bool:
        """Check if result is text."""
        return self.type == TaskResultType.TEXT

    @property
    def is_structured(self) -> bool:
        """Check if result is structured data (json/embedding)."""
        return self.type in (TaskResultType.JSON, TaskResultType.EMBEDDING)

    def to_skill_outputs(self) -> List["SkillOutputValue"]:
        """
        Convert TaskResult to SkillOutputValue list for output mapping.

        This centralizes the transformation logic that was previously duplicated
        in agent_executor.py and skill_executor.py.

        Returns:
            List of SkillOutputValue for output mapping service
        """
        from emery_agents.entities.task import SkillOutputValue

        outputs: List[SkillOutputValue] = []

        if self.is_structured and isinstance(self.data, dict):
            # Dict result: each key becomes an output
            for name, value in self.data.items():
                outputs.append(SkillOutputValue(name=name, value=value))
        elif self.is_structured and isinstance(self.data, list):
            # List result: preserve array items with indexed names
            for i, item in enumerate(self.data):
                if isinstance(item, dict):
                    # If item is a dict, flatten with index suffix
                    for name, value in item.items():
                        outputs.append(SkillOutputValue(name=f"{name}_{i}", value=value))
                else:
                    # Primitive items get indexed name
                    outputs.append(SkillOutputValue(name=f"item_{i}", value=item))
        elif self.is_text:
            outputs.append(SkillOutputValue(name="text", value=str(self.data)))
        else:
            outputs.append(SkillOutputValue(name="value", value=self.data))

        return outputs


class BaseInferenceClient(ABC):
    """
    Abstract base class for inference clients.

    Each implementation handles a specific provider's API for task execution.
    The execute_task method routes to the appropriate task-specific method
    based on task_type.
    """

    @abstractmethod
    async def execute_task(
        self,
        model_id: str,
        task_type: str,
        inputs: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None
    ) -> TaskResult:
        """
        Execute a task using the specified model.

        Args:
            model_id: The model identifier (e.g., 'black-forest-labs/FLUX.1-schnell')
            task_type: The type of task (e.g., 'text-to-image', 'speech-to-text')
            inputs: Input data for the task (keys vary by task type)
            parameters: Optional model-specific parameters

        Returns:
            TaskResult containing the output data and metadata

        Raises:
            ValueError: If task_type is not supported
            RuntimeError: If model execution fails
        """
        pass

    @abstractmethod
    def supports_task_type(self, task_type: str) -> bool:
        """
        Check if this client supports a specific task type.

        Args:
            task_type: The task type to check

        Returns:
            True if supported, False otherwise
        """
        pass

    @property
    @abstractmethod
    def supported_task_types(self) -> list[str]:
        """List of task types this client supports."""
        pass
