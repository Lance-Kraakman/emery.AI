"""Unit tests for smolagents integration."""

import pytest
from unittest.mock import patch, MagicMock
from emery_agents.domain.entities.models import Agent, CapabilityConfig, StepConfig, StepType, ToolConfig
from emery_agents.integrations.smolagents_orcha import SmolAgentsOrchestrator


class TestSmolAgentsIntegration:
    """Test smolagents orchestrator integration."""
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_orchestrator_initialization(self):
        """Test orchestrator initializes correctly."""
        orchestrator = SmolAgentsOrchestrator()
        assert orchestrator.agent is None
    
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
        
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(agent)
        assert orchestrator.agent is not None
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_load_tool_success(self):
        """Test successful tool loading."""
        orchestrator = SmolAgentsOrchestrator()
        tool_config = ToolConfig(name="python_repl", config={})
        
        tool = orchestrator._load_tool(tool_config)
        assert tool is not None
    
    @patch.dict('os.environ', {'HF_TOKEN': 'test-token'})
    def test_load_tool_not_found(self):
        """Test handling of unknown tool."""
        orchestrator = SmolAgentsOrchestrator()
        tool_config = ToolConfig(name="nonexistent_tool", config={})
        
        tool = orchestrator._load_tool(tool_config)
        assert tool is None
