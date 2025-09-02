"""
Test Pipedream Integration

AIDEV-NOTE: Test suite for Pipedream tool integration.
Tests both tool registry loading and actual execution with mock proxy responses.
"""

import pytest
import os
import requests
from unittest.mock import patch, Mock
from emery_agents.execution.tools.tool_registry import ToolRegistry
from emery_agents.execution.tools.pipedream_tools import (
    PipedreamTool, 
    PIPEDREAM_TOOLS,
    get_pipedream_tool_info,
    list_pipedream_tools_by_app
)
from emery_agents.core.entities import ToolConfig
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId
from emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
from emery_agents.domain.agents.value_objects.agent_value_objects import ApiKey


class TestPipedreamToolsIntegration:
    """Test Pipedream tools integration with the tool registry."""
    
    def test_pipedream_tools_loaded_when_enabled(self):
        """Test that Pipedream tools are loaded when USE_PIPEDREAM_TOOLS=true."""
        with patch.dict(os.environ, {"USE_PIPEDREAM_TOOLS": "true"}):
            registry = ToolRegistry()
            available_tools = registry.list_available_tools()
            
            # Should include some Pipedream tools (updated for new expanded set)
            pipedream_tools = [t for t in available_tools if t.startswith(('activecampaign_', 'airtable_oauth_', 'agile_crm_', 'aircall_'))]
            assert len(pipedream_tools) > 0, "Should have loaded Pipedream tools"
            
            # Test loading a specific tool from our expanded set
            test_tool_name = None
            for tool_name in pipedream_tools[:5]:  # Try first few tools
                if tool_name in available_tools:
                    test_tool_name = tool_name
                    break
            
            if test_tool_name:
                tool_config = ToolConfig(
                    name=test_tool_name, 
                    version="1.0",
                    config={
                        "agent_api_key": "agent_prod_abc123def456xyz789",
                        "base_url": "http://localhost:3000"
                    }
                )
                tool = registry.load_tool(tool_config)
                assert tool is not None
                assert tool.name == test_tool_name
                assert hasattr(tool, 'forward')
    
    def test_pipedream_tools_disabled_by_default(self):
        """Test that Pipedream tools are disabled by default."""
        # Since the module imports evaluate at import time, we need to check the environment
        import importlib
        import sys
        
        with patch.dict(os.environ, {"USE_PIPEDREAM_TOOLS": "false"}):
            # Reload the tool registry module to pick up the new environment
            if 'emery_agents.execution.tools.tool_registry' in sys.modules:
                importlib.reload(sys.modules['emery_agents.execution.tools.tool_registry'])
            
            from emery_agents.execution.tools.tool_registry import ToolRegistry
            registry = ToolRegistry()
            available_tools = registry.list_available_tools()
            
            # Should not include Pipedream tools (updated for new expanded set)
            pipedream_tools = [t for t in available_tools if t.startswith(('activecampaign_', 'airtable_oauth_', 'agile_crm_', 'aircall_'))]
            assert len(pipedream_tools) == 0, "Should not have loaded Pipedream tools when disabled"
    
    def test_pipedream_tool_metadata_functions(self):
        """Test utility functions for Pipedream tool metadata."""
        # Test get_pipedream_tool_info
        gmail_info = get_pipedream_tool_info("gmail_send_email")
        if gmail_info:  # Only test if metadata is available
            assert gmail_info["app"] == "gmail"
            assert "inputs" in gmail_info
            assert gmail_info["inputs"]["to"]["required"] == True
        
        # Test list_pipedream_tools_by_app
        tools_by_app = list_pipedream_tools_by_app()
        assert isinstance(tools_by_app, dict)
        if "gmail" in tools_by_app:
            assert "gmail_send_email" in tools_by_app["gmail"]


class TestPipedreamToolExecution:
    """Test Pipedream tool execution with mock HTTP responses."""
    
    def test_activecampaign_tool_success_response(self):
        """Test ActiveCampaign tool with successful proxy response."""
        tool_config = ToolConfig(
            name="activecampaign_create_contact",
            version="1.0", 
            config={
                "agent_api_key": "agent_prod_abc123def456xyz789",
                "base_url": "http://localhost:3000"
            }
        )
        
        tool = PipedreamTool("activecampaign-create-contact", tool_config)
        
        # Mock successful HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": {"message_id": "msg_123", "status": "sent"}
        }
        
        with patch('requests.post', return_value=mock_response) as mock_post:
            result = tool.forward(
                to="test@example.com",
                subject="Test Email",
                body="This is a test email"
            )
            
            # Verify the request was made correctly
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            
            # Check URL and headers
            assert call_args[1]["json"]["service"] == "gmail"
            assert call_args[1]["json"]["action"] == "send_email"
            assert call_args[1]["headers"]["Authorization"] == "Bearer agent_prod_abc123def456xyz789"
            
            # Check result
            assert result["success"] == True
            assert "data" in result
    
    def test_pipedream_tool_authentication_error(self):
        """Test Pipedream tool with authentication error."""
        tool_config = ToolConfig(
            name="gmail_send_email",
            version="1.0",
            config={
                "agent_api_key": "agent_prod_invalid123def456xyz",
                "base_url": "http://localhost:3000"
            }
        )
        
        tool = PipedreamTool("gmail-send-email", tool_config)
        
        # Mock 401 authentication error
        mock_response = Mock()
        mock_response.status_code = 401
        
        with patch('requests.post', return_value=mock_response):
            result = tool.forward(
                to="test@example.com",
                subject="Test Email",
                body="This is a test email"
            )
            
            assert result["success"] == False
            assert "Authentication failed" in result["error"]
    
    def test_pipedream_tool_connection_error(self):
        """Test Pipedream tool with connection error."""
        tool_config = ToolConfig(
            name="slack_send_message_to_channel",
            version="1.0",
            config={
                "agent_api_key": "agent_prod_abc123def456xyz789",
                "base_url": "http://localhost:3000"
            }
        )
        
        tool = PipedreamTool("slack-send-message-to-channel", tool_config)
        
        with patch('requests.post', side_effect=requests.exceptions.ConnectionError("Connection failed")):
            result = tool.forward(
                channel="#general",
                text="Hello team!"
            )
            
            assert result["success"] == False
            assert "Request error" in result["error"]


