"""
Unified Tool Loader

Loads tools from the unified metadata JSON file that serves as the single
source of truth for both frontend and backend tool configurations.
"""

import json
import os
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path

from ..grpc.generated.agent_worker_pb2 import ToolConfig, AgentConfig, SkillConfig
from ..tools.skill_tool import SkillTool


class UnifiedToolLoader:
    """
    Loads tools from the unified metadata containing both Pipedream and Emery tools.

    AIDEV-NOTE: Enhanced with consolidated methods from:
    - agent_executor: create_tool_configs_with_context
    - chat_processing_service: load_tools_from_configs
    """

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
        # Navigate to execution/tools directory where the metadata is located
        metadata_path = current_dir.parent / "execution" / "tools" / "unified_metadata.json"
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

    def _find_skill_by_id(self, skills: List[SkillConfig], skill_id: int) -> Optional[SkillConfig]:
        """
        Find a skill in the skills list by ID.

        Args:
            skills: List of SkillConfig proto objects
            skill_id: ID of the skill to find

        Returns:
            SkillConfig if found, None otherwise
        """
        if not skills:
            return None

        for skill in skills:
            if skill.id == skill_id:
                return skill

        return None

    def _get_crud_tool_loader(self, tool_name: str) -> Optional[Callable]:
        """
        Get the appropriate CRUD tool loader function for a given tool name.

        Maps CRUD tool names from the database (e.g., 'emery-create-row') to their
        loader functions without needing unified_metadata.json.

        Args:
            tool_name: Tool name from frontend (e.g., "emery-create-agent")

        Returns:
            Loader function or None if not a CRUD tool
        """
        # AIDEV-NOTE: Explicit mapping for all CRUD tools seeded in database
        CRUD_TOOL_ROUTING = {
            # Agent operations
            "emery-create-agent": self._load_agent_crud_tool,
            "emery-read-agent": self._load_agent_crud_tool,
            "emery-update-agent": self._load_agent_crud_tool,
            "emery-delete-agent": self._load_agent_crud_tool,
            "emery-list-agents": self._load_agent_crud_tool,

            # Document operations
            "emery-create-document": self._load_document_crud_tool,
            "emery-read-document": self._load_document_crud_tool,
            "emery-update-document": self._load_document_crud_tool,
            "emery-delete-document": self._load_document_crud_tool,
            "emery-list-documents": self._load_document_crud_tool,

            # File operations
            "emery-create-file": self._load_file_crud_tool,
            "emery-read-file": self._load_file_crud_tool,
            "emery-update-file": self._load_file_crud_tool,
            "emery-delete-file": self._load_file_crud_tool,
            "emery-list-files": self._load_file_crud_tool,

            # Table operations
            "emery-create-table": self._load_table_crud_tool,
            "emery-read-table": self._load_table_crud_tool,
            "emery-update-table": self._load_table_crud_tool,
            "emery-delete-table": self._load_table_crud_tool,
            "emery-list-tables": self._load_table_crud_tool,

            # Row operations (also use table_crud)
            "emery-create-row": self._load_table_crud_tool,
            "emery-get-rows": self._load_table_crud_tool,
            "emery-update-row": self._load_table_crud_tool,
            "emery-delete-row": self._load_table_crud_tool,

            # Team operations
            "emery-create-team": self._load_team_crud_tool,
            "emery-read-team": self._load_team_crud_tool,
            "emery-update-team": self._load_team_crud_tool,
            "emery-delete-team": self._load_team_crud_tool,
            "emery-list-teams": self._load_team_crud_tool,

            # Database operations
            "emery-create-database": self._load_database_crud_tool,
            "emery-read-database": self._load_database_crud_tool,
            "emery-update-database": self._load_database_crud_tool,
            "emery-delete-database": self._load_database_crud_tool,
            "emery-list-databases": self._load_database_crud_tool,

            # Skill operations
            "emery-read-skill": self._load_skill_crud_tool,
            "emery-update-skill": self._load_skill_crud_tool,
            "emery-list-skills": self._load_skill_crud_tool,
        }

        return CRUD_TOOL_ROUTING.get(tool_name)

    def load_tool(
        self,
        tool_config: ToolConfig,
        api_key: str = "",
        api_key_mode: str = "agent",
        agent_config: Optional[AgentConfig] = None,
        skill_executor: Optional[Callable[[SkillConfig, Dict[str, Any]], str]] = None,
        organization_id: Optional[int] = None
    ) -> Any:
        """
        Load a tool instance from ToolConfig using unified metadata.

        Args:
            tool_config: Tool configuration from proto
            api_key: API key for tool authentication
            api_key_mode: API key mode ("agent" or "user")
            agent_config: Optional AgentConfig containing skills list
            skill_executor: Optional callback for executing skills

        Returns:
            Tool instance (either regular tool or SkillTool)
        """
        # Check if this is a skill_reference tool
        if 'type' in tool_config.config and tool_config.config['type'] == 'skill_reference':
            if not agent_config or not skill_executor:
                raise ValueError(f"Skill reference tool '{tool_config.name}' requires agent_config and skill_executor")

            # Extract skill ID from config
            if 'skill_id' not in tool_config.config:
                raise ValueError(f"Skill reference tool '{tool_config.name}' missing skill_id in config")

            skill_id = int(tool_config.config['skill_id'])

            # Find the skill in agent_config.skills by ID
            skill_config = self._find_skill_by_id(list(agent_config.skills), skill_id)
            if not skill_config:
                raise ValueError(f"Skill with ID {skill_id} not found in agent_config.skills")

            # Create and return SkillTool
            return SkillTool(skill_config, skill_executor)

        # AIDEV-NOTE: Handle CRUD tools from database - they don't need unified_metadata
        # These tools are seeded in the DB and sent with full config via gRPC
        crud_loader = self._get_crud_tool_loader(tool_config.name)
        if crud_loader:
            # Create a minimal unified_tool dict just to satisfy the loader signature
            unified_tool = {"id": tool_config.name, "source": "emery"}
            return crud_loader(tool_config, unified_tool, api_key, api_key_mode, organization_id)

        # Regular tool loading (existing logic)
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

    def _load_agent_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Agent CRUD tool."""
        from ..tools.crud_tools import load_agent_crud
        return load_agent_crud(tool_config, api_key, organization_id)

    def _load_document_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Document CRUD tool."""
        from ..tools.crud_tools import load_document_crud
        return load_document_crud(tool_config, api_key, organization_id)

    def _load_file_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load File CRUD tool."""
        from ..tools.crud_tools import load_file_crud
        return load_file_crud(tool_config, api_key, organization_id)

    def _load_table_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Table CRUD tool."""
        from ..tools.crud_tools import load_table_crud
        return load_table_crud(tool_config, api_key, organization_id)

    def _load_team_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Team CRUD tool."""
        from ..tools.crud_tools import load_team_crud
        return load_team_crud(tool_config, api_key, organization_id)

    def _load_database_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Database CRUD tool."""
        from ..tools.crud_tools import load_database_crud
        return load_database_crud(tool_config, api_key, organization_id)

    def _load_skill_crud_tool(self, tool_config: ToolConfig, unified_tool: Dict[str, Any], api_key: str, api_key_mode: str, organization_id: Optional[int] = None) -> Any:
        """Load Skill CRUD tool."""
        from ..tools.crud_tools import load_skill_crud
        return load_skill_crud(tool_config, api_key, organization_id)

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

    # =========================================================================
    # Consolidated Methods (from agent_executor and chat_processing_service)
    # =========================================================================

    def create_tool_configs_with_context(
        self,
        tool_names: List[str],
        context: Dict[str, Any]
    ) -> List[ToolConfig]:
        """
        Create tool configurations with enhanced context for Pipedream tools.

        Consolidates functionality from agent_executor._create_tool_configs_with_context().

        Args:
            tool_names: List of tool names to create configs for
            context: Execution context containing environment data (api_key, base_url, etc.)

        Returns:
            List of ToolConfig protobuf objects
        """
        import logging
        logger = logging.getLogger(__name__)

        tool_configs = []

        for tool_name in tool_names:
            config = {}

            # Check if this is a Pipedream tool
            is_pipedream_tool = any(tool_name.startswith(prefix) for prefix in [
                "gmail_", "slack_", "github_", "google_", "notion_", "trello_",
                "discord_", "linear_", "dropbox_", "airtable_", "hubspot_"
            ])

            if is_pipedream_tool:
                # Extract API key from context environment
                api_key = context.get("api_key") or (context.get("environment", {}).get("api_key"))
                base_url = context.get("base_url") or (context.get("environment", {}).get("base_url", os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")))

                if api_key:
                    config = {
                        "api_key": api_key,
                        "base_url": base_url,
                        "api_key_mode": "agent"
                    }
                    logger.info(f"Configured Pipedream tool {tool_name} with API key context")
                else:
                    logger.warning(f"Pipedream tool {tool_name} missing api_key in context")

            tool_configs.append(ToolConfig(
                name=tool_name,
                version="1.0",
                config=config
            ))

        return tool_configs

    def load_tools_from_configs(
        self,
        tool_configs: List[ToolConfig],
        api_key: Optional[str] = None,
        api_key_mode: str = "agent",
        agent_config: Optional[AgentConfig] = None,
        skill_executor: Optional[Callable[[SkillConfig, Dict[str, Any]], str]] = None,
        organization_id: Optional[int] = None
    ) -> List[Any]:
        """
        Load smolagents tools from ToolConfig protobuf objects.

        Consolidates functionality from chat_processing_service._convert_tools_to_smolagents().
        Handles errors gracefully, returning successfully loaded tools.

        Args:
            tool_configs: List of ToolConfig protobuf objects
            api_key: Optional API key for tool authentication
            api_key_mode: API key mode ("agent" or "user")
            agent_config: Optional AgentConfig containing skills list
            skill_executor: Optional callback for executing skills

        Returns:
            List of successfully loaded tool instances
        """
        import logging
        logger = logging.getLogger(__name__)

        if not tool_configs:
            logger.info("No tools provided to convert")
            return []

        logger.info(f"🔧 Converting {len(tool_configs)} tools to smolagents format...")

        smolagents_tools = []

        for tool_config in tool_configs:
            try:
                logger.info(f"🔧 Loading individual tool: {tool_config.name}")
                # Extract API key from config for user mode
                tool_api_key = tool_config.config.get('api_key', api_key) if tool_config.config else api_key
                logger.info(f"  Extracted API key from config: present={bool(tool_api_key)}")

                tool_instance = self.load_tool(
                    tool_config,
                    api_key=tool_api_key or "",
                    api_key_mode=api_key_mode,
                    agent_config=agent_config,
                    skill_executor=skill_executor,
                    organization_id=organization_id
                )
                smolagents_tools.append(tool_instance)
                logger.info(f"✅ Successfully loaded tool: {tool_config.name}")
            except Exception as tool_error:
                logger.error(f"❌ Failed to load tool {tool_config.name}: {tool_error}")
                logger.error(f"❌ Tool config was: {tool_config.config if tool_config.config else 'empty'}")
                import traceback
                logger.error(f"❌ Tool loading traceback: {traceback.format_exc()}")
                # Continue with other tools instead of failing completely

        logger.info(f"✅ Successfully converted {len(smolagents_tools)} out of {len(tool_configs)} tools")
        return smolagents_tools