"""Unit tests for the tool registry."""

import pytest
import os
from unittest.mock import patch
from emery_agents.domain.entities.tools import ToolType, ToolCategory
from emery_agents.infrastructure.repositories.tool_repository import ToolRegistryRepository


class TestToolRegistry:
    """Test tool registry functionality."""
    
    def test_get_available_tools(self):
        """Test getting all available tools."""
        tool_repo = ToolRegistryRepository()
        tools = tool_repo._tool_configs.values()
        assert len(tools) > 0
    
    def test_get_tools_by_category(self):
        """Test filtering tools by category."""
        tool_repo = ToolRegistryRepository()
        nlp_tools = [t for t in tool_repo._tool_configs.values() if t.category == ToolCategory.NATURAL_LANGUAGE_PROCESSING]
        assert len(nlp_tools) > 0
    
    def test_create_python_tool(self):
        """Test creating a PythonInterpreterTool."""
        tool_repo = ToolRegistryRepository()
        tool = tool_repo.create_tool_instance({'name': 'python_repl'})
        from smolagents import PythonInterpreterTool
        assert isinstance(tool, PythonInterpreterTool)
    
    @pytest.mark.skipif(not os.getenv("DUCKDUCKGO_API_KEY"), reason="DUCKDUCKGO_API_KEY required")
    def test_create_web_search_tool(self):
        """Test creating a DuckDuckGoSearchTool."""
        tool_repo = ToolRegistryRepository()
        tool = tool_repo.create_tool_instance({'name': 'web_search'})
        from smolagents import DuckDuckGoSearchTool
        assert isinstance(tool, DuckDuckGoSearchTool)
    
    def test_create_pipedream_tool_without_env(self):
        """Test that creating Pipedream tool fails without API key."""
        with patch.dict(os.environ, {}, clear=True):
            tool_repo = ToolRegistryRepository()
            assert tool_repo.create_tool_instance({'name': 'pipedream_connector'}) is None
    
    @patch.dict(os.environ, {"PIPEDREAM_API_KEY": "test-key"})
    def test_create_pipedream_tool_with_config(self):
        """Test creating Pipedream tool with configuration."""
        tool_repo = ToolRegistryRepository()
        tool = tool_repo.create_tool_instance(
            {'name': 'pipedream_connector', 'config': {'agent_id': '123'}}
        )
        assert tool.config['agent_id'] == '123'
    
    def test_invalid_tool_type(self):
        """Test creating an invalid tool type."""
        tool_repo = ToolRegistryRepository()
        assert tool_repo.create_tool_instance({'name': 'invalid_tool'}) is None