class TestExecutionContextIntegration:
    """Test integration with execution context and agent API key passing."""
    
    def test_execution_context_with_pipedream_tools(self):
        """Test that execution context properly passes API key to tools."""
        # Create execution context with agent API key in environment
        context = ExecutionContext(
            mode=ExecutionMode.INSTRUCTION_BASED,
            instructions="Send an email to the team",
            available_tools=["gmail_send_email"],
            agent_id=AgentId(123),
            organization_id=OrganizationId(1),
            environment={
                "agent_api_key": ApiKey("agent_prod_abc123def456xyz789"),
                "base_url": "http://localhost:3000"
            }
        )
        
        # Verify context has the required environment variables
        assert "agent_api_key" in context.environment
        assert isinstance(context.environment["agent_api_key"], ApiKey)
        assert context.environment["agent_api_key"].value == "agent_prod_abc123def456xyz789"
    
    def test_tool_config_creation_with_context(self):
        """Test tool config creation with execution context."""
        from emery_agents.infrastructure.execution.smolagents_execution_repository import SmolAgentsExecutionRepository
        from emery_agents.domain.ai.services.model_provider_service import IModelProviderService
        from emery_agents.domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
        from unittest.mock import Mock
        
        # Create mock dependencies
        mock_tool_registry = Mock(spec=IToolRegistryRepository)
        mock_model_provider = Mock(spec=IModelProviderService)
        
        # Create execution repository
        execution_repo = SmolAgentsExecutionRepository(mock_tool_registry, mock_model_provider)
        
        # Create execution context with Pipedream tool
        context = ExecutionContext(
            mode=ExecutionMode.INSTRUCTION_BASED,
            instructions="Send an email",
            available_tools=["gmail_send_email", "calculator"],
            environment={
                "agent_api_key": ApiKey("agent_prod_abc456def789xyz123"),
                "base_url": "http://localhost:3000"
            }
        )
        
        # Test tool config creation
        tool_configs = execution_repo._create_tool_configs_with_context(
            context.available_tools, 
            context
        )
        
        # Verify tool configs
        assert len(tool_configs) == 2
        
        # Find Gmail tool config
        gmail_config = next((tc for tc in tool_configs if tc.name == "gmail_send_email"), None)
        assert gmail_config is not None
        assert gmail_config.config["agent_api_key"].value == "agent_prod_abc456def789xyz123"
        assert gmail_config.config["base_url"] == "http://localhost:3000"
        
        # Find non-Pipedream tool config
        calc_config = next((tc for tc in tool_configs if tc.name == "calculator"), None)
        assert calc_config is not None
        assert calc_config.config == {}  # No special config for non-Pipedream tools


@pytest.mark.integration
class TestPipedreamToolsWithRealProxy:
    """Integration tests that require the NextJS proxy to be running."""
    
    @pytest.mark.skip(reason="Requires NextJS proxy server and valid agent API key")
    def test_real_gmail_integration(self):
        """Test real Gmail integration through proxy (skipped by default)."""
        # This test would require:
        # 1. NextJS server running at localhost:3000
        # 2. Valid agent API key in database
        # 3. User with Gmail OAuth connection
        
        tool_config = ToolConfig(
            name="gmail_send_email",
            version="1.0",
            config={
                "agent_api_key": ApiKey("real_agent_api_key_here"),
                "base_url": "http://localhost:3000"
            }
        )
        
        tool = PipedreamTool("gmail-send-email", tool_config)
        
        result = tool.forward(
            to="test@example.com",
            subject="Test from Emery Agent",
            body="This is a test email from the Emery agent system"
        )
        
        # Real integration would return actual Pipedream response
        assert "success" in result


if __name__ == "__main__":
    # Run basic tests
    print("Testing Pipedream integration...")
    
    # Test tool registry loading
    test_integration = TestPipedreamToolsIntegration()
    test_integration.test_pipedream_tools_disabled_by_default()
    
    # Test tool execution
    test_execution = TestPipedreamToolExecution()  
    test_execution.test_pipedream_tool_connection_error()
    
    print("✅ Basic Pipedream integration tests passed!")