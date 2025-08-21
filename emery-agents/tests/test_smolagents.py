"""Test simplified hierarchical SmolAgents integration."""

import pytest
import os
from unittest.mock import Mock, patch

from emery_agents.application.services.agent_service import AgentService
from emery_agents.domain.entities.models import StepType, TaskInstructions


class TestAgentService:
    """Test AgentService."""
    
    def test_initialization(self):
        """AgentService initializes correctly."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        assert service.agent is None
    
    def test_setup_agent_orchestrator(self, sample_agent):
        """Setup agent hierarchy that mirrors our system structure."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            service.setup_agent_orchestrator(sample_agent)
            
            # Verify main agent created
            assert service.agent is not None
            
            # Check managed agents (capabilities)
            managed_agents = service.agent.managed_agents
            assert len(managed_agents) == 1
            
            # Check capability agent structure (managed_agents might be dict or list)
            if isinstance(managed_agents, dict):
                capability_agent = list(managed_agents.values())[0]
            else:
                capability_agent = managed_agents[0]
            assert hasattr(capability_agent, 'name')
            assert hasattr(capability_agent, 'managed_agents')  # Should have step agents
            
            # Check step agents
            step_agents = capability_agent.managed_agents
            assert len(step_agents) == 1  # One step in sample capability
            
            if isinstance(step_agents, dict):
                step_agent = list(step_agents.values())[0]
            else:
                step_agent = step_agents[0]
            assert hasattr(step_agent, 'name')
            assert hasattr(step_agent, 'description')
    
    def test_setup_no_token(self, sample_agent):
        """Setup fails without HF_TOKEN."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(EnvironmentError, match="HF_TOKEN"):
                service.setup_agent_orchestrator(sample_agent)
    
    def test_create_step_agent_code_step(self, sample_capability):
        """Create step agent for CODE_STEP."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        
        # Modify step to be CODE_STEP
        sample_capability.steps[0].type = StepType.CODE_STEP
        
        step_agent = service._create_step_agent(sample_capability.steps[0], "test-token")
        assert step_agent is not None
        # Should be CodeAgent for CODE_STEP
    
    def test_create_step_agent_tool_step(self, sample_capability):
        """Create step agent for TOOL_STEP."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        
        # Modify step to be TOOL_STEP  
        sample_capability.steps[0].type = StepType.TOOL_STEP
        
        step_agent = service._create_step_agent(sample_capability.steps[0], "test-token")
        assert step_agent is not None
        # Should be ToolCallingAgent for TOOL_STEP
    
    def test_load_tool_python_repl(self):
        """Test loading python_repl tool."""
        tool_repo = Mock()
        tool_repo.create_tool_instance.return_value = "python_repl_tool"
        service = AgentService(tool_repo)
        
        mock_tool_config = Mock()
        mock_tool_config.name = "python_repl"
        mock_tool_config.config = {}
        
        tool = service._load_tool(mock_tool_config)
        
        assert tool == "python_repl_tool"
        tool_repo.create_tool_instance.assert_called_once_with(mock_tool_config)
    
    def test_load_tool_unknown(self):
        """Test loading unknown tool returns None."""
        tool_repo = Mock()
        tool_repo.create_tool_instance.return_value = None
        service = AgentService(tool_repo)
        
        mock_tool_config = Mock()
        mock_tool_config.name = "unknown_tool"
        
        tool = service._load_tool(mock_tool_config)
        assert tool is None
    
    @pytest.mark.asyncio
    async def test_execute_task(self, sample_agent):
        """Test execute_task method."""
        tool_repo = Mock()
        service = AgentService(tool_repo)
        
        # Mock the agent's run method
        mock_result = "Execution result"
        async def mock_run(instructions):
            return mock_result
        
        # Since we can't easily patch the agent instance created inside the service,
        # we'll patch the CodeAgent class to control its behavior.
        with patch('emery_agents.application.services.agent_service.CodeAgent') as mock_code_agent:
            mock_agent_instance = Mock()
            mock_agent_instance.run = mock_run
            mock_code_agent.return_value = mock_agent_instance
            
            instructions = TaskInstructions(instructions="Test execution")
            result = await service.execute_task(sample_agent, instructions, "test_capability")
            
            assert result["status"] == "success"
            assert result["result"]["output"] == mock_result
