"""
Unified tool preparation for execution.

Consolidates tool loading patterns from:
- AgentExecutor._create_skill_agent()
- SkillExecutorService._execute_agent()
- StepExecutorService._execute_agentic_step()

AIDEV-NOTE: Part of Phase 1.3 refactoring (Feb 2026).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

from emery_agents.tools.loader import UnifiedToolLoader

from emery_agents.entities.skill_config import StepToolConfig

if TYPE_CHECKING:
    from emery_agents.entities.skill_config import SkillConfig

from emery_agents.entities.tool_config import ToolConfig

logger = logging.getLogger(__name__)

# Tool = Any DSPy-compatible callable with name/description
# Protocol: has name: str, description: str, __call__(**kwargs) -> str
Tool = Any


class ToolPreparationService:
    """Unified tool preparation for execution.

    Wraps UnifiedToolLoader to provide a consistent interface for loading
    tools from various sources (skill configs, tool configs, workspace).

    Replaces scattered tool loading in:
    - AgentExecutor._create_skill_agent()
    - SkillExecutorService._execute_agent()
    - StepExecutorService._execute_agentic_step()
    """

    def __init__(self, tool_loader: UnifiedToolLoader | None = None):
        """Initialize with optional tool loader.

        Args:
            tool_loader: UnifiedToolLoader instance. Creates default if not provided.
        """
        self.tool_loader = tool_loader or UnifiedToolLoader()

    def _step_tool_to_tool_config(self, step_tool: StepToolConfig) -> ToolConfig:
        """Convert StepToolConfig to ToolConfig.

        StepToolConfig has tool_type, ToolConfig has version.
        Both have name and config fields.
        """
        return ToolConfig(
            name=step_tool.name,
            version="1.0",  # Default version for step tools
            config=step_tool.config,
        )

    def prepare_for_skill(
        self,
        skill: SkillConfig,
        api_key: str,
        api_key_mode: str = "user",
        organization_id: int | None = None,
        workspace_path: Path | None = None,
    ) -> list[Tool]:
        """Load tools configured for a skill.

        Args:
            skill: Skill config with tools: list[StepToolConfig]
            api_key: API key for authenticated tools
            api_key_mode: "user" or "agent"
            organization_id: Optional org ID for RLS context
            workspace_path: Optional workspace path for sandboxed file operations

        Returns:
            List of DSPy-compatible tools
        """
        if not skill.tools:
            logger.debug(f"No tools configured for skill '{skill.name}'")
            return []

        # Convert StepToolConfig to ToolConfig for the loader
        tool_configs = [self._step_tool_to_tool_config(t) for t in skill.tools]

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=tool_configs,
            api_key=api_key,
            api_key_mode=api_key_mode,
            organization_id=organization_id,
            workspace_path=workspace_path,
        )
        logger.info(f"🔧 Loaded {len(tools)} tools for skill '{skill.name}'")
        return tools

    def prepare_from_configs(
        self,
        tool_configs: list[ToolConfig] | list[StepToolConfig],
        api_key: str,
        api_key_mode: str = "user",
        organization_id: int | None = None,
        workspace_path: Path | None = None,
    ) -> list[Tool]:
        """Load tools from general ToolConfig or StepToolConfig list.

        Args:
            tool_configs: List of ToolConfig or StepToolConfig
            api_key: API key for authenticated tools
            api_key_mode: "user" or "agent"
            organization_id: Optional org ID for RLS context
            workspace_path: Optional workspace path for sandboxed file operations

        Returns:
            List of DSPy-compatible tools
        """
        if not tool_configs:
            return []

        # Convert any StepToolConfig to ToolConfig
        converted_configs: list[ToolConfig] = []
        for config in tool_configs:
            if isinstance(config, ToolConfig):
                converted_configs.append(config)
            else:
                # It's a StepToolConfig, convert it
                converted_configs.append(self._step_tool_to_tool_config(config))

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=converted_configs,
            api_key=api_key,
            api_key_mode=api_key_mode,
            organization_id=organization_id,
            workspace_path=workspace_path,
        )
        logger.info(f"🔧 Loaded {len(tools)} tools from configs")
        return tools

    def prepare_workspace_tools(
        self,
        workspace_path: Path,
    ) -> list[Tool]:
        """Create bash/fs tools for workspace isolation.

        Args:
            workspace_path: Path to workspace directory for sandboxed operations

        Returns:
            BashTool and FilesystemTools scoped to workspace_path
        """
        from emery_agents.tools.execution.bash import create_bash_tool
        from emery_agents.tools.execution.filesystem import create_filesystem_tools

        tools: list[Tool] = []
        tools.append(create_bash_tool(workspace_path))
        tools.extend(create_filesystem_tools(workspace_path))
        logger.info(f"🔧 Created {len(tools)} workspace tools for {workspace_path}")
        return tools

    def create_skill_delegation_tools(
        self,
        available_skills: list[SkillConfig],
        executor_callback: Callable[[SkillConfig, dict[str, Any], bool], Any],
    ) -> list[Tool]:
        """Wrap skills as callable tools for delegation.

        Args:
            available_skills: Skills that can be delegated to
            executor_callback: Callback to execute delegated skill
                Signature: (skill_config, inputs, capture_outputs) -> result

        Returns:
            List of SkillTool wrappers
        """
        from emery_agents.tools.execution.skill import SkillTool

        tools = [
            SkillTool(skill, executor_callback)
            for skill in available_skills
        ]
        if tools:
            logger.info(f"🔧 Created {len(tools)} skill delegation tools")
        return tools

    def load_tools_by_names(
        self,
        tool_names: list[str],
        api_key: str,
        api_key_mode: str = "user",
        organization_id: int | None = None,
    ) -> list[Tool]:
        """Load tools by name from the unified metadata.

        Args:
            tool_names: List of tool names to load
            api_key: API key for authenticated tools
            api_key_mode: "user" or "agent"
            organization_id: Optional org ID for RLS context

        Returns:
            List of DSPy-compatible tools
        """
        if not tool_names:
            return []

        # Convert names to ToolConfig objects
        tool_configs = [
            ToolConfig(name=name, version="1.0", config={})
            for name in tool_names
        ]

        tools = self.tool_loader.load_tools_from_configs(
            tool_configs=tool_configs,
            api_key=api_key,
            api_key_mode=api_key_mode,
            organization_id=organization_id,
        )
        logger.info(f"🔧 Loaded {len(tools)} tools by name")
        return tools


# Singleton instance for convenience
_default_service: ToolPreparationService | None = None


def get_tool_preparation_service() -> ToolPreparationService:
    """Get shared ToolPreparationService instance."""
    global _default_service
    if _default_service is None:
        _default_service = ToolPreparationService()
    return _default_service
