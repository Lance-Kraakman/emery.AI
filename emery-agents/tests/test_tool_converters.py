"""Unit tests for tool converters."""

import pytest
from emery_agents.infrastructure.repositories.converters import ToolConfigConverter
from emery_agents.domain.entities.tools import ToolType
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
