"""Unit tests for smolagents integration."""

import pytest
from unittest.mock import patch, MagicMock
from emery_agents.domain.entities.models import Agent, CapabilityConfig, StepConfig, StepType, ToolConfig
from emery_agents.application.services.agent_service import AgentService
from emery_agents.infrastructure.repositories.tool_repository import ToolRegistryRepository


class TestSmolAgentsIntegration:
    """Test smolagents orchestrator integration."""
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_service_initialization(self):
        """Test service initializes correctly."""
        tool_repo = ToolRegistryRepository()
        service = AgentService(tool_repo)
        assert service.agent is None
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_setup_agent_orchestrator(self):
        """Test agent orchestrator setup."""
        agent = Agent(
            id=123,
            name="Test Agent",
            capabilities=[
                CapabilityConfig(
                    name="test_capability",
                    description="Test capability",
                    steps=[
                        StepConfig(
                            id="step1",
                            type=StepType.CODE_STEP,
                            instructions="Test step"
                        )
                    ]
                )
            ]
        )
        
        tool_repo = ToolRegistryRepository()
        service = AgentService(tool_repo)
        service.setup_agent_orchestrator(agent)
        assert service.agent is not None
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_load_tool_success(self):
        """Test successful tool loading."""
        tool_repo = ToolRegistryRepository()
        service = AgentService(tool_repo)
        tool_config = ToolConfig(name="python_repl", config={})
        
        tool = service._load_tool(tool_config)
        assert tool is not None
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_load_tool_not_found(self):
        """Test handling of unknown tool."""
        tool_repo = ToolRegistryRepository()
        service = AgentService(tool_repo)
        tool_config = ToolConfig(name="nonexistent_tool", config={})
        
        tool = service._load_tool(tool_config)
        assert tool is None
