"""Unit tests for tool registry."""

import pytest
from emery_agents.tools import tool_registry, ToolType, ToolCategory


class TestToolRegistry:
    """Test tool registry functionality."""
    
    def test_get_available_tools(self):
        """Test getting available tools."""
        tools = tool_registry.get_available_tools()
        assert len(tools) > 0
        assert all(hasattr(tool, 'name') for tool in tools)
        assert all(hasattr(tool, 'tool_type') for tool in tools)
    
    def test_get_tools_by_category(self):
        """Test filtering tools by category."""
        code_tools = tool_registry.get_available_tools(ToolCategory.CODE_EXECUTION)
        assert len(code_tools) > 0
        assert all(tool.category == ToolCategory.CODE_EXECUTION for tool in code_tools)
    
    def test_create_python_tool(self):
        """Test creating Python interpreter tool."""
        tool = tool_registry.create_tool_instance(ToolType.PYTHON_INTERPRETER, {})
        assert tool is not None
        assert hasattr(tool, '__call__')
    
    def test_create_web_search_tool(self):
        """Test creating web search tool."""
        pytest.importorskip("duckduckgo_search")
        tool = tool_registry.create_tool_instance(ToolType.WEB_SEARCH, {})
        assert tool is not None
        assert hasattr(tool, '__call__')
    
    def test_create_pipedream_tool_without_env(self):
        """Test Pipedream tool creation fails without env vars."""
        with pytest.raises(EnvironmentError):
            tool_registry.create_tool_instance(ToolType.PIPEDREAM_CONNECTOR, {})
    
    def test_create_pipedream_tool_with_config(self):
        """Test Pipedream tool creation with proper config."""
        import os
        with pytest.MonkeyPatch().context() as m:
            m.setenv("PIPEDREAM_API_KEY", "test-key")
            config = {"agent_id": "123", "use_test_auth": True}
            tool = tool_registry.create_tool_instance(ToolType.PIPEDREAM_CONNECTOR, config)
            assert tool is not None
            assert tool.config["agent_id"] == "123"
    
    def test_invalid_tool_type(self):
        """Test error handling for invalid tool type."""
        # Create a fake ToolType-like object with value attribute
        class FakeToolType:
            value = "invalid_tool"
        
        fake_tool_type = FakeToolType()
        with pytest.raises(ValueError, match="not registered"):
            tool_registry.create_tool_instance(fake_tool_type, {})