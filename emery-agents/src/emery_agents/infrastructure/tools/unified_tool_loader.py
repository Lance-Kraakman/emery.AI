"""
Unified Tool Loader

Loads tools from the unified tools registry JSON file that serves as the single
source of truth for both frontend and backend tool configurations.
"""

import json
import os
from typing import Any, Dict, List, Optional
from pathlib import Path

from ...core.entities import ToolConfig


class UnifiedToolLoader:
    """Loads tools from the unified registry and Pipedream metadata."""

    def __init__(self, registry_path: Optional[str] = None, pipedream_metadata_path: Optional[str] = None):
        """Initialize with paths to registry and pipedream metadata."""
        # Default paths
        if registry_path is None:
            registry_path = self._get_default_registry_path()
        if pipedream_metadata_path is None:
            pipedream_metadata_path = self._get_default_pipedream_metadata_path()

        self.registry_path = registry_path
        self.pipedream_metadata_path = pipedream_metadata_path

        # Load registries
        self.registry = self._load_registry()
        self.pipedream_metadata = self._load_pipedream_metadata()

        # Create tool lookup
        self.tool_lookup = self._build_tool_lookup()

    def _get_default_registry_path(self) -> str:
        """Get default path to unified registry."""
        # Look for registry in shared folder relative to this file
        current_dir = Path(__file__).parent
        # Go up to project root and find shared folder
        project_root = current_dir.parent.parent.parent.parent.parent  # Navigate to orchastrate root
        registry_path = project_root / "public" / "tools-registry.json"
        return str(registry_path)

    def _get_default_pipedream_metadata_path(self) -> str:
        """Get default path to pipedream metadata."""
        current_dir = Path(__file__).parent
        metadata_path = current_dir / "pipedream_metadata.json"
        return str(metadata_path)

    def _load_registry(self) -> Dict[str, Any]:
        """Load the unified tools registry."""
        try:
            with open(self.registry_path, 'r') as f:
                registry = json.load(f)
            print(f"✅ Loaded unified registry with {len(registry['curated_tools'])} curated tools")
            return registry
        except FileNotFoundError:
            print(f"⚠️  Registry not found at {self.registry_path}, using empty registry")
            return {"curated_tools": [], "pipedream_config": {"enabled": False}}
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in registry: {e}")
            return {"curated_tools": [], "pipedream_config": {"enabled": False}}

    def _load_pipedream_metadata(self) -> Dict[str, Any]:
        """Load pipedream metadata if enabled."""
        if not self.registry.get("pipedream_config", {}).get("enabled", False):
            return {}

        try:
            with open(self.pipedream_metadata_path, 'r') as f:
                metadata = json.load(f)
            print(f"✅ Loaded Pipedream metadata with {len(metadata)} tools")
            return metadata
        except FileNotFoundError:
            print(f"⚠️  Pipedream metadata not found at {self.pipedream_metadata_path}")
            return {}
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in pipedream metadata: {e}")
            return {}

    def _build_tool_lookup(self) -> Dict[str, Dict[str, Any]]:
        """Build a lookup table of tool ID to tool configuration."""
        lookup = {}

        for tool in self.registry.get("curated_tools", []):
            lookup[tool["id"]] = tool

        return lookup

    def get_available_tools(self) -> List[str]:
        """Get list of available tool IDs."""
        return list(self.tool_lookup.keys())

    def get_tool_config(self, tool_id: str) -> Optional[Dict[str, Any]]:
        """Get tool configuration by ID."""
        return self.tool_lookup.get(tool_id)

    def load_tool(self, tool_config: ToolConfig) -> Any:
        """Load a tool instance from ToolConfig using unified registry."""
        tool_name = tool_config.name

        # Look up tool in unified registry
        unified_tool = self.get_tool_config(tool_name)
        if not unified_tool:
            raise ValueError(f"Tool '{tool_name}' not found in unified registry")

        implementation = unified_tool["implementation"]

        if implementation["type"] == "pipedream":
            return self._load_pipedream_tool(tool_config, unified_tool)
        elif implementation["type"] == "native":
            return self._load_native_tool(tool_config, unified_tool)
        else:
            raise ValueError(f"Unknown implementation type: {implementation['type']}")

    def _load_pipedream_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load a Pipedream tool using the unified configuration."""
        implementation = unified_tool["implementation"]
        pipedream_tool_id = implementation["pipedream_tool_id"]

        # Check if pipedream tool exists
        if pipedream_tool_id not in self.pipedream_metadata:
            raise ValueError(f"Pipedream tool '{pipedream_tool_id}' not found in metadata")

        pipedream_tool = self.pipedream_metadata[pipedream_tool_id]

        # Import and create the appropriate Pipedream tool
        if pipedream_tool["type"] == "mcp":
            return self._create_mcp_tool(tool_config, unified_tool, pipedream_tool)
        else:
            return self._create_specific_pipedream_tool(tool_config, unified_tool, pipedream_tool)

    def _create_mcp_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], pipedream_tool: Dict[str, Any]) -> Any:
        """Create an MCP (generic API) tool."""
        from ...execution.tools.pipedream_tools import create_mcp_tool

        app_name = pipedream_tool["app"]
        tool_name = unified_tool["display_name"]

        # Create the MCP tool with the app configuration
        return create_mcp_tool(app_name, tool_name, tool_config)

    def _create_specific_pipedream_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], pipedream_tool: Dict[str, Any]) -> Any:
        """Create a specific Pipedream action tool."""
        from ...execution.tools.pipedream_tools import create_pipedream_action_tool

        # Create the specific action tool
        return create_pipedream_action_tool(pipedream_tool, tool_config)

    def _load_native_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load a native tool using the unified configuration."""
        implementation = unified_tool["implementation"]
        backend_class = implementation["backend_class"]

        # Map backend class names to actual tool loaders
        native_tool_mapping = {
            "PythonReplTool": self._load_python_repl_tool,
            "WebSearchTool": self._load_web_search_tool,
            "DataAnalyzerTool": self._load_data_analyzer_tool,
            "MeasurementTrackerTool": self._load_measurement_tracker_tool,
            "DocumentReaderTool": self._load_document_reader_tool,
            "TableQueryTool": self._load_table_query_tool,
        }

        loader_func = native_tool_mapping.get(backend_class)
        if not loader_func:
            raise ValueError(f"Unknown native tool class: {backend_class}")

        return loader_func(tool_config, unified_tool)

    def _load_python_repl_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load Python REPL tool."""
        from ...execution.tools.base_tools import load_python_repl_tool
        return load_python_repl_tool(tool_config)

    def _load_web_search_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load web search tool."""
        from ...execution.tools.base_tools import load_web_search_tool
        return load_web_search_tool(tool_config)

    def _load_data_analyzer_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load data analyzer tool."""
        from ...execution.tools.mock_data_tools import load_data_analyzer_tool
        return load_data_analyzer_tool(tool_config)

    def _load_measurement_tracker_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load measurement tracker tool."""
        from ...execution.tools.organizational_tools import load_measurement_tracker_tool
        return load_measurement_tracker_tool(tool_config)

    def _load_document_reader_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load document reader tool."""
        from ...execution.tools.base_tools import load_document_reader_tool
        return load_document_reader_tool(tool_config)

    def _load_table_query_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any]) -> Any:
        """Load table query tool."""
        from ...execution.tools.base_tools import load_table_query_tool
        return load_table_query_tool(tool_config)


    def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
        """Load multiple tools from configurations."""
        tools = []

        for tool_config in tool_configs:
            try:
                tool = self.load_tool(tool_config)
                tools.append(tool)
                print(f"✅ Loaded tool: {tool_config.name}")
            except Exception as e:
                print(f"❌ Failed to load tool '{tool_config.name}': {e}")
                # Continue loading other tools instead of failing completely

        return tools

    def list_tools_by_category(self, category: str) -> List[Dict[str, Any]]:
        """List tools filtered by category."""
        return [
            tool for tool in self.registry.get("curated_tools", [])
            if tool.get("category") == category
        ]

    def search_tools(self, query: str) -> List[Dict[str, Any]]:
        """Search tools by name, description, or tags."""
        query_lower = query.lower()
        results = []

        for tool in self.registry.get("curated_tools", []):
            # Search in name, description, and tags
            if (query_lower in tool.get("display_name", "").lower() or
                query_lower in tool.get("description", "").lower() or
                any(query_lower in tag.lower() for tag in tool.get("tags", []))):
                results.append(tool)

        return results