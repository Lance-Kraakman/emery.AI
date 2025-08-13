"""Test simplified hierarchical SmolAgents integration."""

import pytest
import os
from unittest.mock import Mock, patch

from emery_agents.integrations.smolagents import SmolAgentsOrchestrator
from emery_agents.core.types import StepType, TaskInstructions


class TestSmolAgentsOrchestrator:
    """Test simplified SmolAgentsOrchestrator."""
    
    def test_initialization(self):
        """SmolAgentsOrchestrator initializes correctly."""
        orchestrator = SmolAgentsOrchestrator()
        assert orchestrator.agent is None
    
    def test_setup_agent_orchestrator(self, sample_agent):
        """Setup agent hierarchy that mirrors our system structure."""
        orchestrator = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            orchestrator.setup_agent_orchestrator(sample_agent)
            
            # Verify main agent created
            assert orchestrator.agent is not None
            
            # Check managed agents (capabilities)
            managed_agents = orchestrator.agent.managed_agents
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
        orchestrator = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(EnvironmentError, match="HF_TOKEN"):
                orchestrator.setup_agent_orchestrator(sample_agent)
    
    def test_create_step_agent_code_step(self, sample_capability):
        """Create step agent for CODE_STEP."""
        orchestrator = SmolAgentsOrchestrator()
        
        # Modify step to be CODE_STEP
        sample_capability.steps[0].type = StepType.CODE_STEP
        
        step_agent = orchestrator._create_step_agent(sample_capability.steps[0], "test-token")
        assert step_agent is not None
        # Should be CodeAgent for CODE_STEP
    
    def test_create_step_agent_tool_step(self, sample_capability):
        """Create step agent for TOOL_STEP."""
        orchestrator = SmolAgentsOrchestrator()
        
        # Modify step to be TOOL_STEP  
        sample_capability.steps[0].type = StepType.TOOL_STEP
        
        step_agent = orchestrator._create_step_agent(sample_capability.steps[0], "test-token")
        assert step_agent is not None
        # Should be ToolCallingAgent for TOOL_STEP
    
    def test_load_tool_python_repl(self):
        """Test loading python_repl tool."""
        orchestrator = SmolAgentsOrchestrator()
        
        mock_tool_config = Mock()
        mock_tool_config.name = "python_repl"
        
        with patch('smolagents.PythonInterpreterTool') as mock_tool_class:
            mock_tool_instance = Mock()
            mock_tool_class.return_value = mock_tool_instance
            
            tool = orchestrator._load_tool(mock_tool_config)
            
            assert tool == mock_tool_instance
            mock_tool_class.assert_called_once()
    
    def test_load_tool_unknown(self):
        """Test loading unknown tool returns None."""
        orchestrator = SmolAgentsOrchestrator()
        
        mock_tool_config = Mock()
        mock_tool_config.name = "unknown_tool"
        
        tool = orchestrator._load_tool(mock_tool_config)
        assert tool is None
    
    @pytest.mark.asyncio
    async def test_execute_not_setup(self):
        """Execute fails when agent not set up."""
        orchestrator = SmolAgentsOrchestrator()
        instructions = TaskInstructions(instructions="Test task")
        
        with pytest.raises(RuntimeError, match="Agent not set up"):
            await orchestrator.execute_with_orchestrator(instructions, {})
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    @pytest.mark.asyncio
    async def test_execute_success(self, sample_agent):
        """Execute with hierarchical agent system."""
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        # Mock the main agent
        mock_result = "Hierarchical execution result"
        async def mock_run(instructions):
            return mock_result
        orchestrator.agent.run = mock_run
        
        instructions = TaskInstructions(instructions="Test hierarchical execution")
        result = await orchestrator.execute_with_orchestrator(instructions, {"context": "test"})
        
        assert result["status"] == "success"
        assert result["orchestrator"] == "smolagents_hierarchy"
        assert result["result"]["output"] == mock_result
    
    @pytest.mark.asyncio
    async def test_execute_failure(self, sample_agent):
        """Execute handles failures."""
        orchestrator = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            orchestrator.setup_agent_orchestrator(sample_agent)
            
            # Mock failure
            async def mock_run_error(instructions):
                raise Exception("Test error")
            orchestrator.agent.run = mock_run_error
            
            instructions = TaskInstructions(instructions="Test failure")
            result = await orchestrator.execute_with_orchestrator(instructions, {"context": "test"})
            
            assert result["status"] == "failed"
            assert "Test error" in result["error"]
            assert result["orchestrator"] == "smolagents_hierarchy"