from abc import ABC, abstractmethod
from typing import Any, Optional, Union, Dict
from ...domain.entities.models import ToolConfig

class IToolRepository(ABC):
    """
    Abstract interface for a tool repository.
    """

    @abstractmethod
    def create_tool_instance(self, tool_config: Union[ToolConfig, Dict[str, Any]]) -> Optional[Any]:
        """
        Creates an instance of a tool from a given configuration.
        """
        pass
