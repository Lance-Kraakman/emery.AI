"""
Tests for Mock Tools with DDD Patterns

AIDEV-NOTE: Tests that mock tools follow DDD validation patterns and work with ToolConfig entities.
"""

import pytest
from emery_agents.core.entities import ToolConfig
from emery_agents.execution.tools.mock_email_tools import load_mock_gmail
from emery_agents.execution.tools.mock_data_tools import load_mock_pandas, load_mock_matplotlib


class TestMockToolsDDD:
    """Test mock tools follow DDD patterns and validation."""
    
    def test_mock_gmail_tool_with_valid_config(self):
        """Test Gmail mock tool loads correctly with valid ToolConfig."""
        config = ToolConfig(
            name="gmail_api",
            version="1.0",
            config={"organization_id": "test_org"}
        )
        
        tool = load_mock_gmail(config)
        assert tool is not None
        assert tool.name == "gmail_api"
        assert "Gmail API" in tool.description
        
        # Test tool functionality
        result = tool.forward(action="send_email")
        assert result["success"] is True
        assert "Mock email sent" in result["message"]
        
    def test_mock_gmail_tool_validation_errors(self):
        """Test Gmail mock tool validates ToolConfig properly."""
        # Test None config
        with pytest.raises(ValueError, match="ToolConfig must have a name"):
            load_mock_gmail(None)
        
        # Test config with no name
        with pytest.raises(ValueError, match="ToolConfig must have a name"):
            load_mock_gmail(ToolConfig(name="", version="1.0", config={}))
        
        # Test wrong tool name
        with pytest.raises(ValueError, match="Expected tool name 'gmail_api'"):
            load_mock_gmail(ToolConfig(name="wrong_tool", version="1.0", config={}))
    
    def test_mock_pandas_tool_with_valid_config(self):
        """Test Pandas mock tool loads correctly with valid ToolConfig."""
        config = ToolConfig(
            name="pandas", 
            version="1.0",
            config={"data_source": "test"}
        )
        
        tool = load_mock_pandas(config)
        assert tool is not None
        assert tool.name == "pandas"
        assert "Pandas" in tool.description
        
        # Test tool functionality
        result = tool.forward(action="load_data")
        assert result["success"] is True
        assert result["rows"] == 1000
        assert "columns" in result
        
    def test_mock_pandas_tool_validation_errors(self):
        """Test Pandas mock tool validates ToolConfig properly."""
        # Test wrong tool name
        with pytest.raises(ValueError, match="Expected tool name 'pandas'"):
            load_mock_pandas(ToolConfig(name="numpy", version="1.0", config={}))
    
    def test_mock_matplotlib_tool_with_valid_config(self):
        """Test Matplotlib mock tool loads correctly with valid ToolConfig."""
        config = ToolConfig(
            name="matplotlib",
            version="1.0", 
            config={"output_format": "png"}
        )
        
        tool = load_mock_matplotlib(config)
        assert tool is not None
        assert tool.name == "matplotlib"
        assert "Matplotlib" in tool.description
        
        # Test tool functionality
        result = tool.forward(chart_type="bar")
        assert result["success"] is True
        assert result["chart_type"] == "bar" 
        assert result["title"] == "Bar Chart"
        assert result["data_points"] == 50
        
    def test_mock_matplotlib_tool_validation_errors(self):
        """Test Matplotlib mock tool validates ToolConfig properly."""  
        # Test wrong tool name
        with pytest.raises(ValueError, match="Expected tool name 'matplotlib'"):
            load_mock_matplotlib(ToolConfig(name="seaborn", version="1.0", config={}))
    
    def test_mock_tools_with_ddd_tool_registry_pattern(self):
        """Test mock tools work with DDD tool registry patterns."""
        # Test that tools can be loaded through a registry-like pattern
        tool_configs = [
            ToolConfig(name="gmail_api", version="1.0", config={}),
            ToolConfig(name="pandas", version="1.0", config={}),
            ToolConfig(name="matplotlib", version="1.0", config={})
        ]
        
        # Load tools using the factory pattern
        gmail_tool = load_mock_gmail(tool_configs[0])
        pandas_tool = load_mock_pandas(tool_configs[1]) 
        matplotlib_tool = load_mock_matplotlib(tool_configs[2])
        
        # Verify all tools loaded correctly
        assert gmail_tool.name == "gmail_api"
        assert pandas_tool.name == "pandas"
        assert matplotlib_tool.name == "matplotlib"
        
        # Test cross-tool functionality 
        email_result = gmail_tool.forward(action="send_email")
        data_result = pandas_tool.forward(action="analyze")
        chart_result = matplotlib_tool.forward(chart_type="line")
        
        assert all(result["success"] for result in [email_result, data_result, chart_result])
        
    def test_mock_tools_error_handling_follows_ddd_patterns(self):
        """Test that mock tools handle errors following DDD patterns."""
        config = ToolConfig(name="gmail_api", version="1.0", config={})
        tool = load_mock_gmail(config)
        
        # Test unknown action - should return structured error
        result = tool.forward(action="unknown_action")
        assert result["success"] is False
        assert "Unknown action" in result["error"]
        
        # Test matplotlib with invalid chart type
        config = ToolConfig(name="matplotlib", version="1.0", config={})
        chart_tool = load_mock_matplotlib(config)
        
        result = chart_tool.forward(chart_type="invalid_chart_type")
        assert result["success"] is False
        assert "Unsupported chart type" in result["error"]