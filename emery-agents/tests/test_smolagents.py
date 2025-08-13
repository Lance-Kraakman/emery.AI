"""Test SmolAgents integration."""

import pytest
import os
from unittest.mock import Mock, patch, MagicMock

from emery_agents.integrations.smolagents import (
    SmolAgentsOrchestrator, TaskExecutorAgent, CapabilityAgent, DefaultTaskExecutorAgent
)
from emery_agents.core.types import StepType, TaskInstructions


class TestTaskExecutorAgent:
    """Test TaskExecutorAgent functionality."""
    
    def test_initialization(self):
        """TaskExecutorAgent initializes correctly."""
        executor = TaskExecutorAgent()
        assert executor.manager_agent is None
        assert isinstance(executor.capability_agents, dict)
        assert executor.default_executor is None
        assert isinstance(executor.tools_registry, dict)


class TestCapabilityAgent:
    """Test CapabilityAgent functionality."""
    
    def test_initialization(self, sample_capability):
        """CapabilityAgent initializes with capability."""
        agent = CapabilityAgent(sample_capability)
        assert agent.capability == sample_capability
        assert agent.agent is None
        assert isinstance(agent.tools, list)
        assert isinstance(agent.servers, list)
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    def test_setup_agent_code_step(self, sample_capability):
        """Setup agent for CODE_STEP capability."""
        # Modify capability to have code step
        sample_capability.steps[0].type = StepType.CODE_STEP
        
        agent = CapabilityAgent(sample_capability)
        agent.setup_agent()
        
        assert agent.agent is not None
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required") 
    def test_setup_agent_tool_step(self, sample_capability):
        """Setup agent for TOOL_STEP capability."""
        # Modify capability to have tool step
        sample_capability.steps[0].type = StepType.TOOL_STEP
        
        agent = CapabilityAgent(sample_capability)
        agent.setup_agent()
        
        assert agent.agent is not None
    
    def test_setup_agent_no_token(self, sample_capability):
        """Setup agent fails without HF_TOKEN."""
        with patch.dict(os.environ, {}, clear=True):
            agent = CapabilityAgent(sample_capability)
            with pytest.raises(RuntimeError, match="HF_TOKEN"):
                agent.setup_agent()
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    @pytest.mark.asyncio
    async def test_execute_capability(self, sample_capability):
        """Execute capability agent."""
        agent = CapabilityAgent(sample_capability)
        
        # Mock the agent execution
        mock_agent = MagicMock()
        mock_agent.run = Mock(return_value="Test result")
        agent.agent = mock_agent
        
        result = await agent.execute("Test instructions", {"context": "data"})
        
        assert result["status"] == "completed"
        assert result["capability_used"] == "test_capability"
        assert "output" in result


class TestDefaultTaskExecutorAgent:
    """Test DefaultTaskExecutorAgent functionality."""
    
    def test_initialization(self):
        """DefaultTaskExecutorAgent initializes correctly."""
        executor = DefaultTaskExecutorAgent()
        assert executor.agent is None
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    def test_setup_agent(self):
        """Setup default executor agent."""
        executor = DefaultTaskExecutorAgent()
        executor.setup_agent()
        
        assert executor.agent is not None
    
    @pytest.mark.smolagents  
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    @pytest.mark.asyncio
    async def test_execute_default(self):
        """Execute with default agent."""
        executor = DefaultTaskExecutorAgent()
        
        # Mock the agent
        mock_agent = MagicMock()
        mock_agent.run = Mock(return_value="Default result")
        executor.agent = mock_agent
        
        result = await executor.execute("Test instructions", {"context": "data"})
        
        assert result["status"] == "completed"
        assert result["capability_used"] == "default_executor"


class TestSmolAgentsOrchestrator:
    """Test SmolAgentsOrchestrator functionality."""
    
    def test_initialization(self):
        """SmolAgentsOrchestrator initializes correctly."""
        orchestrator = SmolAgentsOrchestrator()
        assert isinstance(orchestrator.task_executor, TaskExecutorAgent)
        assert isinstance(orchestrator.default_executor, DefaultTaskExecutorAgent)
        assert isinstance(orchestrator.tools_registry, dict)
    
    def test_setup_agent_orchestrator(self, sample_agent):
        """Setup agent orchestrator with capabilities."""
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        assert len(orchestrator.task_executor.capability_agents) == 1
        assert "test_capability" in orchestrator.task_executor.capability_agents
        assert orchestrator.task_executor.default_executor is not None
    
    def test_setup_empty_capabilities(self):
        """Setup with agent having no capabilities."""
        from emery_agents.core.types import Agent
        agent = Agent(id=123, name="Empty Agent", capabilities=[])
        
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(agent)
        
        assert len(orchestrator.task_executor.capability_agents) == 0
    
    def test_fallback_capability_selection(self, sample_agent):
        """Test fallback capability selection logic."""
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        instructions = TaskInstructions(instructions="test_capability execution")
        selected = orchestrator._fallback_capability_selection(instructions)
        
        assert selected == "test_capability"
    
    def test_fallback_no_match(self, sample_agent):
        """Test fallback when no capability matches."""
        orchestrator = SmolAgentsOrchestrator()
        orchestrator.setup_agent_orchestrator(sample_agent)
        
        instructions = TaskInstructions(instructions="completely unrelated task")
        selected = orchestrator._fallback_capability_selection(instructions)
        
        assert selected is None
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    def test_legacy_get_agent(self):
        """Test legacy _get_agent method."""
        orchestrator = SmolAgentsOrchestrator()
        
        code_agent = orchestrator._get_agent(StepType.CODE_STEP)
        assert code_agent is not None
        
        tool_agent = orchestrator._get_agent(StepType.TOOL_STEP)  
        assert tool_agent is not None
    
    def test_tool_registry(self):
        """Test tool registry functionality."""
        orchestrator = SmolAgentsOrchestrator()
        
        # Register tool
        mock_tool = Mock()
        orchestrator.register_tool("test_tool", mock_tool)
        
        # Verify registration
        assert "test_tool" in orchestrator.tools_registry
        assert orchestrator.tools_registry["test_tool"] == mock_tool
        
        # List tools
        tools = orchestrator.list_available_tools()
        assert "test_tool" in tools
    
    @pytest.mark.asyncio
    async def test_load_tool_found(self):
        """Test loading registered tool."""
        orchestrator = SmolAgentsOrchestrator()
        
        # Register tool
        mock_tool = Mock()
        orchestrator.register_tool("existing_tool", mock_tool)
        
        # Load tool
        loaded_tool = await orchestrator._load_tool("existing_tool")
        assert loaded_tool == mock_tool
    
    @pytest.mark.asyncio
    async def test_load_tool_not_found(self):
        """Test loading non-existent tool."""
        orchestrator = SmolAgentsOrchestrator()
        
        loaded_tool = await orchestrator._load_tool("nonexistent_tool")
        assert loaded_tool is None