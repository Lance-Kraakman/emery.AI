"""Unit tests for tool converters."""

import pytest
from emery_agents.tools.converters import ToolConfigConverter
from emery_agents.tools import ToolType
from emery_agents.domain.entities.models import ToolConfig


class TestToolConfigConverter:
    """Test tool configuration converters."""
    
    def test_get_tool_name_from_toolconfig(self):
        """Test extracting name from ToolConfig."""
        config = ToolConfig(name="python_repl", config={})
        name = ToolConfigConverter.get_tool_name(config)
        assert name == "python_repl"
    
    def test_get_tool_name_from_dict(self):
        """Test extracting name from dict."""
        config = {"name": "web_search", "config": {}}
        name = ToolConfigConverter.get_tool_name(config)
        assert name == "web_search"
    
    def test_from_agent_config_toolconfig(self):
        """Test converting ToolConfig to registry format."""
        config = ToolConfig(name="test", config={"key": "value"})
        result = ToolConfigConverter.from_agent_config(config)
        assert result == {"key": "value"}
    
    def test_from_agent_config_dict(self):
        """Test converting dict to registry format."""
        config = {"name": "test", "config": {"key": "value"}}
        result = ToolConfigConverter.from_agent_config(config)
        assert result == {"key": "value"}
    
    def test_from_agent_config_empty(self):
        """Test converting empty config."""
        config = ToolConfig(name="test")
        result = ToolConfigConverter.from_agent_config(config)
        assert result == {}
    
    def test_find_tool_type_by_name(self):
        """Test finding tool type by name."""
        tool_type = ToolConfigConverter.find_tool_type_by_name("python_repl")
        assert tool_type == ToolType.PYTHON_INTERPRETER
    
    def test_find_tool_type_by_display_name(self):
        """Test finding tool type by display name."""
        tool_type = ToolConfigConverter.find_tool_type_by_name("Python Interpreter")
        assert tool_type == ToolType.PYTHON_INTERPRETER
    
    def test_find_tool_type_not_found(self):
        """Test handling unknown tool name."""
        tool_type = ToolConfigConverter.find_tool_type_by_name("nonexistent_tool")
        assert tool_type is None
