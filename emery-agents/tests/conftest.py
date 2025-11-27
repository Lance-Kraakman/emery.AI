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


# AIDEV-NOTE: Enhanced fixtures for standardized testing infrastructure
@pytest.fixture
def mock_model_provider():
    """Mock model provider for standardized testing."""
    from emery_agents.domain.ai.services.model_provider_service import ModelType
    from emery_agents.core.types import StepType
    
    provider = Mock()
    
    # Mock a simple model object
    mock_model = Mock()
    mock_model.name = "test-model"
    
    # Standard method mocks
    provider.get_model_for_step_type = Mock(return_value=mock_model)
    provider.get_model_by_type = Mock(return_value=mock_model)
    provider.get_default_model_for_capability = Mock(return_value=mock_model)
    
    return provider


@pytest.fixture
def real_model_provider(mock_hf_env):
    """Real model provider for integration tests."""
    from emery_agents.infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider
    return SmolagentsModelProvider()


@pytest.fixture
def execution_context_factory():
    """Factory for creating execution contexts."""
    from emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
    
    def create_context(
        instructions: str = "Test execution",
        available_tools: List[str] = None,
        capability_name: str = None,
        max_steps: int = 10,
        timeout_seconds: int = 300
    ):
        return ExecutionContext(
            instructions=instructions,
            available_tools=available_tools or ['test_tool'],
            capability_name=capability_name,
            max_steps=max_steps,
            timeout_seconds=timeout_seconds,
            mode=ExecutionMode.INSTRUCTION if not capability_name else ExecutionMode.CAPABILITY
        )
    
    return create_context


@pytest.fixture
def fixture_data_loader():
    """Load test fixtures from JSON files."""
    def load_fixture_data():
        try:
            from emery_agents.tests.fixtures.fixture_loader import FixtureLoader
            loader = FixtureLoader()
            return {
                'tasks': loader.load_tasks(),
                'agents': loader.load_agents()
            }
        except Exception as e:
            # Return empty data if fixtures can't be loaded
            logger.warning(f"Could not load fixture data: {e}")
            return {'tasks': [], 'agents': []}
    
    return load_fixture_data


@pytest.fixture
def progress_tracker():
    """Track execution progress for testing."""
    events = []
    
    def track_event(event: Dict[str, Any]):
        events.append(event)
        logger.info(f"📊 Progress Event: {event.get('status')} - {event.get('step_id')}")
    
    # Provide both the events list and the tracker function
    return events, track_event


@pytest.fixture
def test_categories():
    """Standardized test categories for organization."""
    return {
        'validation': {
            'name': 'Validation Tests',
            'description': 'Basic validation and setup tests'
        },
        'unit': {
            'name': 'Unit Tests', 
            'description': 'Individual component tests with mocks'
        },
        'integration': {
            'name': 'Integration Tests',
            'description': 'Multi-component tests with real dependencies'
        },
        'real_execution': {
            'name': 'Real Execution Tests',
            'description': 'Full end-to-end tests with AI models'
        }
    }


@pytest.fixture
def enhanced_mock_integrations(mock_emery_client, mock_smolagents, mock_mcp_servers, mock_model_provider):
    """Enhanced mock integrations with model provider."""
    return {
        "emery_client": mock_emery_client,
        "smolagents": mock_smolagents,
        "mcp_servers": mock_mcp_servers,
        "model_provider": mock_model_provider
    }
