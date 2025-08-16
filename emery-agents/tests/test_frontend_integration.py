"""Unit tests for frontend integration."""

import pytest
from unittest.mock import patch, MagicMock
from emery_agents.core.types import ToolConfig
from emery_agents.tools import tool_registry, ToolType


class TestFrontendIntegration:
    """Test frontend compatibility."""
    
    def test_toolconfig_structure_matches_frontend(self):
        """Test ToolConfig matches frontend interface."""
        # Frontend structure from app/actions/types.ts
        frontend_config = {
            "name": "pipedream_connector",
            "version": "1.0",
            "config": {"agent_id": "123"}
        }
        
        # Convert to ToolConfig
        tool_config = ToolConfig(
            name=frontend_config["name"],
            version=frontend_config.get("version"),
            config=frontend_config.get("config")
        )
        
        assert tool_config.name == "pipedream_connector"
        assert tool_config.version == "1.0"
        assert tool_config.config == {"agent_id": "123"}
    
    def test_task_instructions_structure(self):
        """Test task instructions match frontend format."""
        # Structure from TaskFormDialog.tsx
        task_instructions = {
            "instructions": "Send an email and analyze response",
            "tools": [
                {"name": "pipedream_connector", "config": {"agent_id": "123"}},
                {"name": "python_repl", "config": {}}
            ],
            "servers": []
        }
        
        assert "instructions" in task_instructions
        assert "tools" in task_instructions
        assert "servers" in task_instructions
        assert len(task_instructions["tools"]) == 2
    
    @patch.dict('os.environ', {'PIPEDREAM_API_KEY': 'test-key'})
    @patch('requests.post')
    def test_pipedream_connector_frontend_config(self, mock_post):
        """Test Pipedream connector with frontend config."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "success"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        # Frontend configuration
        config = {
            "agent_id": "123",
            "use_test_auth": True,
            "test_user_id": "550e8400-e29b-41d4-a716-446655440000"
        }
        
        tool = tool_registry.create_tool_instance(ToolType.PIPEDREAM_CONNECTOR, config)
        result = tool.forward("gmail", "send_email", {"to": "test@example.com"})
        
        assert result["status"] == "success"
        mock_post.assert_called_once()
    
    def test_agent_tools_display_format(self):
        """Test agent tools format for frontend display."""
        from emery_agents.core.types import Agent
        
        agent = Agent(
            id=123,
            name="Test Agent",
            tools=[
                ToolConfig(name="python_repl"),
                ToolConfig(name="web_search"),
                ToolConfig(name="pipedream_connector", version="1.0")
            ]
        )
        
        # Verify structure expected by TaskFormDialog
        agent_tools = agent.tools or []
        assert len(agent_tools) == 3
        
        for tool in agent_tools:
            assert hasattr(tool, 'name')
            assert isinstance(tool.name, str)
            # Optional fields
            if hasattr(tool, 'version'):
                assert isinstance(tool.version, (str, type(None)))