"""
Unified Tool Loader

Loads tools from the unified metadata JSON file that serves as the single
source of truth for both frontend and backend tool configurations.
"""

import json
import os
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..grpc.generated.agent_worker_pb2 import ToolConfig


class UnifiedToolLoader:
    """Loads tools from the unified metadata containing both Pipedream and Emery tools."""

    def __init__(self, metadata_path: Optional[str] = None):
        """Initialize with path to unified metadata file."""
        if metadata_path is None:
            metadata_path = self._get_default_metadata_path()

        self.metadata_path = metadata_path
        self.unified_metadata = self._load_unified_metadata()
        self.tool_lookup = self._build_tool_lookup()

    def _get_default_metadata_path(self) -> str:
        """Get default path to unified metadata file."""
        current_dir = Path(__file__).parent
        # Navigate to tools directory where the metadata is generated
        metadata_path = current_dir.parent / "tools" / "unified_metadata.json"
        return str(metadata_path)

    def _load_unified_metadata(self) -> Dict[str, Any]:
        """Load the unified metadata file."""
        try:
            with open(self.metadata_path, 'r') as f:
                metadata = json.load(f)

            pipedream_count = len(metadata.get("pipedream_tools", {}))
            emery_count = len(metadata.get("emery_tools", {}))
            print(f"✅ Loaded unified metadata: {pipedream_count} Pipedream tools, {emery_count} Emery tools")
            return metadata
        except FileNotFoundError:
            print(f"⚠️  Unified metadata not found at {self.metadata_path}, using empty metadata")
            return {"pipedream_tools": {}, "emery_tools": {}}
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in unified metadata: {e}")
            return {"pipedream_tools": {}, "emery_tools": {}}

    def _build_tool_lookup(self) -> Dict[str, Dict[str, Any]]:
        """Build a lookup table of tool ID to tool configuration."""
        lookup = {}

        # Add Pipedream tools
        for tool_id, tool_config in self.unified_metadata.get("pipedream_tools", {}).items():
            lookup[tool_id] = {**tool_config, "source": "pipedream"}

        # Add Emery tools
        for tool_id, tool_config in self.unified_metadata.get("emery_tools", {}).items():
            lookup[tool_id] = {**tool_config, "source": "emery"}

        return lookup

    def get_available_tools(self, api_key_mode: str = "agent") -> List[str]:
        """Get list of available tool IDs."""
        return list(self.tool_lookup.keys())

    def get_tool_config(self, tool_id: str) -> Optional[Dict[str, Any]]:
        """Get tool configuration by ID."""
        return self.tool_lookup.get(tool_id)

    def load_tool(self, tool_config: ToolConfig, api_key: str = "", api_key_mode: str = "agent") -> Any:
        """Load a tool instance from ToolConfig using unified metadata."""
        # Convert tool name from hyphen to underscore format for lookup (frontend uses hyphens, backend uses underscores)
        tool_name_lookup = tool_config.name.replace("-", "_")

        # Look up tool in unified metadata
        unified_tool = self.get_tool_config(tool_name_lookup)
        if not unified_tool:
            # Try original name if hyphen version not found
            unified_tool = self.get_tool_config(tool_config.name)
            if not unified_tool:
                raise ValueError(f"Tool '{tool_config.name}' (also tried '{tool_name_lookup}') not found in unified metadata")

        source = unified_tool["source"]

        if source == "pipedream":
            return self._load_pipedream_tool(tool_config, unified_tool, api_key, api_key_mode)
        elif source == "emery":
            return self._load_emery_tool(tool_config, unified_tool, api_key, api_key_mode)
        else:
            raise ValueError(f"Unknown tool source: {source}")

    def _load_pipedream_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load a Pipedream tool using the unified configuration."""
        from ..tools.pipedream_tools import PipedreamTool

        if not api_key:
            raise ValueError(f"API key required for Pipedream tool '{tool_config.name}'")

        # Create a new ToolConfig with the API key in the config
        enhanced_config = ToolConfig(
            name=tool_config.name,
            version=tool_config.version,
            config={**tool_config.config, "api_key": api_key}
        )

        # Create Pipedream tool with enhanced config containing API key
        return PipedreamTool(
            tool_id=unified_tool["id"],
            config=enhanced_config
        )

    def _load_emery_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load an Emery tool using the unified configuration."""
        tool_id = unified_tool["id"]

        # Map tool IDs to their implementations
        emery_tool_mapping = {
            "file_reader": self._load_file_reader_tool,
            "calculator": self._load_calculator_tool,
            "document_reader": self._load_document_reader_tool,
            "table_query": self._load_table_query_tool,
            "agent_crud": self._load_agent_crud_tool,
            "document_crud": self._load_document_crud_tool,
            "file_crud": self._load_file_crud_tool,
            "table_crud": self._load_table_crud_tool,
            "team_crud": self._load_team_crud_tool,
            "database_crud": self._load_database_crud_tool,
            "emery_database": self._load_emery_database_tool,
            "table_schema": self._load_table_schema_tool,
            "table_data": self._load_table_data_tool,
            "measurement_api": self._load_measurement_api_tool,
            "kpi_api": self._load_kpi_api_tool,
            "analysis_api": self._load_analysis_api_tool,
            "process_api": self._load_process_api_tool,
        }

        loader_func = emery_tool_mapping.get(tool_id)
        if not loader_func:
            raise ValueError(f"Unknown Emery tool ID: {tool_id}")

        return loader_func(tool_config, unified_tool, api_key, api_key_mode)

    # Emery tool loaders
    def _load_file_reader_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load File Reader tool."""
        from ..tools.base_tools import load_file_reader
        return load_file_reader(tool_config)

    def _load_calculator_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Calculator tool."""
        from ..tools.base_tools import load_calculator
        return load_calculator(tool_config)

    def _load_document_reader_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Document Reader tool."""
        from ..tools.base_tools import load_document_reader
        return load_document_reader(tool_config)

    def _load_table_query_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Table Query tool."""
        from ..tools.base_tools import load_table_query
        return load_table_query(tool_config)

    def _load_agent_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Agent CRUD tool."""
        from ..tools.crud_tools import load_agent_crud
        return load_agent_crud(tool_config)

    def _load_document_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Document CRUD tool."""
        from ..tools.crud_tools import load_document_crud
        return load_document_crud(tool_config)

    def _load_file_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load File CRUD tool."""
        from ..tools.crud_tools import load_file_crud
        return load_file_crud(tool_config)

    def _load_table_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Table CRUD tool."""
        from ..tools.crud_tools import load_table_crud
        return load_table_crud(tool_config)

    def _load_team_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Team CRUD tool."""
        from ..tools.crud_tools import load_team_crud
        return load_team_crud(tool_config)

    def _load_database_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Database CRUD tool."""
        from ..tools.crud_tools import load_database_crud
        return load_database_crud(tool_config)

    def _load_emery_database_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Emery Database tool."""
        from ..tools.organizational_tools import EmeryDatabaseTool
        return EmeryDatabaseTool(tool_config.name, tool_config.description)

    def _load_table_schema_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Table Schema tool."""
        from ..tools.organizational_tools import TableSchemaTool
        return TableSchemaTool(tool_config.name, tool_config.description)

    def _load_table_data_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Table Data tool."""
        from ..tools.organizational_tools import TableDataTool
        return TableDataTool(tool_config.name, tool_config.description)

    def _load_measurement_api_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Measurement API tool."""
        from ..tools.api_tools import MeasurementAPITool
        return MeasurementAPITool(tool_config.name, tool_config.description)

    def _load_kpi_api_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load KPI API tool."""
        from ..tools.api_tools import KPIAPITool
        return KPIAPITool(tool_config.name, tool_config.description)

    def _load_analysis_api_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Analysis API tool."""
        from ..tools.api_tools import AnalysisAPITool
        return AnalysisAPITool(tool_config.name, tool_config.description)

    def _load_process_api_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str) -> Any:
        """Load Process API tool."""
        from ..tools.api_tools import ProcessAPITool
        return ProcessAPITool(tool_config.name, tool_config.description)

    def load_tools(self, tool_configs: List[ToolConfig], api_key: str = "", api_key_mode: str = "agent") -> List[Any]:
        """Load multiple tools from configurations."""
        tools = []

        for tool_config in tool_configs:
            try:
                tool = self.load_tool(tool_config, api_key, api_key_mode)
                tools.append(tool)
                print(f"✅ Loaded tool: {tool_config.name}")
            except Exception as e:
                print(f"❌ Failed to load tool '{tool_config.name}': {e}")
                # Continue loading other tools instead of failing completely

        return tools

    def list_tools_by_category(self, category: str) -> List[Dict[str, Any]]:
        """List tools filtered by category."""
        return [
            tool for tool in self.tool_lookup.values()
            if tool.get("category") == category
        ]

    def search_tools(self, query: str) -> List[Dict[str, Any]]:
        """Search tools by name, description."""
        query_lower = query.lower()
        results = []

        for tool in self.tool_lookup.values():
            # Search in name and description
            if (query_lower in tool.get("name", "").lower() or
                query_lower in tool.get("description", "").lower()):
                results.append(tool)

        return results