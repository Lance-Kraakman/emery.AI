"""
Base Test Classes for Standardized Testing

AIDEV-NOTE: Provides standardized test infrastructure for emery-agents.
Consolidates common test patterns and fixtures to reduce duplication
and improve consistency across the test suite.
"""

import pytest
import logging
from typing import Dict, Any, List, Optional
from unittest.mock import AsyncMock, Mock, patch
from abc import ABC, abstractmethod

# Domain imports for testing
from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.agents.entities.task import Task, TaskInstructions, TaskConfig
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
from emery_agents.domain.agents.value_objects.agent_value_objects import AgentName, AgentStatus
from emery_agents.infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider
from emery_agents.domain.ai.services.model_provider_service import ModelType

logger = logging.getLogger(__name__)


class BaseDDDTest(ABC):
    """
    Base class for DDD-focused tests.
    
    AIDEV-NOTE: Provides common setup for testing domain entities,
    value objects, and application services following DDD patterns.
    """
    
    @pytest.fixture
    def sample_agent_id(self) -> AgentId:
        """Standard agent ID for testing."""
        return AgentId(123)
    
    @pytest.fixture
    def sample_organization_id(self) -> OrganizationId:
        """Standard organization ID for testing."""
        return OrganizationId(1)
    
    @pytest.fixture
    def sample_task_id(self) -> TaskId:
        """Standard task ID for testing."""
        return TaskId.generate()
    
    @pytest.fixture
    def sample_agent_config(self, sample_organization_id) -> AgentConfig:
        """Standard agent configuration for testing."""
        return AgentConfig(
            name=AgentName("Test Agent"),
            organization_id=sample_organization_id,
            owner_id="user_123",
            description="Agent for testing",
            persona="Helpful test assistant",
            status=AgentStatus.active()
        )
    
    @pytest.fixture
    def sample_agent(self, sample_agent_config) -> Agent:
        """Standard agent entity for testing."""
        return Agent.create(sample_agent_config)
    
    @pytest.fixture
    def sample_task_instructions(self) -> TaskInstructions:
        """Standard task instructions for testing."""
        return TaskInstructions(
            instructions="Execute test task",
            tools=[{"name": "test_tool"}],
            servers=[]
        )


class BaseModelProviderTest(BaseDDDTest):
    """
    Base class for testing AI model providers.
    
    AIDEV-NOTE: Provides common setup for testing the centralized
    model provider system and AI model integration.
    """
    
    @pytest.fixture
    def mock_hf_token(self):
        """Mock HF_TOKEN environment variable."""
        with patch.dict('os.environ', {'HF_TOKEN': 'test-token-123'}):
            yield 'test-token-123'
    
    @pytest.fixture
    def model_provider(self, mock_hf_token):
        """Create real model provider for testing."""
        return SmolagentsModelProvider()
    
    @pytest.fixture
    def mock_model_provider(self):
        """Mock model provider for unit tests."""
        provider = Mock()
        provider.get_model_for_step_type = Mock()
        provider.get_model_by_type = Mock()
        provider.get_default_model_for_capability = Mock()
        provider.list_available_models = Mock(return_value=['Qwen/Qwen2.5-14B-Instruct'])
        provider.is_model_available = Mock(return_value=True)
        return provider
    
    def assert_model_type_mapping(self, model_provider, step_type, expected_model_type):
        """Helper to verify step type to model type mapping."""
        model = model_provider.get_model_for_step_type(step_type)
        assert model is not None
        # Additional assertions can be added based on model implementation


class BaseExecutionTest(BaseModelProviderTest):
    """
    Base class for testing execution services and repositories.
    
    AIDEV-NOTE: Provides common setup for testing task execution,
    agent orchestration, and smolagents integration.
    """
    
    @pytest.fixture
    def mock_tool_registry_repository(self):
        """Mock tool registry repository."""
        repo = Mock()
        repo.load_tools = Mock(return_value=[])
        repo.list_available_tools = Mock(return_value=['test_tool'])
        return repo
    
    @pytest.fixture
    def mock_execution_context(self, sample_task_instructions):
        """Mock execution context."""
        context = Mock()
        context.instructions = sample_task_instructions.instructions
        context.available_tools = ['test_tool']
        context.max_steps = 10
        context.timeout_seconds = 300
        context.is_instruction_mode = True
        context.is_capability_mode = False
        context.capability_name = None
        return context
    
    @pytest.fixture
    def execution_progress_tracker(self):
        """Track execution progress for testing."""
        progress_events = []
        
        def track_progress(event):
            progress_events.append(event)
            logger.info(f"Progress: {event}")
        
        return progress_events, track_progress


