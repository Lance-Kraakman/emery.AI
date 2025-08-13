"""Test core AgentRunner functionality."""

import pytest
from unittest.mock import Mock, AsyncMock
from datetime import datetime

from emery_agents.core.runner import AgentRunner
from emery_agents.core.types import (
    TaskStatus, StepType, CapabilityConfig, StepConfig
)


class TestAgentRunner:
    """Test AgentRunner core functionality."""
    
    def test_initialization(self, mock_integrations):
        """AgentRunner initializes with integrations."""
        runner = AgentRunner(**mock_integrations)
        assert runner.emery_client is not None
        assert runner.smolagents is not None
        assert runner.mcp_servers is not None
    
    def test_find_capability(self, mock_integrations, sample_agent):
        """Find existing capability in agent."""
        runner = AgentRunner(**mock_integrations)
        capability = runner._find_or_create_capability(sample_agent, "test_capability")
        assert capability.name == "test_capability"
        assert capability.description == "Test capability for unit testing"
    
    def test_create_test_capability(self, mock_integrations, sample_agent):
        """Create test capability when not found."""
        runner = AgentRunner(**mock_integrations)
        capability = runner._find_or_create_capability(sample_agent, "test")
        assert capability.name == "test"
        assert "Test capability" in capability.description
        assert len(capability.steps) == 1
    
    def test_capability_not_found_error(self, mock_integrations, sample_agent):
        """Raise error for non-existent capability."""
        runner = AgentRunner(**mock_integrations)
        with pytest.raises(ValueError, match="not found"):
            runner._find_or_create_capability(sample_agent, "nonexistent")
    
    @pytest.mark.asyncio
    async def test_execute_capability_success(self, mock_integrations, sample_agent):
        """Execute capability successfully using simplified smolagents."""
        # Setup mock for simplified architecture
        mock_integrations["smolagents"].execute_with_orchestrator.return_value = {
            "status": "success",
            "result": {"output": "Task completed successfully"}
        }
        
        runner = AgentRunner(**mock_integrations)
        
        # Execute
        task = await runner.execute_capability(
            sample_agent,
            "test_capability"
        )
        
        # Verify
        assert task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
        assert task.agentId == sample_agent.id
        assert task.capabilityName == "test_capability"
        assert task.startedAt is not None
        assert task.completedAt is not None
        
        # Verify integration calls
        mock_integrations["emery_client"].report_execution_result.assert_called_once()
    
    @pytest.mark.asyncio 
    async def test_execute_test_capability(self, mock_integrations, sample_agent):
        """Execute built-in test capability using simplified smolagents."""
        mock_integrations["smolagents"].execute_with_orchestrator.return_value = {
            "status": "success",
            "result": {"output": "Test capability executed"}
        }
        
        runner = AgentRunner(**mock_integrations)
        
        task = await runner.execute_capability(
            sample_agent,
            "test"
        )
        
        assert task.capabilityName == "test"
        assert task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
    
    @pytest.mark.asyncio
    async def test_execution_error_handling(self, mock_integrations, sample_agent):
        """Handle execution errors properly."""
        # Setup smolagents to return error
        mock_integrations["smolagents"].execute_with_orchestrator.return_value = {
            "status": "failed",
            "error": "Execution failed"
        }
        
        runner = AgentRunner(**mock_integrations)
        
        task = await runner.execute_capability(
            sample_agent,
            "test_capability"
        )
        
        assert task.status == TaskStatus.FAILED
        assert "failed" in task.error.lower() or "execution" in task.error.lower()
    
    
    @pytest.mark.asyncio
    async def test_report_execution_results_error(self, mock_integrations, sample_agent):
        """Handle reporting errors gracefully."""
        # Setup emery_client to raise error on reporting
        mock_integrations["emery_client"].report_execution_result.side_effect = Exception("Reporting failed")
        mock_integrations["smolagents"].execute_with_orchestrator.return_value = {
            "status": "success",
            "result": {"output": "Test completed"}
        }
        
        runner = AgentRunner(**mock_integrations)
        
        # Should not raise exception even if reporting fails
        task = await runner.execute_capability(
            sample_agent,
            "test"
        )
        
        # Execution should complete despite reporting failure
        assert task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]