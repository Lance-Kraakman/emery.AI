"""Test fixtures and configuration."""

import pytest
import os
from typing import Dict, Any
from unittest.mock import AsyncMock, Mock, patch

from emery_agents.core.types import (
    Agent, CapabilityConfig, StepConfig, StepType,
    TaskInstructions, TriggerConfig, TriggerType,
    ToolConfig, ServerConfig
)


@pytest.fixture
def sample_tool_config() -> ToolConfig:
    """Basic tool configuration."""
    return ToolConfig(name="test_tool", version="1.0.0")


@pytest.fixture  
def sample_server_config() -> ServerConfig:
    """Basic server configuration."""
    return ServerConfig(name="test_server", endpoint="http://localhost:8000")


@pytest.fixture
def sample_step_config(sample_tool_config, sample_server_config) -> StepConfig:
    """Basic step configuration."""
    return StepConfig(
        id="test_step_1",
        type=StepType.CODE_STEP,
        instructions="Test step instructions",
        tools=[sample_tool_config],
        servers=[sample_server_config]
    )


@pytest.fixture
def sample_capability(sample_step_config) -> CapabilityConfig:
    """Basic capability configuration."""
    return CapabilityConfig(
        name="test_capability",
        description="Test capability for unit testing",
        steps=[sample_step_config]
    )


@pytest.fixture
def sample_agent(sample_capability, sample_tool_config, sample_server_config) -> Agent:
    """Basic agent configuration."""
    return Agent(
        id=123,
        name="Test Agent",
        role="assistant",
        description="Agent for testing",
        persona="Helpful test assistant",
        tools=[sample_tool_config],
        servers=[sample_server_config],
        capabilities=[sample_capability]
    )


@pytest.fixture
def sample_task_instructions() -> TaskInstructions:
    """Basic task instructions."""
    return TaskInstructions(
        instructions="Execute test task",
        tools=[ToolConfig(name="test_tool")],
        servers=[ServerConfig(name="test_server")]
    )




@pytest.fixture
def mock_emery_client():
    """Mock Emery client integration."""
    client = Mock()
    client.report_execution_result = AsyncMock()
    return client


@pytest.fixture  
def mock_smolagents():
    """Mock SmolAgents orchestrator."""
    orchestrator = Mock()
    orchestrator.execute_with_orchestrator = AsyncMock()
    orchestrator.setup_agent_orchestrator = Mock()
    return orchestrator


@pytest.fixture
def mock_mcp_servers():
    """Mock MCP servers integration."""
    servers = Mock()
    servers.execute_server_action = AsyncMock()
    return servers


@pytest.fixture
def mock_integrations(mock_emery_client, mock_smolagents, mock_mcp_servers):
    """Complete mock integrations."""
    return {
        "emery_client": mock_emery_client,
        "smolagents": mock_smolagents, 
        "mcp_servers": mock_mcp_servers
    }


@pytest.fixture
def temp_working_dir(tmp_path):
    """Temporary working directory."""
    return tmp_path / "emery_test_workspace"


@pytest.fixture
def hf_token():
    """Provide HF token for tests."""
    return "test-token"


@pytest.fixture
def mock_hf_env(hf_token):
    """Mock HF_TOKEN environment variable."""
    with patch.dict(os.environ, {'HF_TOKEN': hf_token}):
        yield


@pytest.fixture
def pipedream_env():
    """Mock Pipedream environment variables."""
    with patch.dict(os.environ, {'PIPEDREAM_API_KEY': 'test-api-key'}):
        yield