class BaseIntegrationTest(BaseExecutionTest):
    """
    Base class for integration tests.
    
    AIDEV-NOTE: Provides setup for tests that require multiple
    components working together, including real AI model access.
    """
    
    @pytest.fixture
    def requires_hf_token(self):
        """Skip test if HF_TOKEN is not available."""
        import os
        if not os.getenv('HF_TOKEN'):
            pytest.skip("HF_TOKEN environment variable required for integration tests")
        return os.getenv('HF_TOKEN')
    
    @pytest.fixture
    def requires_smolagents(self):
        """Skip test if smolagents is not available."""
        try:
            import smolagents
            return smolagents
        except ImportError:
            pytest.skip("smolagents package required for integration tests")
    
    def verify_real_execution_result(self, result: Dict[str, Any]):
        """Verify real execution result structure."""
        assert 'status' in result
        assert 'step_id' in result
        assert 'step_type' in result
        assert 'output' in result
        assert 'timestamp_ms' in result
        assert 'progress_percent' in result
        
        # Status should be valid
        assert result['status'] in ['in_progress', 'completed', 'failed']
        
        # Progress should be reasonable
        assert 0 <= result['progress_percent'] <= 100
    
    async def collect_execution_stream(self, execution_stream) -> List[Dict[str, Any]]:
        """Collect all events from execution stream."""
        events = []
        async for event in execution_stream:
            events.append(event)
            logger.info(f"📊 Execution Event: {event['status']} - {event.get('step_id', 'unknown')}")
        return events


class BaseRealAgentTest(BaseIntegrationTest):
    """
    Base class for real agent execution tests.
    
    AIDEV-NOTE: Specialized for tests that execute actual tasks
    from tasks.json using real smolagents and AI models.
    """
    
    @pytest.fixture
    def fixture_loader(self):
        """Load fixtures from tasks.json and agents.json."""
        from emery_agents.tests.fixtures.fixture_loader import FixtureLoader
        return FixtureLoader()
    
    @pytest.fixture
    def available_tasks(self, fixture_loader):
        """Load available tasks from fixtures."""
        tasks = fixture_loader.load_tasks()
        logger.info(f"✅ Loaded {len(tasks)} tasks from fixtures")
        return tasks
    
    @pytest.fixture
    def available_agents(self, fixture_loader):
        """Load available agents from fixtures."""
        agents = fixture_loader.load_agents()
        logger.info(f"✅ Loaded {len(agents)} agents from fixtures")
        return agents
    
    def find_task_by_id(self, tasks: List[Task], task_id: str) -> Optional[Task]:
        """Find task by ID in loaded fixtures."""
        for task in tasks:
            if task.short_id.value == task_id:
                return task
        return None
    
    def find_agent_by_name(self, agents: List[Agent], agent_name: str) -> Optional[Agent]:
        """Find agent by name in loaded fixtures."""
        for agent in agents:
            if agent.name.value == agent_name:
                return agent
        return None
    
    async def execute_real_task(self, task: Task, agent: Agent) -> List[Dict[str, Any]]:
        """Execute a real task with proper setup and monitoring."""
        # This would be implemented by specific test classes
        # that use real execution repositories
        raise NotImplementedError("Subclasses must implement execute_real_task")


# Test markers for categorizing tests
pytest_plugins = []

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests for individual components"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests requiring multiple components"
    )
    config.addinivalue_line(
        "markers", "real_execution: Tests that execute real AI models (requires HF_TOKEN)"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take more than 30 seconds to run"
    )
    config.addinivalue_line(
        "markers", "model_provider: Tests for AI model provider system"
    )
    config.addinivalue_line(
        "markers", "ddd: Tests focused on Domain-Driven Design patterns"
    )