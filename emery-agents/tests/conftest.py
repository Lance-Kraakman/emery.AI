"""Test fixtures and configuration."""

import pytest
import os
from typing import Dict, Any
from unittest.mock import AsyncMock, Mock, patch

# DDD imports - only domain layer for testing
from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.agents.entities.task import Task, TaskInstructions
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
from emery_agents.domain.agents.value_objects.agent_value_objects import AgentName, AgentStatus, ApiKey


@pytest.fixture
def sample_agent_id() -> AgentId:
    """Sample agent ID value object."""
    return AgentId(123)


@pytest.fixture
def sample_organization_id() -> OrganizationId:
    """Sample organization ID value object."""
    return OrganizationId(1)


@pytest.fixture
def sample_task_id() -> TaskId:
    """Sample task ID value object."""
    return TaskId.generate()


@pytest.fixture
def sample_tool_config() -> Dict[str, Any]:
    """Basic tool configuration."""
    return {"name": "test_tool", "version": "1.0.0"}


@pytest.fixture  
def sample_server_config() -> Dict[str, Any]:
    """Basic server configuration."""
    return {"name": "test_server", "endpoint": "http://localhost:8000"}


@pytest.fixture
def sample_agent_config() -> AgentConfig:
    """Basic agent configuration for DDD entities with value objects."""
    return AgentConfig(
        name=AgentName("Test Agent"),
        organization_id=OrganizationId(1),
        owner_id="user_123",
        description="Agent for testing",
        persona="Helpful test assistant",
        status=AgentStatus.active(),
        api_key=ApiKey("ak_conftest_secure_production_abcdef789xyz")
    )


@pytest.fixture
def sample_agent(sample_agent_config) -> Agent:
    """Basic agent entity."""
    return Agent.create(sample_agent_config)


@pytest.fixture
def sample_task_instructions() -> TaskInstructions:
    """Basic task instructions."""
    return TaskInstructions(
        instructions="Execute test task",
        tools=[{"name": "test_tool"}],
        servers=[{"name": "test_server"}]
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
