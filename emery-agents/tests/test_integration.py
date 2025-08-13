"""End-to-end integration tests for simplified smolagents architecture."""

import pytest
import asyncio
import os
from unittest.mock import patch, Mock

from emery_agents.core.runner import AgentRunner
from emery_agents.core.types import TaskStatus, Agent, Task, TaskInstructions
from emery_agents.integrations.emery_client import EmeryClientIntegration
from emery_agents.integrations.smolagents import SmolAgentsOrchestrator


@pytest.mark.integration
class TestIntegration:
    """Integration tests for complete workflows using simplified architecture."""
    
    @pytest.mark.asyncio
    async def test_full_execution_flow(self, sample_agent, sample_trigger_data):
        """Test complete execution flow with simplified smolagents hierarchy."""
        # Create real integrations (mocked external calls)
        emery_client = EmeryClientIntegration(agent_id="test_agent_123")
        smolagents = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            with patch.object(emery_client, 'report_execution_result', return_value=None):
                # Mock smolagents execution
                mock_result = {
                    "status": "success",
                    "result": {
                        "output": "Test execution completed successfully",
                        "agent_type": "HierarchicalAgent"
                    },
                    "orchestrator": "smolagents_hierarchy"
                }
                
                with patch.object(smolagents, 'execute_with_orchestrator', return_value=mock_result):
                    runner = AgentRunner(emery_client, smolagents, None)
                    
                    task = await runner.execute_capability(
                        sample_agent,
                        "test"  # Use test capability
                    )
                    
                    assert task.id is not None
                    assert task.status == TaskStatus.COMPLETED
                    assert task.result == "Test execution completed successfully"
                    assert task.startedAt is not None
                    assert task.completedAt is not None
    
    @pytest.mark.asyncio
    async def test_execution_failure_handling(self, sample_agent, sample_trigger_data):
        """Test execution failure handling."""
        emery_client = EmeryClientIntegration(agent_id="test_agent_123")
        smolagents = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            with patch.object(emery_client, 'report_execution_result', return_value=None):
                # Mock failed execution
                mock_result = {
                    "status": "failed",
                    "error": "Test execution error",
                    "result": {
                        "status": "failed",
                        "error": "Test execution error"
                    }
                }
                
                with patch.object(smolagents, 'execute_with_orchestrator', return_value=mock_result):
                    runner = AgentRunner(emery_client, smolagents, None)
                    
                    task = await runner.execute_capability(
                        sample_agent,
                        "test"
                    )
                    
                    assert task.status == TaskStatus.FAILED
                    assert "Test execution error" in task.error
    
    @pytest.mark.asyncio
    async def test_agent_hierarchy_setup(self, sample_agent, sample_trigger_data):
        """Test that agent hierarchy is properly set up."""
        emery_client = EmeryClientIntegration(agent_id="test_agent_123")
        smolagents = SmolAgentsOrchestrator()
        
        with patch.dict(os.environ, {"HF_TOKEN": "test-token"}, clear=True):
            with patch.object(emery_client, 'report_execution_result', return_value=None):
                # Spy on setup_agent_orchestrator
                with patch.object(smolagents, 'setup_agent_orchestrator') as mock_setup:
                    mock_result = {
                        "status": "success",
                        "result": {"output": "Test result"},
                        "orchestrator": "smolagents_hierarchy"
                    }
                    
                    with patch.object(smolagents, 'execute_with_orchestrator', return_value=mock_result):
                        runner = AgentRunner(emery_client, smolagents, None)
                        
                        await runner.execute_capability(
                            sample_agent,
                            "test"
                        )
                        
                        # Verify hierarchy was set up with our agent
                        mock_setup.assert_called_once_with(sample_agent)
    
    @pytest.mark.smolagents
    @pytest.mark.skipif(not os.getenv("HF_TOKEN"), reason="HF_TOKEN required")
    @pytest.mark.asyncio
    async def test_real_smolagents_integration(self, sample_agent, sample_trigger_data):
        """Test with real smolagents (requires HF_TOKEN)."""
        emery_client = EmeryClientIntegration(agent_id="test_agent_123")
        smolagents = SmolAgentsOrchestrator()
        
        with patch.object(emery_client, 'report_execution_result', return_value=None):
            runner = AgentRunner(emery_client, smolagents, None)
            
            # This will use real smolagents with HF_TOKEN
            task = await runner.execute_capability(
                sample_agent,
                "test"
            )
            
            # Should complete (success or failure both acceptable for integration test)
            assert task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
            assert task.startedAt is not None
            assert task.completedAt is not None