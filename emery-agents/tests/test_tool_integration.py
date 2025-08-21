"""
Test tool integration with frontend configuration.

Validates that the tool system works with the existing frontend ToolConfig interface.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

from emery_agents.tools import tool_registry, ToolType, ToolCategory
from emery_agents.core.types import ToolConfig as CoreToolConfig
from emery_agents.integrations.smolagents_orcha import SmolAgentsOrchestrator


class TestFrontendToolConfigIntegration:
    """Test that tools work with frontend configuration format."""
    
    def test_frontend_toolconfig_structure(self):
        """Test that frontend ToolConfig structure matches core types."""
        # Simulate frontend ToolConfig (from app/actions/types.ts)
        frontend_tool_config = {
            "name": "pipedream_connector",
            "version": "1.0",
            "config": {
                "agent_id": "test-agent-123",
                "api_key": "test-api-key",
                "use_test_auth": True
            }
        }
        
        # Convert to core ToolConfig
        core_tool_config = CoreToolConfig(
            name=frontend_tool_config["name"],
            version=frontend_tool_config.get("version"),
            config=frontend_tool_config.get("config")
        )
        
        assert core_tool_config.name == "pipedream_connector"
        assert core_tool_config.version == "1.0"
        assert core_tool_config.config["agent_id"] == "test-agent-123"
    
    def test_pipedream_connector_with_frontend_config(self):
        """Test Pipedream connector with frontend-style configuration."""
        # Frontend configuration as it would come from TaskFormDialog.tsx
        frontend_config = {
            "name": "pipedream_connector",
            "config": {
                "agent_id": "123",
                "api_key": "test-api-key",
                "api_base_url": "http://localhost:3000/api/agents/proxy",
                "use_test_auth": True,
                "test_user_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        
        # Verify the tool can be created from registry
        pipedream_tool = tool_registry.create_tool_instance(
            ToolType.PIPEDREAM_CONNECTOR,
            frontend_config["config"]
        )
        
        assert pipedream_tool is not None
        assert pipedream_tool.config["agent_id"] == "123"
        assert pipedream_tool.config["use_test_auth"] is True
    
    @patch('requests.post')
    def test_pipedream_connector_oauth_proxy_call(self, mock_post):
        """Test that Pipedream connector calls the OAuth proxy correctly."""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": "success",
            "result": {"message_id": "msg_123"}
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        # Create tool with frontend config
        config = {
            "agent_id": "123",
            "api_key": "test-api-key",
            "use_test_auth": True,
            "test_user_id": "550e8400-e29b-41d4-a716-446655440000"
        }
        
        pipedream_tool = tool_registry.create_tool_instance(
            ToolType.PIPEDREAM_CONNECTOR,
            config
        )
        
        # Test OAuth proxy call
        result = pipedream_tool.forward(
            service="gmail",
            action="send_email",
            params={
                "to": "test@example.com",
                "subject": "Test Email",
                "body": "Test message"
            }
        )
        
        # Verify the API call was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        
        # Check URL
        assert call_args[0][0] == "http://localhost:3000/api/agents/proxy"
        
        # Check payload
        payload = call_args[1]["json"]
        assert payload["service"] == "gmail"
        assert payload["action"] == "send_email"
        assert payload["params"]["to"] == "test@example.com"
        
        # Check headers (test auth)
        headers = call_args[1]["headers"]
        assert headers["x-test-user-id"] == "550e8400-e29b-41d4-a716-446655440000"
        assert headers["Content-Type"] == "application/json"
        
        # Check result
        assert result["status"] == "success"
        assert result["result"]["message_id"] == "msg_123"
    
    def test_smolagents_integration_with_frontend_tools(self):
        """Test that SmolAgents can load tools from frontend configuration."""
        from emery_agents.core.types import Agent, CapabilityConfig, StepConfig, StepType
        
        # Create agent with frontend-style tool configuration
        agent = Agent(
            id=123,
            name="Frontend Integration Test Agent",
            tools=[
                CoreToolConfig(
                    name="python_repl",
                    config={}
                ),
                CoreToolConfig(
                    name="pipedream_connector",
                    config={
                        "agent_id": "123",
                        "use_test_auth": True
                    }
                )
            ],
            capabilities=[
                CapabilityConfig(
                    name="test_capability",
                    description="Test capability with tools",
                    steps=[
                        StepConfig(
                            id="step1",
                            type=StepType.TOOL_STEP,
                            instructions="Use tools to complete task",
                            tools=[
                                CoreToolConfig(name="python_repl"),
                                CoreToolConfig(name="pipedream_connector")
                            ]
                        )
                    ]
                )
            ]
        )
        
        # Set up environment for testing
        with patch.dict(os.environ, {'HF_TOKEN': 'test-token'}):
            orchestrator = SmolAgentsOrchestrator()
            orchestrator.setup_agent_orchestrator(agent)
            
            # Verify orchestrator was set up
            assert orchestrator.agent is not None
    
    def test_tool_registry_matches_frontend_expectations(self):
        """Test that tool registry provides tools expected by frontend."""
        # Get available tools
        available_tools = tool_registry.get_available_tools()
        
        # Check that key tools are available
        tool_names = [config.name for config in available_tools]
        
        # Built-in smolagents tools
        assert "Python Interpreter" in tool_names
        assert "Web Search" in tool_names
        assert "Speech to Text" in tool_names
        
        # Custom integration tools
        assert "Pipedream Connector" in tool_names
        
        # HuggingFace model tools
        hf_tools = [config for config in available_tools if config.category in [
            ToolCategory.NATURAL_LANGUAGE_PROCESSING,
            ToolCategory.COMPUTER_VISION,
            ToolCategory.AUDIO
        ]]
        assert len(hf_tools) > 0
    
    def test_tool_config_validation(self):
        """Test that tool configurations are properly validated."""
        # Test valid configuration
        valid_tools = tool_registry.get_validated_tools()
        
        # Should have at least built-in tools that don't require env vars
        python_tools = [t for t in valid_tools if t.name == "Python Interpreter"]
        assert len(python_tools) > 0
        
        # Test that tools requiring missing env vars are filtered out
        with patch.dict(os.environ, {}, clear=True):
            validated_tools = tool_registry.get_validated_tools()
            hf_tools = [t for t in validated_tools if t.required_env_vars and "HF_TOKEN" in t.required_env_vars]
            assert len(hf_tools) == 0  # Should be filtered out due to missing HF_TOKEN


class TestTaskFormDialogIntegration:
    """Test integration with the TaskFormDialog component."""
    
    def test_task_creation_with_selected_tools(self):
        """Test task creation matching TaskFormDialog.tsx structure."""
        # Simulate the data structure created by TaskFormDialog
        task_data = {
            "agentId": 123,
            "name": "Test Task from Frontend",
            "capabilityName": "test_capability",  # Optional
            "instructions": {
                "instructions": "Send an email using Pipedream and analyze the response",
                "tools": [
                    {
                        "name": "pipedream_connector",
                        "config": {
                            "agent_id": "123",
                            "use_test_auth": True
                        }
                    },
                    {
                        "name": "python_repl",
                        "config": {}
                    }
                ],
                "servers": []  # Empty as shown in frontend
            }
        }
        
        # Verify the structure matches what our system expects
        instructions = task_data["instructions"]
        assert "instructions" in instructions
        assert "tools" in instructions
        assert "servers" in instructions
        
        # Verify tools can be loaded
        for tool_config in instructions["tools"]:
            core_config = CoreToolConfig(
                name=tool_config["name"],
                config=tool_config.get("config", {})
            )
            assert core_config.name in ["pipedream_connector", "python_repl"]
    
    def test_agent_tools_display(self):
        """Test that agent tools are displayed correctly in frontend format."""
        from emery_agents.core.types import Agent
        
        # Create agent with tools (as stored in database)
        agent = Agent(
            id=123,
            name="Test Agent",
            tools=[
                CoreToolConfig(name="pipedream_connector", version="1.0"),
                CoreToolConfig(name="python_repl"),
                CoreToolConfig(name="web_search")
            ]
        )
        
        # Verify tools can be displayed in frontend
        agent_tools = agent.tools or []
        assert len(agent_tools) == 3
        
        # Check that tools have the structure expected by TaskFormDialog
        for tool in agent_tools:
            assert hasattr(tool, 'name')
            assert tool.name in ["pipedream_connector", "python_repl", "web_search"]